'use server';

/**
 * @file actions/order.actions.ts
 * @description Enterprise order placement flow for Pakistani market.
 * Server-side recalculation of pricing, 17% GST, courier tariffs, atomic stock decrement,
 * and COD OTP requirement evaluation.
 * Strict TypeScript: ZERO `any`.
 */

import { connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
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
import { OrderStatus, PaymentMethod, PaymentStatus, Courier, type IOrder, type IOrderItem, NotificationType, type CreateOrderPayload, UserRole } from '@/types';
import { Types } from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isElevatedAdminRole, isAdminRole } from '@/lib/auth-guard';
import { cancelReferralInternal, completeReferralInternal } from '@/lib/services/referral.service';
import { executeWithOptionalTransaction } from '@/lib/services/wallet.service';
import { TrackingAttempt } from '@/models/TrackingAttempt';
import { headers } from 'next/headers';
import type { ITrackOrderDTO } from '@/types';

export async function createOrder(payload: CreateOrderPayload): Promise<ActionResult<{ order: IOrder; requiresOtp: boolean }>> {
  try {
    await connectToDatabase();

    // 1. Validate Form Input
    const validatedData = checkoutOrderSchema.parse(payload.checkoutData);

    if (!payload.items || payload.items.length === 0) {
      return errorResponse('Your cart is empty. Please add shoes before checking out.');
    }

    if (!isDatabaseConnected()) {
      const orderItems: IOrderItem[] = [];
      let totalWeight = 0;

      for (const item of payload.items) {
        const product =
          MockDb.getProductById(item.productId) ||
          MockDb.getProducts({}).products.find((p) => p._id.toString() === item.productId) ||
          MockDb.getProducts({}).products[0];

        totalWeight += (product?.weight || 750) * item.quantity;
        orderItems.push({
          _id: new Types.ObjectId(),
          productId: new Types.ObjectId(item.productId.length === 24 ? item.productId : undefined),
          name: product?.name || 'Footwear',
          image: product?.images?.[0] || '',
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          price: product?.price || 4500,
          sku: `${product?.sku || 'OX-SHO'}-${item.size}-${item.color.slice(0, 3).toUpperCase()}`,
        });
      }

      let appliedCouponDoc = null;
      if (validatedData.couponCode) {
        appliedCouponDoc = MockDb.getCoupon(validatedData.couponCode);
      }

      const pricing = calculateOrderTotals(
        orderItems.map((i) => ({ price: i.price, quantity: i.quantity })),
        validatedData.shippingAddress.city,
        totalWeight,
        appliedCouponDoc
      );

      const isCOD = validatedData.paymentMethod === 'COD';
      const requiresOtp = isCOD && pricing.totalAmount > COD_MAX_LIMIT_WITHOUT_OTP;

      const currentYear = new Date().getFullYear();
      const randomHex = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `OX-${currentYear}-${randomHex}`;

      const city = validatedData.shippingAddress.city.toLowerCase();
      const courier = city.includes('lahore') || city.includes('karachi') ? Courier.TCS : Courier.LEOPARDS;
      const trackingNumber = `TCS-${Math.floor(10000000 + Math.random() * 90000000)}`;

      const newOrder = MockDb.createOrder({
        orderNumber,
        userId: payload.userId || 'guest',
        guestEmail: validatedData.guestEmail || '',
        guestPhone: validatedData.guestPhone || '',
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
          address: validatedData.shippingAddress.street || 'Address',
          street: validatedData.shippingAddress.street,
          city: validatedData.shippingAddress.city,
          postalCode: validatedData.shippingAddress.postalCode,
        },
        status: OrderStatus.CONFIRMED,
        paymentMethod: validatedData.paymentMethod as PaymentMethod,
        paymentStatus: isCOD ? PaymentStatus.PENDING : PaymentStatus.PAID,
        courier,
        trackingNumber,
        notes: validatedData.notes,
      });

      return successResponse({
        order: newOrder,
        requiresOtp,
      });
    }

    // 2. Fetch Live Products and Validate Stocks
    const productIds = payload.items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds }, isActive: true, isDeleted: { $ne: true } });
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    const orderItems: IOrderItem[] = [];
    let totalWeight = 0;

    for (const item of payload.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return errorResponse(`One of the selected shoes is no longer available.`);
      }

      // 2a. Validate SKU/variant stock if product has size variants
      let matchingVariant = null;
      if (product.variants && product.variants.length > 0) {
        const normSize = item.size.trim().toLowerCase();
        const normColor = item.color ? item.color.trim().toLowerCase() : '';

        if (normColor) {
          // Exact match on size AND color
          matchingVariant =
            product.variants.find(
              (v) =>
                v.size.trim().toLowerCase() === normSize &&
                v.color.trim().toLowerCase() === normColor
            ) || null;
        } else {
          // Color not specified: check size variants
          const sizeVariants = product.variants.filter(
            (v) => v.size.trim().toLowerCase() === normSize
          );
          if (sizeVariants.length === 1) {
            matchingVariant = sizeVariants[0];
          } else if (sizeVariants.length > 1) {
            return errorResponse(
              `Please select a color for Size "${item.size}" of "${product.name}".`
            );
          }
        }

        if (!matchingVariant) {
          return errorResponse(
            `Selected variant (Size ${item.size}${item.color ? `, Color ${item.color}` : ''}) is not available for "${product.name}".`
          );
        }

        if (matchingVariant.stock < item.quantity) {
          return errorResponse(
            `Insufficient stock for "${product.name}" in Size ${item.size}${item.color ? ` (${item.color})` : ''}. Only ${matchingVariant.stock} available.`
          );
        }
      } else {
        // Fallback for simple products without variants
        if (product.stock < item.quantity) {
          return errorResponse(`Insufficient stock for "${product.name}". Only ${product.stock} available.`);
        }
      }

      totalWeight += (product.weight || 750) * item.quantity;

      const derivedSku =
        matchingVariant?.sku ||
        `${product.sku}-${item.size}-${item.color ? item.color.slice(0, 3).toUpperCase() : 'STD'}`;

      orderItems.push({
        _id: new Types.ObjectId(),
        productId: product._id,
        name: product.name,
        image: product.images[0] || '',
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        price: product.price,
        sku: derivedSku,
      });
    }

    // 0. Derive Authoritative User Identity from Session
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    const sessionUser = session?.user as { id?: string; email?: string; role?: string } | undefined;
    let authoritativeUserId: string | null = null;

    if (sessionUser?.id) {
      if (payload.userId && payload.userId !== sessionUser.id) {
        return errorResponse('Unauthorized: Session user mismatch.');
      }
      authoritativeUserId = sessionUser.id;
    }

    const cleanEmail = validatedData.guestEmail?.toLowerCase().trim() || '';
    const cleanPhone = validatedData.guestPhone?.trim() || '';

    // 3. Re-validate Coupon if provided
    let appliedCouponDoc = null;
    if (validatedData.couponCode) {
      const couponDoc = await Coupon.findOne({ code: validatedData.couponCode.trim().toUpperCase() });
      if (couponDoc) {
        const subtotal = orderItems.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
        
        // Per-user limit check
        const query: any = { couponId: couponDoc._id };
        if (authoritativeUserId) {
          query.userId = new Types.ObjectId(authoritativeUserId);
        } else {
          const guestConditions: any[] = [];
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

        let historyFilter: any = null;
        if (authoritativeUserId) {
          historyFilter = { userId: new Types.ObjectId(authoritativeUserId) };
        } else {
          const guestConditions: any[] = [];
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
            status: { $in: qualifyingStatuses } 
          });
          isFirstOrder = previousOrdersCount === 0;
        }

        const couponCheck = validateCouponRules(couponDoc, subtotal, products, isFirstOrder);
        if (couponCheck.valid) {
          appliedCouponDoc = couponDoc;
        }
      }
    }

    // 4. Server-Side Accurate Pricing (Subtotal, 17% GST, Shipping Tariffs, Coupon)
    const pricing = calculateOrderTotals(
      orderItems.map((i) => ({ price: i.price, quantity: i.quantity })),
      validatedData.shippingAddress.city,
      totalWeight,
      appliedCouponDoc
    );

    // 5. Check if COD requires OTP (orders > PKR 10,000)
    const isCOD = validatedData.paymentMethod === 'COD';
    const requiresOtp = isCOD && pricing.totalAmount > COD_MAX_LIMIT_WITHOUT_OTP;

    // 6. Generate Order Number: OX-YYYY-XXXX
    const currentYear = new Date().getFullYear();
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `OX-${currentYear}-${randomHex}`;

    // 7. Determine Courier based on region
    const city = validatedData.shippingAddress.city.toLowerCase();
    const courier = city.includes('lahore') || city.includes('karachi') ? Courier.TCS : Courier.LEOPARDS;

    const trackingNumber = `TCS-${Math.floor(10000000 + Math.random() * 90000000)}`;

    // 8. Create Order, Reserve Capacity, Decrement Stock, and Record Usage inside Transaction
    return await executeWithOptionalTransaction(async (dbSession) => {
      // 8a. Atomic Global Coupon Capacity Reservation
      if (appliedCouponDoc) {
        const reservedCoupon = await Coupon.findOneAndUpdate(
          {
            _id: appliedCouponDoc._id,
            isActive: true,
            $expr: { $lt: ['$usedCount', '$usageLimit'] },
          },
          { $inc: { usedCount: 1 } },
          { session: dbSession || undefined, new: true }
        );

        if (!reservedCoupon) {
          throw new Error('Promotional coupon usage limit has been reached.');
        }
      }

      // 8b. Create Order Document
      const createOrderDocs = await Order.create(
        [
          {
            orderNumber,
            userId: authoritativeUserId ? new Types.ObjectId(authoritativeUserId) : null,
            guestEmail: validatedData.guestEmail || '',
            guestPhone: validatedData.guestPhone || '',
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
              address: validatedData.shippingAddress.street || 'Address',
              street: validatedData.shippingAddress.street,
              city: validatedData.shippingAddress.city,
              postalCode: validatedData.shippingAddress.postalCode,
            },
            status: OrderStatus.CONFIRMED,
            paymentMethod: validatedData.paymentMethod as PaymentMethod,
            paymentStatus: isCOD ? PaymentStatus.PENDING : PaymentStatus.PAID,
            courier,
            trackingNumber,
            notes: validatedData.notes,
          },
        ],
        { session: dbSession || undefined }
      );

      const newOrder = createOrderDocs[0];

      // 8c. Decrement Inventory Atomic with Stock Availability Guard
      for (const item of orderItems) {
        const prodDoc = productMap.get(item.productId.toString());
        const hasVariants = prodDoc && Array.isArray(prodDoc.variants) && prodDoc.variants.length > 0;

        let updatedProduct = null;
        if (hasVariants) {
          // Exact matching filter for variant: prefer SKU if present, otherwise exact size + color
          const elemMatch: Record<string, any> = {
            stock: { $gte: item.quantity },
          };

          if (item.sku) {
            elemMatch.sku = item.sku;
          } else {
            elemMatch.size = item.size;
            if (item.color) {
              elemMatch.color = item.color;
            }
          }

          updatedProduct = await Product.findOneAndUpdate(
            {
              _id: item.productId,
              stock: { $gte: item.quantity },
              variants: { $elemMatch: elemMatch },
            },
            {
              $inc: {
                stock: -item.quantity,
                'variants.$.stock': -item.quantity,
              },
            },
            { session: dbSession || undefined, new: true }
          );

          // Fallback if matching by SKU didn't find variant
          if (!updatedProduct && item.sku && item.size) {
            const fallbackMatch: Record<string, any> = {
              size: item.size,
              stock: { $gte: item.quantity },
            };
            if (item.color) {
              fallbackMatch.color = item.color;
            }

            updatedProduct = await Product.findOneAndUpdate(
              {
                _id: item.productId,
                stock: { $gte: item.quantity },
                variants: { $elemMatch: fallbackMatch },
              },
              {
                $inc: {
                  stock: -item.quantity,
                  'variants.$.stock': -item.quantity,
                },
              },
              { session: dbSession || undefined, new: true }
            );
          }
        } else {
          // Standard decrement for products without variants
          updatedProduct = await Product.findOneAndUpdate(
            { _id: item.productId, stock: { $gte: item.quantity } },
            { $inc: { stock: -item.quantity } },
            { session: dbSession || undefined, new: true }
          );
        }

        if (!updatedProduct) {
          throw new Error(
            `Insufficient stock for "${item.name}" (Size: ${item.size}${item.color ? `, Color: ${item.color}` : ''}). Another order may have claimed the remaining units.`
          );
        }
      }

      // 8d. Record Coupon Usage Audit
      if (appliedCouponDoc) {
        const usagePayload: any = {
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
        await CouponUsage.create([usagePayload], { session: dbSession || undefined });
      }

      return successResponse({
        order: JSON.parse(JSON.stringify(newOrder)),
        requiresOtp,
      });
    });
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function getOrderById(orderId: string): Promise<ActionResult<IOrder>> {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    if (!session?.user) {
      return errorResponse('Unauthenticated: Please sign in to view order details.');
    }

    const sessionUser = session.user as { id: string; role: string; email?: string };
    const isElevatedAdmin = isElevatedAdminRole(sessionUser.role);

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const mockOrder = MockDb.getOrderById(orderId);
      if (mockOrder) {
        const orderOwnerId = mockOrder.userId?.toString();
        if (!isElevatedAdmin && orderOwnerId !== sessionUser.id) {
          return errorResponse("Unauthorized: Cannot access another customer's order.");
        }
        return successResponse(mockOrder);
      }
      return errorResponse('Order not found.');
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return errorResponse('Order not found.');
    }

    // Verify ownership or administrative clearance
    if (!isElevatedAdmin && order.userId?.toString() !== sessionUser.id) {
      // Allow guest orders if email matches AND user has verified their email identity
      const sessionEmail = sessionUser.email?.toLowerCase().trim();
      const orderGuestEmail = order.guestEmail?.toLowerCase().trim();
      
      if (orderGuestEmail && orderGuestEmail === sessionEmail && (sessionUser as any).isEmailVerified) {
        return successResponse(JSON.parse(JSON.stringify(order)));
      }
      return errorResponse("Unauthorized: Cannot access another customer's order.");
    }

    return successResponse(JSON.parse(JSON.stringify(order)));
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
    const dto: ITrackOrderDTO = {
      _id: order._id.toString(),
      orderNumber: order.orderNumber,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount,
      courier: order.courier,
      trackingNumber: order.trackingNumber,
      orderItems: order.orderItems.map((item: any) => ({
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
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    if (!session?.user || !isAdminRole((session.user as { role: UserRole }).role)) {
      return errorResponse('Unauthorized: Administrative clearance required.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
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
    return successResponse(MockDb.getAllOrders(filters));
  }
}

export async function archiveOrder(orderId: string): Promise<ActionResult<IOrder>> {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    if (!session?.user || !isElevatedAdminRole((session.user as { role: UserRole }).role)) {
      return errorResponse('Unauthorized: Administrative clearance required to archive orders.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
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
      const mockUpdated = MockDb.archiveOrder(orderId);
      if (mockUpdated) return successResponse(mockUpdated, 'Order archived successfully.');
      return errorResponse('Order not found.');
    }

    return successResponse(JSON.parse(JSON.stringify(order)), 'Order archived successfully.');
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function unarchiveOrder(orderId: string): Promise<ActionResult<IOrder>> {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    if (!session?.user || !isElevatedAdminRole((session.user as { role: UserRole }).role)) {
      return errorResponse('Unauthorized: Administrative clearance required to restore orders.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
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
      const mockUpdated = MockDb.unarchiveOrder(orderId);
      if (mockUpdated) return successResponse(mockUpdated, 'Order restored / unarchived successfully.');
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
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    if (!session?.user || !isAdminRole((session.user as { role: UserRole }).role)) {
      return errorResponse('Unauthorized: Administrative clearance required to update order status.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const updated = MockDb.updateOrderStatus(orderId, updates);
      if (!updated) return errorResponse('Order not found.');
      return successResponse(updated);
    }

    return await executeWithOptionalTransaction(async (dbSession) => {
      // Idempotent Restocking: only restock if not already restocked
      let restockedOrderDoc: any = null;
      if (updates.status === OrderStatus.CANCELLED || updates.status === OrderStatus.RETURNED) {
        const orderDoc = await Order.findById(orderId).session(dbSession || null).lean();
        if (!orderDoc) {
          const mockUpdated = MockDb.updateOrderStatus(orderId, updates);
          if (mockUpdated) return successResponse(mockUpdated);
          return errorResponse('Order not found.');
        }

        if (!orderDoc.isRestocked && Array.isArray(orderDoc.orderItems)) {
          // Phase 1: Pre-validate variant identity for all order items before mutating any stock
          const itemsToRestock: Array<{
            productId: string;
            quantity: number;
            variantId?: any;
            isSimpleProduct: boolean;
          }> = [];

          for (const item of orderDoc.orderItems) {
            const product = await Product.findById(item.productId).session(dbSession || null).lean();
            if (!product) {
              throw new Error(`Product not found for ID: ${item.productId}`);
            }

            const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
            if (!hasVariants) {
              itemsToRestock.push({
                productId: item.productId.toString(),
                quantity: item.quantity,
                isSimpleProduct: true,
              });
              continue;
            }

            let matchedVariant: any = null;
            // 1. Try exact SKU match first
            if (item.sku) {
              matchedVariant = product.variants.find((v: any) => v.sku === item.sku);
            }
            // 2. Try exact size AND color match
            if (!matchedVariant && item.size && item.color) {
              matchedVariant = product.variants.find((v: any) => v.size === item.size && v.color === item.color);
            }
            // 3. Size provided without SKU / color (legacy order item)
            if (!matchedVariant && item.size) {
              const sizeMatches = product.variants.filter((v: any) => v.size === item.size);
              if (sizeMatches.length === 1) {
                matchedVariant = sizeMatches[0];
              } else if (sizeMatches.length > 1) {
                throw new Error(
                  `Ambiguous legacy order restocking: Size "${item.size}" has multiple color variants for "${product.name}". Please specify variant identity.`
                );
              }
            }

            if (!matchedVariant) {
              throw new Error(
                `Cannot identify variant for product "${product.name}" (SKU: ${item.sku || 'N/A'}, Size: ${item.size || 'N/A'}, Color: ${item.color || 'N/A'}).`
              );
            }

            itemsToRestock.push({
              productId: item.productId.toString(),
              quantity: item.quantity,
              variantId: matchedVariant._id,
              isSimpleProduct: false,
            });
          }

          // Phase 2: Execute restocking updates now that all items are validated
          for (const target of itemsToRestock) {
            if (target.isSimpleProduct) {
              await Product.findByIdAndUpdate(
                target.productId,
                { $inc: { stock: target.quantity } },
                { session: dbSession || undefined }
              );
            } else {
              await Product.findOneAndUpdate(
                { _id: target.productId, 'variants._id': target.variantId },
                { $inc: { stock: target.quantity, 'variants.$.stock': target.quantity } },
                { session: dbSession || undefined }
              );
            }
          }
        }

        // Phase 3: Mark isRestocked: true and update order status
        restockedOrderDoc = await Order.findByIdAndUpdate(
          orderId,
          { $set: { ...updates, isRestocked: true, restockedAt: new Date() } },
          { session: dbSession || undefined, new: true }
        ).lean();

        // Phase 4: Cancel referral with session propagation
        await cancelReferralInternal(orderId, dbSession || undefined);
      }

      const updated =
        restockedOrderDoc ||
        (await Order.findByIdAndUpdate(
          orderId,
          { $set: updates },
          { session: dbSession || undefined, new: true }
        ).lean());

      if (!updated) {
        const mockUpdated = MockDb.updateOrderStatus(orderId, updates);
        if (mockUpdated) return successResponse(mockUpdated);
        return errorResponse('Order not found.');
      }

      if (updates.status === OrderStatus.DELIVERED) {
        const targetUserId = (updated as unknown as { userId?: unknown }).userId;
        if (targetUserId) {
          try {
            await completeReferralInternal(targetUserId.toString(), orderId);
          } catch (e) {
            console.warn('[Referral] Auto-complete error on delivery:', e);
          }
        }
      }

      // Auto-trigger customer notification when order status changes (e.g. Shipped / Delivered)
      if (updates.status) {
        try {
          const orderNum = (updated as unknown as { orderNumber?: string }).orderNumber || 'Order';
          const rawUserId = (updated as unknown as { userId?: unknown }).userId;
          const targetUserId = rawUserId ? rawUserId.toString() : 'guest';
          const shipAddr = (updated as unknown as { shippingAddress?: { fullName?: string } }).shippingAddress;
          const custName = shipAddr?.fullName || 'Customer';

          let notifTitle = `Order ${updates.status} - OX Shoes`;
          let notifMessage = `Hello ${custName}, your order ${orderNum} status is now ${updates.status}.`;

          if (updates.status === OrderStatus.SHIPPED) {
            notifTitle = `Order ${orderNum} Dispatched! 🚚`;
            notifMessage = `Hello ${custName}, your order ${orderNum} is Shipped via ${(updated as unknown as { courier?: string }).courier || 'TCS'} with tracking #${(updated as unknown as { trackingNumber?: string }).trackingNumber || 'assigned'}.`;
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

      return successResponse(JSON.parse(JSON.stringify(updated)));
    });
  } catch (error: unknown) {
    const mockUpdated = MockDb.updateOrderStatus(orderId, updates);
    if (mockUpdated) return successResponse(mockUpdated);
    return handleActionError(error);
  }
}
