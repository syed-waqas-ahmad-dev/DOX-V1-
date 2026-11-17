'use server';

/**
 * @file actions/order.actions.ts
 * @description Enterprise order placement flow for Pakistani market.
 * Server-side recalculation of pricing, 17% GST, courier tariffs, atomic stock decrement,
 * and COD OTP requirement evaluation.
 * Strict TypeScript: ZERO `any`.
 */

import { canUseMockDatabase, connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { Order } from '@/models/Order';
import { Product } from '@/models/Product';
import { Coupon } from '@/models/Coupon';
import { CouponUsage } from '@/models/CouponUsage';
import { calculateOrderTotals } from '@/lib/pricing';
import { validateCouponRules } from '@/lib/coupon-validator';
import { successResponse, errorResponse, type ActionResult } from '@/lib/response';
import { handleActionError } from '@/lib/error-handler';
import { checkoutOrderSchema, type CheckoutOrderInput } from '@/lib/validators';
import { COD_MAX_LIMIT_WITHOUT_OTP } from '@/lib/constants';
import { MockDb } from '@/lib/db/mock-store';
import { Notification } from '@/models/Notification';
import { OrderStatus, PaymentMethod, PaymentStatus, Courier, type IOrder, type IOrderItem, NotificationType, type CreateOrderPayload, UserRole, Department } from '@/types';
import { isValidCoordinatePair } from '@/lib/cities';
import mongoose, { Types } from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isElevatedAdminRole, isAdminRole, verifyDepartmentAuth } from '@/lib/auth-guard';
import { cancelReferralInternal, completeReferralInternal } from '@/lib/services/referral.service';
import { executeWithOptionalTransaction } from '@/lib/services/wallet.service';
import { TrackingAttempt } from '@/models/TrackingAttempt';
import { headers } from 'next/headers';
import type { ITrackOrderDTO } from '@/types';
import { generateVerificationToken, getInvoiceVerificationToken } from '@/lib/invoice';
import { rateLimit } from '@/lib/rate-limit';
import { signGuestOrderToken, verifyGuestOrderToken, consumeCodOtpToken, releaseCodOtpToken } from '@/lib/guest-order-token';

interface VariantCandidate {
  _id?: Types.ObjectId | string;
  size: string;
  color: string;
  stock: number;
  sku: string;
}

interface ResolvedOrderVariant {
  isSimpleProduct: boolean;
  variantId?: Types.ObjectId | string;
  size: string;
  color: string;
  sku: string;
  stock: number;
}

const normVariantAttr = (val?: string) => (val || '').trim().toLowerCase();

/**
 * Atomically adjusts a single variant's stock AND recalculates the parent product's
 * aggregate `stock` as the exact server-side sum of all `variants[].stock` in a
 * single MongoDB document write (eliminating stale read-snapshot overwrites under
 * concurrent orders or restocking operations).
 */
async function applyAtomicVariantStockDelta(params: {
  productId: Types.ObjectId | string;
  variantId?: Types.ObjectId | string;
  sku: string;
  delta: number;
  session?: mongoose.ClientSession;
}) {
  const { productId, variantId, sku, delta, session } = params;
  const normalizedVariantId =
    variantId && Types.ObjectId.isValid(variantId.toString())
      ? new Types.ObjectId(variantId.toString())
      : variantId;

  const elemMatch: Record<string, unknown> = variantId
    ? { _id: normalizedVariantId, ...(delta < 0 ? { stock: { $gte: Math.abs(delta) } } : {}) }
    : { sku, ...(delta < 0 ? { stock: { $gte: Math.abs(delta) } } : {}) };

  const matchExpr = variantId
    ? { $eq: ['$$v._id', normalizedVariantId] }
    : { $eq: ['$$v.sku', sku] };

  return Product.findOneAndUpdate(
    {
      _id: productId,
      variants: { $elemMatch: elemMatch },
    },
    [
      {
        $set: {
          variants: {
            $map: {
              input: '$variants',
              as: 'v',
              in: {
                $cond: [
                  matchExpr,
                  {
                    $mergeObjects: [
                      '$$v',
                      {
                        stock: {
                          $max: [0, { $add: [{ $ifNull: ['$$v.stock', 0] }, delta] }],
                        },
                      },
                    ],
                  },
                  '$$v',
                ],
              },
            },
          },
        },
      },
      {
        $set: {
          stock: {
            $reduce: {
              input: '$variants',
              initialValue: 0,
              in: {
                $add: ['$$value', { $max: [0, { $ifNull: ['$$this.stock', 0] }] }],
              },
            },
          },
        },
      },
    ],
    {
      session: session || undefined,
      returnDocument: 'after',
      updatePipeline: true,
    }
  );
}

function resolveOrderProductVariant(
  product: {
    name: string;
    sku: string;
    stock: number;
    variants?: VariantCandidate[];
  },
  item: {
    variantId?: string;
    variantSku?: string;
    sku?: string;
    size?: string;
    color?: string;
  },
  mode: 'checkout' | 'restock'
): { resolved?: ResolvedOrderVariant; error?: string } {
  const variants = Array.isArray(product.variants) ? product.variants : [];

  if (variants.length === 0) {
    const cleanSize = (item.size || 'Standard').trim();
    const cleanColor = (item.color || 'Standard').trim();
    return {
      resolved: {
        isSimpleProduct: true,
        size: cleanSize,
        color: cleanColor,
        sku:
          item.sku?.trim() ||
          `${product.sku}-${cleanSize}-${cleanColor.slice(0, 3).toUpperCase()}`,
        stock: Math.max(0, product.stock || 0),
      },
    };
  }

  const normSize = normVariantAttr(item.size);
  const normColor = normVariantAttr(item.color);
  let matched: VariantCandidate | undefined;

  if (item.variantId && item.variantId.trim()) {
    const targetId = item.variantId.trim();
    matched = variants.find((v) => v._id?.toString() === targetId);
    if (!matched) {
      return {
        error: `Selected variant is no longer available for "${product.name}".`,
      };
    }
    if (normSize && normVariantAttr(matched.size) !== normSize) {
      return {
        error: `Variant size mismatch for "${product.name}" (Size ${item.size}).`,
      };
    }
    if (normColor && normVariantAttr(matched.color) !== normColor) {
      return {
        error: `Variant color mismatch for "${product.name}" (${item.color}).`,
      };
    }
  } else if (
    (item.variantSku && item.variantSku.trim()) ||
    (mode === 'restock' && item.sku && item.sku.trim())
  ) {
    const targetSku = (item.variantSku || item.sku || '').trim().toUpperCase();
    matched = variants.find((v) => (v.sku || '').trim().toUpperCase() === targetSku);
    if (matched && mode === 'checkout') {
      if (normSize && normVariantAttr(matched.size) !== normSize) {
        return {
          error: `Variant size mismatch for "${product.name}" (Size ${item.size}).`,
        };
      }
      if (normColor && normVariantAttr(matched.color) !== normColor) {
        return {
          error: `Variant color mismatch for "${product.name}" (${item.color}).`,
        };
      }
    }
  }

  // Fallback / legacy resolution using normalized (size, color)
  if (!matched && normSize) {
    const sizeMatches = variants.filter((v) => normVariantAttr(v.size) === normSize);
    if (normColor) {
      matched = sizeMatches.find((v) => normVariantAttr(v.color) === normColor);
    } else if (sizeMatches.length === 1) {
      matched = sizeMatches[0];
    } else if (sizeMatches.length > 1) {
      if (mode === 'restock') {
        return {
          error: `Ambiguous legacy order restocking: Size "${item.size}" has multiple color variants for "${product.name}". Please specify variant identity.`,
        };
      }
      return {
        error: `Please select a color for Size "${item.size}" of "${product.name}".`,
      };
    }
  }

  if (!matched) {
    if (mode === 'restock') {
      return {
        error: `Cannot identify variant for product "${product.name}" (SKU: ${item.sku || 'N/A'}, Size: ${item.size || 'N/A'}, Color: ${item.color || 'N/A'}).`,
      };
    }
    return {
      error: `Selected variant (Size ${item.size || 'N/A'}${item.color ? `, Color ${item.color}` : ''}) is not available for "${product.name}".`,
    };
  }

  return {
    resolved: {
      isSimpleProduct: false,
      variantId: matched._id,
      size: matched.size,
      color: matched.color,
      sku: matched.sku,
      stock: Math.max(0, matched.stock || 0),
    },
  };
}

function isIdempotencyDuplicateKeyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const candidate = err as {
    code?: number;
    message?: string;
    keyPattern?: Record<string, unknown>;
    keyValue?: Record<string, unknown>;
  };

  const isDuplicateCode =
    candidate.code === 11000 ||
    (typeof candidate.message === 'string' && candidate.message.includes('E11000'));

  if (!isDuplicateCode && !(typeof candidate.message === 'string' && candidate.message.includes('idempotencyKey'))) {
    return false;
  }

  // 1. Check Mongoose/Mongo keyPattern
  if (candidate.keyPattern && 'idempotencyKey' in candidate.keyPattern) {
    return true;
  }

  // 2. Check keyValue
  if (candidate.keyValue && 'idempotencyKey' in candidate.keyValue) {
    return true;
  }

  // 3. Check error message string for index name or field
  if (
    typeof candidate.message === 'string' &&
    (candidate.message.includes('idempotencyKey') || candidate.message.includes('idempotencyKey_1'))
  ) {
    return true;
  }

  return false;
}

function verifyIdempotencyOrderOwnership(
  existingOrder: {
    userId?: Types.ObjectId | string | null;
    guestEmail?: string;
    guestPhone?: string;
    shippingAddress?: { phone?: string };
  },
  caller: {
    authoritativeUserId: string | null;
    guestEmail?: string;
    guestPhone?: string;
    shippingPhone?: string;
  }
): boolean {
  const existingUserId = existingOrder.userId?.toString() || null;
  if (caller.authoritativeUserId) {
    return existingUserId === caller.authoritativeUserId;
  }
  if (existingUserId && existingUserId !== 'guest') {
    return false;
  }
  const normEmail = (v?: string) => (v || '').trim().toLowerCase();
  const normPhone = (v?: string) => (v || '').trim();
  const callerEmail = normEmail(caller.guestEmail);
  const existingEmail = normEmail(existingOrder.guestEmail);
  if (callerEmail && existingEmail && callerEmail === existingEmail) {
    return true;
  }
  const callerPhone = normPhone(caller.guestPhone) || normPhone(caller.shippingPhone);
  const existingPhone =
    normPhone(existingOrder.guestPhone) || normPhone(existingOrder.shippingAddress?.phone);
  return Boolean(callerPhone && existingPhone && callerPhone === existingPhone);
}

export async function createOrder(
  payload: CreateOrderPayload
): Promise<ActionResult<{ order: IOrder; requiresOtp: boolean; guestAccessToken?: string }>> {
  let cleanIdempotencyKey: string | undefined;
  let authoritativeUserId: string | null = null;
  let validatedGuestEmail: string | undefined;
  let validatedGuestPhone: string | undefined;
  let validatedShippingPhone: string | undefined;
  let consumedOtpJti: string | undefined;

  try {
    await connectToDatabase();

    // 1. Validate Form Input
    const validatedData = checkoutOrderSchema.parse(payload.checkoutData);
    if (validatedData.paymentMethod !== PaymentMethod.COD) {
      return errorResponse('Only Cash on Delivery (COD) is supported.');
    }

    cleanIdempotencyKey = validatedData.idempotencyKey?.trim() || undefined;
    validatedGuestEmail = validatedData.guestEmail?.trim() || undefined;
    validatedGuestPhone = validatedData.guestPhone?.trim() || validatedData.shippingAddress.phone?.trim() || undefined;
    validatedShippingPhone = validatedData.shippingAddress.phone;

    const rawCoords = validatedData.shippingAddress.coordinates;
    if (rawCoords && !isValidCoordinatePair(rawCoords.lat, rawCoords.lng)) {
      return errorResponse('Invalid delivery coordinates provided.');
    }
    const sanitizedCoordinates = rawCoords
      ? { lat: rawCoords.lat, lng: rawCoords.lng, source: 'manual_pin' as const }
      : undefined;
    const normalizedStreet =
      validatedData.shippingAddress.street?.trim() ||
      validatedData.shippingAddress.address?.trim() ||
      '';
    const normalizedAddress =
      validatedData.shippingAddress.address?.trim() ||
      validatedData.shippingAddress.street?.trim() ||
      'Address';

    if (!payload.items || payload.items.length === 0) {
      return errorResponse('Your cart is empty. Please add shoes before checking out.');
    }

    for (const item of payload.items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        return errorResponse('Item quantity must be a positive whole number.');
      }
    }

    // Derive Authoritative User Identity from Session early (for both MockDb and live DB)
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    const sessionUser = session?.user as { id?: string; email?: string; role?: string } | undefined;
    if (sessionUser?.id) {
      if (payload.userId && payload.userId !== sessionUser.id) {
        return errorResponse('Unauthorized: Session user mismatch.');
      }
      authoritativeUserId = sessionUser.id;
    }

    if (!isDatabaseConnected()) {
      if (!canUseMockDatabase()) {
        return errorResponse('Database connection unavailable. Unable to place order right now.');
      }

      if (cleanIdempotencyKey) {
        const existingMockOrder = MockDb.getAllOrders().find(
          (o) => o.idempotencyKey === cleanIdempotencyKey
        );
        if (existingMockOrder) {
          const isOwner = verifyIdempotencyOrderOwnership(existingMockOrder, {
            authoritativeUserId,
            guestEmail: validatedGuestEmail,
            guestPhone: validatedGuestPhone,
            shippingPhone: validatedShippingPhone,
          });
          if (!isOwner) {
            return errorResponse('Unauthorized: Duplicate idempotency key belongs to another customer.');
          }
          const isGuestOrder = !existingMockOrder.userId || existingMockOrder.userId.toString() === 'guest';
          const guestAccessToken = isGuestOrder
            ? signGuestOrderToken(existingMockOrder._id.toString(), existingMockOrder.orderNumber)
            : undefined;
          return successResponse({
            order: existingMockOrder,
            requiresOtp:
              existingMockOrder.paymentMethod === PaymentMethod.COD &&
              existingMockOrder.totalAmount > COD_MAX_LIMIT_WITHOUT_OTP,
            ...(guestAccessToken ? { guestAccessToken } : {}),
          });
        }
      }

      const orderItems: IOrderItem[] = [];
      const mockProducts: Array<NonNullable<ReturnType<typeof MockDb.getProductById>>> = [];
      const mockDeductions: Array<{
        productId: string;
        size: string;
        color: string;
        sku: string;
        quantity: number;
        isSimpleProduct: boolean;
      }> = [];
      const requestedByMockVariant = new Map<string, number>();
      let totalWeight = 0;

      for (const item of payload.items) {
        const product = MockDb.getProductById(item.productId);
        if (!product || product.isDeleted || product.isActive === false) {
          return errorResponse('One of the selected shoes is no longer available.');
        }

        const { resolved, error } = resolveOrderProductVariant(
          {
            name: product.name,
            sku: product.sku,
            stock: product.stock,
            variants: product.variants as unknown as VariantCandidate[],
          },
          item,
          'checkout'
        );

        if (error || !resolved) {
          return errorResponse(error || `Selected variant is not available for "${product.name}".`);
        }

        const dedupKey = `${product._id.toString()}::${resolved.isSimpleProduct ? 'SIMPLE' : resolved.sku}`;
        const prevRequested = requestedByMockVariant.get(dedupKey) || 0;
        const nextRequested = prevRequested + item.quantity;

        if (resolved.stock < nextRequested) {
          return errorResponse(
            resolved.isSimpleProduct
              ? `Insufficient stock for "${product.name}". Only ${resolved.stock} available.`
              : `Insufficient stock for "${product.name}" in Size ${resolved.size} (${resolved.color}). Only ${resolved.stock} available.`
          );
        }

        requestedByMockVariant.set(dedupKey, nextRequested);
        mockProducts.push(product);
        mockDeductions.push({
          productId: product._id.toString(),
          size: resolved.size,
          color: resolved.color,
          sku: resolved.sku,
          quantity: item.quantity,
          isSimpleProduct: resolved.isSimpleProduct,
        });

        totalWeight += (product.weight || 750) * item.quantity;
        orderItems.push({
          _id: new Types.ObjectId(),
          productId: new Types.ObjectId(item.productId.length === 24 ? item.productId : undefined),
          name: product.name,
          image: product.images?.[0] || '',
          size: resolved.size,
          color: resolved.color,
          quantity: item.quantity,
          price: product.price,
          sku: resolved.sku,
        });
      }

      // Validate coupon BEFORE deducting MockDb stock
      let appliedCouponDoc = null;
      if (validatedData.couponCode && validatedData.couponCode.trim()) {
        const mockCoupon = MockDb.getCoupon(validatedData.couponCode);
        if (!mockCoupon) {
          return errorResponse('Invalid or expired promotional coupon code.');
        }
        const preSubtotal = orderItems.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
        const couponCheck = validateCouponRules(mockCoupon, preSubtotal, mockProducts, true);
        if (!couponCheck.valid) {
          return errorResponse(couponCheck.message || 'Promotional coupon is not eligible for this order.');
        }
        appliedCouponDoc = mockCoupon;
      }

      const pricing = calculateOrderTotals(
        orderItems.map((i) => ({ price: i.price, quantity: i.quantity })),
        validatedData.shippingAddress.city,
        totalWeight,
        appliedCouponDoc
      );

      const requiresOtp = pricing.totalAmount > COD_MAX_LIMIT_WITHOUT_OTP;
      if (requiresOtp) {
        const phoneToVerify = validatedData.shippingAddress.phone || validatedData.guestPhone || '';
        const otpConsume = consumeCodOtpToken(validatedData.codOtpToken, phoneToVerify);
        if (!otpConsume.valid) {
          return errorResponse('Phone verification required for Cash on Delivery orders over PKR 10,000.');
        }
        consumedOtpJti = otpConsume.jti;
      }

      // Deduct MockDb stock after OTP and coupon validation succeed
      for (const ded of mockDeductions) {
        const current = MockDb.getProductById(ded.productId);
        if (!current) continue;
        if (ded.isSimpleProduct) {
          MockDb.updateProduct(ded.productId, {
            stock: Math.max(0, (current.stock || 0) - ded.quantity),
          });
        } else {
          const updatedVariants = (current.variants || []).map((v) =>
            v.sku === ded.sku
              ? { ...v, stock: Math.max(0, (v.stock || 0) - ded.quantity) }
              : v
          );
          const totalVariantStock = updatedVariants.reduce(
            (sum, v) => sum + Math.max(0, v.stock || 0),
            0
          );
          MockDb.updateProduct(ded.productId, {
            variants: updatedVariants,
            stock: totalVariantStock,
          });
        }
      }

      const currentYear = new Date().getFullYear();
      const randomHex = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `OX-${currentYear}-${randomHex}`;

      const city = validatedData.shippingAddress.city.toLowerCase();
      const courier = city.includes('lahore') || city.includes('karachi') ? Courier.TCS : Courier.LEOPARDS;
      const trackingNumber = `TCS-${Math.floor(10000000 + Math.random() * 90000000)}`;

      const newOrder = MockDb.createOrder({
        orderNumber,
        userId: authoritativeUserId || payload.userId || 'guest',
        guestEmail: validatedData.guestEmail || '',
        guestPhone: validatedGuestPhone || '',
        orderItems,
        subtotal: pricing.subtotal,
        discountAmount: pricing.discountAmount,
        couponCode: appliedCouponDoc ? appliedCouponDoc.code : undefined,
        taxAmount: pricing.taxAmount,
        shippingCharges: pricing.shippingCharges,
        totalAmount: pricing.totalAmount,
        shippingAddress: {
          fullName: validatedData.shippingAddress.fullName,
          phone: validatedData.shippingAddress.phone,
          villageAddress: validatedData.shippingAddress.villageAddress || '',
          address: normalizedAddress,
          street: normalizedStreet,
          city: validatedData.shippingAddress.city,
          postalCode: validatedData.shippingAddress.postalCode || '',
          ...(sanitizedCoordinates ? { coordinates: sanitizedCoordinates } : {}),
        },
        status: OrderStatus.CONFIRMED,
        paymentMethod: PaymentMethod.COD,
        paymentStatus: PaymentStatus.PENDING,
        courier,
        trackingNumber,
        notes: validatedData.notes,
        verificationToken: generateVerificationToken(),
        ...(cleanIdempotencyKey ? { idempotencyKey: cleanIdempotencyKey } : {}),
      });

      const isGuestOrder = !newOrder.userId || newOrder.userId.toString() === 'guest';
      const guestAccessToken = isGuestOrder
        ? signGuestOrderToken(newOrder._id.toString(), newOrder.orderNumber)
        : undefined;

      return successResponse({
        order: newOrder,
        requiresOtp,
        ...(guestAccessToken ? { guestAccessToken } : {}),
      });
    }

    // 1b. Check idempotency key in live MongoDB before product/stock mutation
    if (cleanIdempotencyKey && typeof Order.findOne === 'function') {
      const existingOrder = await Order.findOne({ idempotencyKey: cleanIdempotencyKey }).lean();
      if (existingOrder) {
        const isOwner = verifyIdempotencyOrderOwnership(existingOrder, {
          authoritativeUserId,
          guestEmail: validatedGuestEmail,
          guestPhone: validatedGuestPhone,
          shippingPhone: validatedShippingPhone,
        });
        if (!isOwner) {
          return errorResponse('Unauthorized: Duplicate idempotency key belongs to another customer.');
        }
        const isExistingGuest = !existingOrder.userId || existingOrder.userId.toString() === 'guest';
        const guestAccessToken = isExistingGuest
          ? signGuestOrderToken(existingOrder._id.toString(), existingOrder.orderNumber)
          : undefined;
        return successResponse({
          order: JSON.parse(JSON.stringify(existingOrder)),
          requiresOtp:
            existingOrder.paymentMethod === PaymentMethod.COD &&
            existingOrder.totalAmount > COD_MAX_LIMIT_WITHOUT_OTP,
          ...(guestAccessToken ? { guestAccessToken } : {}),
        });
      }
    }

    // 2. Fetch Live Products and Validate Stocks (pre-check ObjectId format)
    const productIds = Array.from(new Set(payload.items.map((i) => i.productId)));
    for (const id of productIds) {
      if (!Types.ObjectId.isValid(id)) {
        return errorResponse('One of the selected shoes is no longer available.');
      }
    }
    const products = await Product.find({ _id: { $in: productIds }, isActive: true, isDeleted: { $ne: true } });
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    const orderItems: IOrderItem[] = [];
    const stockTargets: Array<{
      productId: Types.ObjectId;
      name: string;
      variantId?: Types.ObjectId | string;
      sku: string;
      size: string;
      color: string;
      quantity: number;
      isSimpleProduct: boolean;
    }> = [];
    const requestedByKey = new Map<string, number>();
    let totalWeight = 0;

    for (const item of payload.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return errorResponse(`One of the selected shoes is no longer available.`);
      }

      const { resolved, error } = resolveOrderProductVariant(
        {
          name: product.name,
          sku: product.sku,
          stock: product.stock,
          variants: product.variants as unknown as VariantCandidate[],
        },
        item,
        'checkout'
      );

      if (error || !resolved) {
        return errorResponse(error || `Selected variant is not available for "${product.name}".`);
      }

      const dedupKey = `${product._id.toString()}::${
        resolved.isSimpleProduct ? 'SIMPLE' : resolved.variantId?.toString() || resolved.sku
      }`;
      const cumulativeQty = (requestedByKey.get(dedupKey) || 0) + item.quantity;
      if (resolved.stock < cumulativeQty) {
        return errorResponse(
          resolved.isSimpleProduct
            ? `Insufficient stock for "${product.name}". Only ${resolved.stock} available.`
            : `Insufficient stock for "${product.name}" in Size ${resolved.size} (${resolved.color}). Only ${resolved.stock} available.`
        );
      }
      requestedByKey.set(dedupKey, cumulativeQty);

      totalWeight += (product.weight || 750) * item.quantity;

      orderItems.push({
        _id: new Types.ObjectId(),
        productId: product._id,
        name: product.name,
        image: product.images[0] || '',
        size: resolved.size,
        color: resolved.color,
        quantity: item.quantity,
        price: product.price,
        sku: resolved.sku,
      });

      stockTargets.push({
        productId: product._id,
        name: product.name,
        variantId: resolved.variantId,
        sku: resolved.sku,
        size: resolved.size,
        color: resolved.color,
        quantity: item.quantity,
        isSimpleProduct: resolved.isSimpleProduct,
      });
    }

    const cleanEmail = validatedData.guestEmail?.toLowerCase().trim() || '';
    const cleanPhone = validatedGuestPhone || '';

    // 3. Re-validate Coupon if provided (fail closed if invalid or ineligible)
    let appliedCouponDoc = null;
    if (validatedData.couponCode && validatedData.couponCode.trim()) {
      const couponDoc = await Coupon.findOne({ code: validatedData.couponCode.trim().toUpperCase() });
      if (!couponDoc) {
        return errorResponse('Invalid or expired promotional coupon code.');
      }

      const subtotal = orderItems.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);

      // Per-user limit check
      const query: Record<string, unknown> = { couponId: couponDoc._id };
      if (authoritativeUserId) {
        query.userId = new Types.ObjectId(authoritativeUserId);
      } else {
        const guestConditions: Array<Record<string, string>> = [];
        if (cleanEmail) guestConditions.push({ guestEmail: cleanEmail });
        if (cleanPhone) guestConditions.push({ guestPhone: cleanPhone });

        if (guestConditions.length === 0) {
          return errorResponse('Coupon requires user contact details for limit verification.');
        }

        if (guestConditions.length === 1) {
          Object.assign(query, guestConditions[0]);
        } else {
          query.$or = guestConditions;
        }
      }

      const usageCount = await CouponUsage.countDocuments(query);
      if (usageCount >= couponDoc.perUserLimit) {
        return errorResponse('You have already used this coupon.');
      }

      // First-order check against explicit qualifying order statuses
      let isFirstOrder = true;
      const qualifyingStatuses = [
        OrderStatus.CONFIRMED,
        OrderStatus.PROCESSING,
        OrderStatus.SHIPPED,
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.DELIVERED,
        OrderStatus.RETURNED,
      ];

      let historyFilter: Record<string, unknown> | null = null;
      if (authoritativeUserId) {
        historyFilter = { userId: new Types.ObjectId(authoritativeUserId) };
      } else {
        const guestConditions: Array<Record<string, string>> = [];
        if (cleanEmail) guestConditions.push({ guestEmail: cleanEmail });
        if (cleanPhone) guestConditions.push({ guestPhone: cleanPhone });

        if (guestConditions.length > 0) {
          historyFilter = guestConditions.length === 1 ? guestConditions[0] : { $or: guestConditions };
        } else {
          isFirstOrder = false;
        }
      }

      if (isFirstOrder && historyFilter) {
        const previousOrdersCount = await Order.countDocuments({
          ...historyFilter,
          status: { $in: qualifyingStatuses },
        });
        isFirstOrder = previousOrdersCount === 0;
      }

      const couponCheck = validateCouponRules(couponDoc, subtotal, products, isFirstOrder);
      if (!couponCheck.valid) {
        return errorResponse(couponCheck.message || 'Promotional coupon is not eligible for this order.');
      }
      appliedCouponDoc = couponDoc;
    }

    // 4. Server-Side Accurate Pricing (Subtotal, 17% GST, Shipping Tariffs, Coupon)
    const pricing = calculateOrderTotals(
      orderItems.map((i) => ({ price: i.price, quantity: i.quantity })),
      validatedData.shippingAddress.city,
      totalWeight,
      appliedCouponDoc
    );

    // 5. Check if COD requires OTP (orders > PKR 10,000)
    const requiresOtp = pricing.totalAmount > COD_MAX_LIMIT_WITHOUT_OTP;

    if (requiresOtp) {
      const phoneToVerify = validatedData.shippingAddress.phone || validatedData.guestPhone || '';
      const otpConsume = consumeCodOtpToken(validatedData.codOtpToken, phoneToVerify);
      if (!otpConsume.valid) {
        return errorResponse('Phone verification required for Cash on Delivery orders over PKR 10,000.');
      }
      consumedOtpJti = otpConsume.jti;
    }

    // 6. Generate Order Number: OX-YYYY-XXXX
    const currentYear = new Date().getFullYear();
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `OX-${currentYear}-${randomHex}`;

    // 7. Determine Courier based on region
    const city = validatedData.shippingAddress.city.toLowerCase();
    const courier = city.includes('lahore') || city.includes('karachi') ? Courier.TCS : Courier.LEOPARDS;

    const trackingNumber = `TCS-${Math.floor(10000000 + Math.random() * 90000000)}`;

    // 8. Reserve Capacity, Atomically Decrement Stock FIRST, Then Create Order & Usage
    return await executeWithOptionalTransaction(async (dbSession) => {
      if (!dbSession || !dbSession.inTransaction()) {
        throw new Error('Active MongoDB transaction session is required for order creation.');
      }

      // 8a. Atomic Global Coupon Capacity Reservation
      if (appliedCouponDoc) {
        const hasFiniteLimit = Boolean(appliedCouponDoc.usageLimit && appliedCouponDoc.usageLimit > 0);
        const couponQuery: Record<string, unknown> = {
          _id: appliedCouponDoc._id,
          isActive: true,
        };
        if (hasFiniteLimit) {
          couponQuery.$expr = { $lt: ['$usedCount', '$usageLimit'] };
        }

        const reservedCoupon = await Coupon.findOneAndUpdate(
          couponQuery,
          { $inc: { usedCount: 1 } },
          { session: dbSession, returnDocument: 'after' }
        );

        if (!reservedCoupon) {
          throw new Error('Promotional coupon usage limit has been reached.');
        }
      }

      // 8b. Atomic Inventory Deduction BEFORE Order.create (prevents orphan orders)
      for (const target of stockTargets) {
        let updatedProduct = null;

        if (target.isSimpleProduct) {
          updatedProduct = await Product.findOneAndUpdate(
            { _id: target.productId, stock: { $gte: target.quantity } },
            { $inc: { stock: -target.quantity } },
            { session: dbSession, returnDocument: 'after' }
          );
        } else {
          updatedProduct = await applyAtomicVariantStockDelta({
            productId: target.productId,
            variantId: target.variantId,
            sku: target.sku,
            delta: -target.quantity,
            session: dbSession,
          });
        }

        if (!updatedProduct) {
          throw new Error(
            `Insufficient stock for "${target.name}" (Size: ${target.size}${target.color ? `, Color: ${target.color}` : ''}). Another order may have claimed the remaining units.`
          );
        }
      }

      // 8c. Create Order Document (only after all stock deductions succeed)
      const createOrderDocs = await Order.create(
        [
          {
            orderNumber,
            userId: authoritativeUserId ? new Types.ObjectId(authoritativeUserId) : null,
            guestEmail: validatedData.guestEmail || '',
            guestPhone: validatedGuestPhone || '',
            orderItems,
            subtotal: pricing.subtotal,
            discountAmount: pricing.discountAmount,
            couponCode: appliedCouponDoc ? appliedCouponDoc.code : undefined,
            taxAmount: pricing.taxAmount,
            shippingCharges: pricing.shippingCharges,
            totalAmount: pricing.totalAmount,
            shippingAddress: {
              fullName: validatedData.shippingAddress.fullName,
              phone: validatedData.shippingAddress.phone,
              villageAddress: validatedData.shippingAddress.villageAddress || '',
              address: normalizedAddress,
              street: normalizedStreet,
              city: validatedData.shippingAddress.city,
              postalCode: validatedData.shippingAddress.postalCode || '',
              ...(sanitizedCoordinates ? { coordinates: sanitizedCoordinates } : {}),
            },
            status: OrderStatus.CONFIRMED,
            paymentMethod: PaymentMethod.COD,
            paymentStatus: PaymentStatus.PENDING,
            courier,
            trackingNumber,
            notes: validatedData.notes,
            verificationToken: generateVerificationToken(),
            ...(cleanIdempotencyKey ? { idempotencyKey: cleanIdempotencyKey } : {}),
          },
        ],
        { session: dbSession }
      );

      const newOrder = createOrderDocs[0];

      // 8d. Record Coupon Usage Audit
      if (appliedCouponDoc) {
        const usagePayload: Record<string, unknown> = {
          couponId: appliedCouponDoc._id,
          orderId: newOrder._id,
          discountApplied: pricing.discountAmount,
        };
        if (authoritativeUserId) {
          usagePayload.userId = new Types.ObjectId(authoritativeUserId);
        } else {
          if (cleanEmail) usagePayload.guestEmail = cleanEmail;
          if (cleanPhone) usagePayload.guestPhone = cleanPhone;
        }
        await CouponUsage.create([usagePayload], { session: dbSession });
      }

      const isGuestOrder = !newOrder.userId || newOrder.userId.toString() === 'guest';
      const guestAccessToken = isGuestOrder
        ? signGuestOrderToken(newOrder._id.toString(), newOrder.orderNumber)
        : undefined;

      return successResponse({
        order: JSON.parse(JSON.stringify(newOrder)),
        requiresOtp,
        ...(guestAccessToken ? { guestAccessToken } : {}),
      });
    });
  } catch (error: unknown) {
    if (cleanIdempotencyKey && isIdempotencyDuplicateKeyError(error) && typeof Order.findOne === 'function') {
      try {
        const existingOrder = await Order.findOne({ idempotencyKey: cleanIdempotencyKey }).lean();
        if (existingOrder) {
          const isOwner = verifyIdempotencyOrderOwnership(existingOrder, {
            authoritativeUserId,
            guestEmail: validatedGuestEmail,
            guestPhone: validatedGuestPhone,
            shippingPhone: validatedShippingPhone,
          });
          if (!isOwner) {
            return errorResponse('Unauthorized: Duplicate idempotency key belongs to another customer.');
          }
          const isExistingGuest = !existingOrder.userId || existingOrder.userId.toString() === 'guest';
          const guestAccessToken = isExistingGuest
            ? signGuestOrderToken(existingOrder._id.toString(), existingOrder.orderNumber)
            : undefined;
          return successResponse({
            order: JSON.parse(JSON.stringify(existingOrder)),
            requiresOtp:
              existingOrder.paymentMethod === PaymentMethod.COD &&
              existingOrder.totalAmount > COD_MAX_LIMIT_WITHOUT_OTP,
            ...(guestAccessToken ? { guestAccessToken } : {}),
          });
        }
      } catch {
        // Fall through to handleActionError if lookup also fails
      }
    }
    releaseCodOtpToken(consumedOtpJti);
    return handleActionError(error);
  }
}

export async function getOrderById(
  orderId: string,
  accessToken?: string
): Promise<ActionResult<IOrder>> {
  try {
    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      return errorResponse('Invalid order identifier.');
    }
    const cleanOrderId = orderId.trim();

    await connectToDatabase();

    let orderDoc: (IOrder & { _id: Types.ObjectId | string }) | null = null;
    if (!isDatabaseConnected()) {
      if (!canUseMockDatabase()) {
        return errorResponse('Database connection unavailable.');
      }
      orderDoc = (MockDb.getOrderById(cleanOrderId) as unknown as (IOrder & { _id: Types.ObjectId | string }) | null) || null;
    } else {
      if (Types.ObjectId.isValid(cleanOrderId)) {
        orderDoc = await Order.findById(cleanOrderId).lean();
      }
      if (!orderDoc) {
        orderDoc = await Order.findOne({ orderNumber: cleanOrderId.toUpperCase() }).lean();
      }
    }

    if (!orderDoc) {
      return errorResponse('Order not found.');
    }

    const orderObj = JSON.parse(JSON.stringify(orderDoc)) as IOrder;

    // 1. Guest Access Token Verification (Cryptographic proof of order creation possession, strictly for guest orders)
    const isGuestOrderDoc = !orderDoc.userId || orderDoc.userId.toString() === 'guest';
    if (
      accessToken &&
      isGuestOrderDoc &&
      verifyGuestOrderToken(
        accessToken,
        orderDoc._id.toString(),
        orderDoc.orderNumber
      )
    ) {
      return successResponse(orderObj);
    }

    // 2. Department / Elevated Admin Authorization
    const auth = await verifyDepartmentAuth({
      requiredDepartment: Department.ORDERS,
      requiredPermission: 'orders:read',
    });
    if (auth.authorized) {
      return successResponse(orderObj);
    }

    if (canUseMockDatabase()) {
      const session = await getServerSession(authOptions).catch(() => null);
      if (isElevatedAdminRole((session?.user as { role?: string } | undefined)?.role)) {
        return successResponse(orderObj);
      }
    }

    // 3. Customer Session Ownership Verification
    const session = await getServerSession(authOptions).catch(() => null);
    const sessionUser = session?.user as
      | { id?: string; email?: string; role?: string; isEmailVerified?: boolean }
      | undefined;

    if (!sessionUser) {
      return errorResponse(
        'Unauthenticated: Please sign in or provide a valid access token to view order details.'
      );
    }

    const orderOwnerId = orderDoc.userId?.toString();
    if (orderOwnerId && orderOwnerId === sessionUser.id) {
      return successResponse(orderObj);
    }

    // Verified email match for guest orders
    const sessionEmail = sessionUser.email?.toLowerCase().trim();
    const orderGuestEmail = orderDoc.guestEmail?.toLowerCase().trim();
    if (orderGuestEmail && orderGuestEmail === sessionEmail && sessionUser.isEmailVerified) {
      return successResponse(orderObj);
    }

    return errorResponse("Unauthorized: Cannot access another customer's order.");
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function trackOrder(
  orderNumber: string,
  verificationValue: string
): Promise<ActionResult<ITrackOrderDTO>> {
  try {
    const headerList = await headers();
    const ip = headerList.get('x-forwarded-for') || '127.0.0.1';
    const normalizedOrderNum = orderNumber.trim().toUpperCase();
    const normalizedVerification = verificationValue.trim().toLowerCase();

    if (!normalizedOrderNum || !normalizedVerification) {
      return errorResponse('Order number and verification (email/phone) are required.');
    }

    await connectToDatabase();

    // 1. Rate Limiting Check
    if (isDatabaseConnected()) {
      const attempt = await TrackingAttempt.findOne({ ip, orderNumber: normalizedOrderNum });
      if (attempt && attempt.attempts >= 5) {
        const minutesLeft = Math.ceil(
          (3600 * 1000 - (Date.now() - attempt.lastAttempt.getTime())) / 60000
        );
        if (minutesLeft > 0) {
          return errorResponse(
            `Too many failed attempts. Please try again in ${minutesLeft} minutes.`
          );
        }
      }
    }

    let order = null;

    if (!isDatabaseConnected()) {
      if (!canUseMockDatabase()) {
        return errorResponse('Database connection unavailable.');
      }
      const mockOrder = MockDb.trackOrder(normalizedOrderNum);
      if (mockOrder) {
        order = mockOrder;
      }
    } else {
      order = await Order.findOne({ orderNumber: normalizedOrderNum }).lean();
    }

    if (!order) {
      // Record failed attempt for non-existent order as well to prevent brute force
      if (isDatabaseConnected()) {
        await TrackingAttempt.findOneAndUpdate(
          { ip, orderNumber: normalizedOrderNum },
          { $inc: { attempts: 1 }, $set: { lastAttempt: new Date() } },
          { upsert: true, new: true }
        );
      }
      return errorResponse(
        `No order found matching "${normalizedOrderNum}". Please verify your order number.`
      );
    }

    // 2. Verification Check
    const matchesEmail = order.guestEmail?.toLowerCase().trim() === normalizedVerification;
    const matchesPhone = order.guestPhone?.trim() === normalizedVerification;
    const matchesShippingPhone = order.shippingAddress?.phone?.trim() === normalizedVerification;

    if (!matchesEmail && !matchesPhone && !matchesShippingPhone) {
      if (isDatabaseConnected()) {
        await TrackingAttempt.findOneAndUpdate(
          { ip, orderNumber: normalizedOrderNum },
          { $inc: { attempts: 1 }, $set: { lastAttempt: new Date() } },
          { upsert: true, new: true }
        );
      }
      return errorResponse('Verification failed. Please provide the email or phone used for this order.');
    }

    // 3. Reset attempts on success
    if (isDatabaseConnected()) {
      await TrackingAttempt.deleteOne({ ip, orderNumber: normalizedOrderNum });
    }

    // 4. Return Redacted DTO (No PII)
    const rawDestCoords = order.shippingAddress?.coordinates;
    const validDestCoords =
      rawDestCoords && isValidCoordinatePair(rawDestCoords.lat, rawDestCoords.lng)
        ? {
            lat: rawDestCoords.lat,
            lng: rawDestCoords.lng,
            source: rawDestCoords.source,
          }
        : undefined;

    const isGuestTrackedOrder = !order.userId || order.userId.toString() === 'guest';
    const guestAccessToken = isGuestTrackedOrder
      ? signGuestOrderToken(order._id.toString(), order.orderNumber)
      : undefined;

    const dto: ITrackOrderDTO = {
      _id: order._id.toString(),
      orderNumber: order.orderNumber,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount,
      courier: order.courier,
      trackingNumber: order.trackingNumber,
      destinationCity: order.shippingAddress?.city || undefined,
      ...(validDestCoords ? { destinationCoordinates: validDestCoords } : {}),
      ...(guestAccessToken ? { guestAccessToken } : {}),
      orderItems: order.orderItems.map((item: { name: string; size: string; color: string; quantity: number; price: number }) => ({
        name: item.name,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        price: item.price,
      })),
      createdAt: order.createdAt,
    };

    return successResponse(dto);
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function getUserOrders(userId: string): Promise<ActionResult<IOrder[]>> {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    const sessionUser = session?.user as { id?: string; role?: string } | undefined;
    if (!sessionUser) {
      return errorResponse('Unauthenticated: Please sign in to view orders.');
    }

    const isElevatedAdmin = isElevatedAdminRole(sessionUser.role);
    if (!isElevatedAdmin && userId !== sessionUser.id) {
      return errorResponse("Unauthorized: Cannot access another customer's orders.");
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      if (!canUseMockDatabase()) {
        return errorResponse('Database connection unavailable.');
      }
      const mockOrders = MockDb.getAllOrders().filter(
        (o) => o.userId?.toString() === userId
      );
      return successResponse(mockOrders);
    }

    const orders = await Order.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();
    return successResponse(JSON.parse(JSON.stringify(orders)));
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function getAllOrders(filters?: {
  status?: string;
  paymentStatus?: string;
  search?: string;
  archived?: boolean;
}): Promise<ActionResult<IOrder[]>> {
  try {
    const auth = await verifyDepartmentAuth({
      requiredDepartment: Department.ORDERS,
      requiredPermission: 'orders:read',
    });

    if (!auth.authorized) {
      return errorResponse(auth.error || 'Unauthorized: Orders clearance required.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      if (!canUseMockDatabase()) {
        return errorResponse('Database connection unavailable.');
      }
      return successResponse(MockDb.getAllOrders(filters));
    }

    const query: Record<string, unknown> = {};

    // On main admin orders list, fetch only { archived: false } unless archived filter is requested
    if (filters?.archived === true) {
      query.archived = true;
    } else {
      query.archived = { $ne: true };
    }

    if (filters?.status && filters.status !== 'all') {
      query.status = filters.status;
    }
    if (filters?.paymentStatus && filters.paymentStatus !== 'all') {
      query.paymentStatus = filters.paymentStatus;
    }
    if (filters?.search) {
      const regex = new RegExp(filters.search.trim(), 'i');
      query.$or = [
        { orderNumber: regex },
        { 'shippingAddress.fullName': regex },
        { 'shippingAddress.phone': regex },
        { trackingNumber: regex },
      ];
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return successResponse(JSON.parse(JSON.stringify(orders)));
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function archiveOrder(orderId: string): Promise<ActionResult<IOrder>> {
  try {
    const auth = await verifyDepartmentAuth();
    if (!auth.authorized || !isElevatedAdminRole(auth.role)) {
      return errorResponse(auth.error || 'Unauthorized: Administrative clearance required to archive orders.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      if (!canUseMockDatabase()) {
        return errorResponse('Database connection unavailable. Cannot archive order.');
      }
      const updated = MockDb.archiveOrder(orderId);
      if (!updated) return errorResponse('Order not found.');
      return successResponse(updated, 'Order archived successfully.');
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      { $set: { archived: true } },
      { new: true }
    ).lean();

    if (!order) {
      return errorResponse('Order not found.');
    }

    return successResponse(JSON.parse(JSON.stringify(order)), 'Order archived successfully.');
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function unarchiveOrder(orderId: string): Promise<ActionResult<IOrder>> {
  try {
    const auth = await verifyDepartmentAuth();
    if (!auth.authorized || !isElevatedAdminRole(auth.role)) {
      return errorResponse(auth.error || 'Unauthorized: Administrative clearance required to restore orders.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      if (!canUseMockDatabase()) {
        return errorResponse('Database connection unavailable. Cannot restore order.');
      }
      const updated = MockDb.unarchiveOrder(orderId);
      if (!updated) return errorResponse('Order not found.');
      return successResponse(updated, 'Order restored / unarchived successfully.');
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      { $set: { archived: false } },
      { new: true }
    ).lean();

    if (!order) {
      return errorResponse('Order not found.');
    }

    return successResponse(JSON.parse(JSON.stringify(order)), 'Order restored / unarchived successfully.');
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function updateOrderStatus(
  orderId: string,
  updates: {
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    trackingNumber?: string;
    courier?: Courier | string;
  }
): Promise<ActionResult<IOrder>> {
  try {
    const auth = await verifyDepartmentAuth({
      requiredDepartment: Department.ORDERS,
      requiredPermission: 'orders:update_status',
    });

    if (!auth.authorized) {
      return errorResponse(auth.error || 'Unauthorized: Orders update clearance required.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      if (!canUseMockDatabase()) {
        return errorResponse('Database connection unavailable. Cannot update order status.');
      }
      const updated = MockDb.updateOrderStatus(orderId, updates);
      if (!updated) return errorResponse('Order not found.');
      return successResponse(updated);
    }

    const txResult = await executeWithOptionalTransaction(async (dbSession) => {
      if (!dbSession || !dbSession.inTransaction()) {
        throw new Error('Active MongoDB transaction session is required for order status updates.');
      }

      // Idempotent Restocking: only restock if not already restocked
      let restockedOrderDoc: any = null;
      if (updates.status === OrderStatus.CANCELLED || updates.status === OrderStatus.RETURNED) {
        const orderDoc = await Order.findById(orderId).session(dbSession).lean();
        if (!orderDoc) {
          return errorResponse('Order not found.');
        }

        if (!orderDoc.isRestocked && Array.isArray(orderDoc.orderItems)) {
          // Phase 1: Pre-validate variant identity for all order items using normalized resolver
          const itemsToRestock: Array<{
            productId: string;
            quantity: number;
            variantId?: Types.ObjectId | string;
            sku: string;
            isSimpleProduct: boolean;
          }> = [];

          for (const item of orderDoc.orderItems) {
            const product = await Product.findById(item.productId).session(dbSession).lean();
            if (!product) {
              throw new Error(`Product not found for ID: ${item.productId}`);
            }

            const { resolved, error } = resolveOrderProductVariant(
              {
                name: product.name,
                sku: product.sku,
                stock: product.stock,
                variants: product.variants as unknown as VariantCandidate[],
              },
              {
                sku: item.sku,
                size: item.size,
                color: item.color,
              },
              'restock'
            );

            if (error || !resolved) {
              throw new Error(error || `Cannot identify variant for product "${product.name}".`);
            }

            itemsToRestock.push({
              productId: item.productId.toString(),
              quantity: item.quantity,
              variantId: resolved.variantId,
              sku: resolved.sku,
              isSimpleProduct: resolved.isSimpleProduct,
            });
          }

          // Phase 2: Atomically claim isRestocked flag BEFORE incrementing stock to prevent double-restocking
          restockedOrderDoc = await Order.findOneAndUpdate(
            { _id: orderId, isRestocked: { $ne: true } },
            { $set: { ...updates, isRestocked: true, restockedAt: new Date() } },
            { session: dbSession, returnDocument: 'after' }
          ).lean();

          if (restockedOrderDoc) {
            // Phase 3: Atomically increment variant stock and recalculate parent aggregate stock in one write
            for (const target of itemsToRestock) {
              if (target.isSimpleProduct) {
                const updatedSimple = await Product.findByIdAndUpdate(
                  target.productId,
                  { $inc: { stock: target.quantity } },
                  { session: dbSession, returnDocument: 'after' }
                );
                if (!updatedSimple) {
                  throw new Error(`Failed to restock simple product ${target.productId}.`);
                }
              } else {
                const restoredProd = await applyAtomicVariantStockDelta({
                  productId: target.productId,
                  variantId: target.variantId,
                  sku: target.sku,
                  delta: target.quantity,
                  session: dbSession,
                });
                if (!restoredProd) {
                  throw new Error(`Failed to restock variant (SKU: ${target.sku}) for product ${target.productId}.`);
                }
              }
            }
          }
        }

        // If already restocked previously, still update status/metadata if needed
        if (!restockedOrderDoc) {
          restockedOrderDoc = await Order.findByIdAndUpdate(
            orderId,
            { $set: { ...updates, isRestocked: true, restockedAt: orderDoc.restockedAt || new Date() } },
            { session: dbSession, returnDocument: 'after' }
          ).lean();
        }

        // Phase 4: Cancel referral with session propagation & actor attribution
        await cancelReferralInternal(orderId, dbSession, auth.userId || undefined);
      }

      const updated =
        restockedOrderDoc ||
        (await Order.findByIdAndUpdate(
          orderId,
          { $set: updates },
          { session: dbSession, returnDocument: 'after' }
        ).lean());

      if (!updated) {
        return errorResponse('Order not found.');
      }

      return successResponse(JSON.parse(JSON.stringify(updated)) as IOrder);
    });

    if (!txResult.success) {
      return txResult;
    }

    const updatedOrder = txResult.data;

    if (updates.status === OrderStatus.DELIVERED) {
      const targetUserId = (updatedOrder as unknown as { userId?: unknown }).userId;
      if (targetUserId) {
        try {
          await completeReferralInternal(targetUserId.toString(), orderId);
        } catch (e) {
          console.warn('[Referral] Auto-complete error on delivery:', e);
        }
      }
    }

    // Auto-trigger customer notification only after transaction commits cleanly
    if (updates.status) {
      try {
        const orderNum = (updatedOrder as unknown as { orderNumber?: string }).orderNumber || 'Order';
        const rawUserId = (updatedOrder as unknown as { userId?: unknown }).userId;
        const targetUserId = rawUserId ? rawUserId.toString() : 'guest';
        const shipAddr = (updatedOrder as unknown as { shippingAddress?: { fullName?: string } }).shippingAddress;
        const custName = shipAddr?.fullName || 'Customer';

        let notifTitle = `Order ${updates.status} - OX Shoes`;
        let notifMessage = `Hello ${custName}, your order ${orderNum} status is now ${updates.status}.`;

        if (updates.status === OrderStatus.SHIPPED) {
          notifTitle = `Order ${orderNum} Dispatched! 🚚`;
          notifMessage = `Hello ${custName}, your order ${orderNum} is Shipped via ${(updatedOrder as unknown as { courier?: string }).courier || 'TCS'} with tracking #${(updatedOrder as unknown as { trackingNumber?: string }).trackingNumber || 'assigned'}.`;
        } else if (updates.status === OrderStatus.DELIVERED) {
          notifTitle = `Order ${orderNum} Delivered! 🎉`;
          notifMessage = `Hello ${custName}, your order ${orderNum} is Delivered. Thank you for choosing OX Shoes Pakistan!`;
        }

        await Notification.create({
          userId: targetUserId,
          title: notifTitle,
          message: notifMessage,
          type: NotificationType.ORDER_UPDATE,
          link: `/track?order=${orderNum}`,
          isRead: false,
          createdAt: new Date(),
        });
      } catch (e) {
        console.warn('[OX Notifications] Auto-create notification error:', e);
      }
    }

    return txResult;
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export interface PublicInvoiceVerificationDTO {
  verified: boolean;
  sellerName: string;
  sellerLocation: string;
  maskedInvoiceRef: string;
  verificationTimestamp: string;
}

export async function verifyInvoiceToken(
  token: string
): Promise<ActionResult<PublicInvoiceVerificationDTO>> {
  try {
    const cleanToken = token?.trim().toLowerCase();

    // 1. Format validation: must be a 64-character hex string
    if (!cleanToken || !/^[a-f0-9]{64}$/i.test(cleanToken)) {
      return errorResponse('Invalid or malformed verification token.');
    }

    // 2. Rate limiting check with sanitized client IP extraction
    let ip = '127.0.0.1';
    try {
      const headerList = await headers();
      const forwarded = headerList.get('x-forwarded-for');
      const realIp = headerList.get('x-real-ip') || headerList.get('cf-connecting-ip');
      if (forwarded) {
        ip = forwarded.split(',')[0].trim();
      } else if (realIp) {
        ip = realIp.trim();
      }
    } catch {
      // In CLI test execution outside HTTP request context, default to 127.0.0.1
    }
    // Sanitize IP key to prevent key injection attacks
    const safeIpKey = ip.replace(/[^a-zA-Z0-9_.:-]/g, '_');
    const rateLimitResult = await rateLimit(`verify_inv_${safeIpKey}`, 20, 60000);
    if (!rateLimitResult.success) {
      return errorResponse('Too many verification attempts. Please try again in a minute.');
    }

    await connectToDatabase();

    let foundOrder: any = null;

    if (isDatabaseConnected()) {
      // Direct indexed lookup by persisted verificationToken ONLY (O(1) query)
      foundOrder = await Order.findOne({ verificationToken: cleanToken }).select('orderNumber').lean();
    } else if (canUseMockDatabase()) {
      // Intentional offline local/test MockDb lookup
      const mockOrders = MockDb.getAllOrders();
      foundOrder = mockOrders.find((o: any) => o.verificationToken === cleanToken);
    } else {
      return errorResponse('Database connection unavailable.');
    }

    if (!foundOrder) {
      return errorResponse('Invoice verification failed. Unrecognized or invalid token.');
    }

    // Construct minimal non-PII public verification response
    const orderNumClean = foundOrder.orderNumber
      ? foundOrder.orderNumber.replace('OX-', '')
      : 'ORDER';
    const lastFour = orderNumClean.slice(-4);
    const maskedInvoiceRef = `INV-****-${lastFour}`;

    return successResponse({
      verified: true,
      sellerName: 'Bajaur OX Shoes',
      sellerLocation: 'Inayat Killi Bazar, Bypass Road, District Bajaur, Pakistan',
      maskedInvoiceRef,
      verificationTimestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

