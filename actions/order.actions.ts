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
import { OrderStatus, PaymentMethod, PaymentStatus, Courier, type IOrder, type IOrderItem, NotificationType, type CreateOrderPayload } from '@/types';
import { Types } from 'mongoose';
import { cancelReferral } from './referral.actions';

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

      // Check stock
      if (product.stock < item.quantity) {
        return errorResponse(`Insufficient stock for "${product.name}". Only ${product.stock} available.`);
      }

      totalWeight += (product.weight || 750) * item.quantity;

      orderItems.push({
        _id: new Types.ObjectId(),
        productId: product._id,
        name: product.name,
        image: product.images[0] || '',
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        price: product.price,
        sku: `${product.sku}-${item.size}-${item.color.slice(0, 3).toUpperCase()}`,
      });
    }

    // 3. Re-validate Coupon if provided
    let appliedCouponDoc = null;
    if (validatedData.couponCode) {
      const couponDoc = await Coupon.findOne({ code: validatedData.couponCode.trim().toUpperCase() });
      if (couponDoc) {
        const subtotal = orderItems.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
        const couponCheck = validateCouponRules(couponDoc, subtotal, products);
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

    // 8. Create Order Document
    const newOrder = await Order.create({
      orderNumber,
      userId: payload.userId ? new Types.ObjectId(payload.userId) : null,
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

    // 9. Decrement Inventory Atomic
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity },
      });
    }

    // 10. Record Coupon Usage if coupon was applied
    if (appliedCouponDoc) {
      await Coupon.findByIdAndUpdate(appliedCouponDoc._id, { $inc: { usedCount: 1 } });
      if (payload.userId) {
        await CouponUsage.create({
          couponId: appliedCouponDoc._id,
          userId: new Types.ObjectId(payload.userId),
          orderId: newOrder._id,
          discountApplied: pricing.discountAmount,
        });
      }
    }

    return successResponse({
      order: JSON.parse(JSON.stringify(newOrder)),
      requiresOtp,
    });
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function getOrderById(orderId: string): Promise<ActionResult<IOrder>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const mockOrder = MockDb.getOrderById(orderId);
      if (mockOrder) return successResponse(mockOrder);
      return errorResponse('Order not found.');
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      const mockOrder = MockDb.getOrderById(orderId);
      if (mockOrder) return successResponse(mockOrder);
      return errorResponse('Order not found.');
    }
    return successResponse(JSON.parse(JSON.stringify(order)));
  } catch (error: unknown) {
    const mockOrder = MockDb.getOrderById(orderId);
    if (mockOrder) return successResponse(mockOrder);
    return handleActionError(error);
  }
}

export async function trackOrder(orderNumber: string): Promise<ActionResult<IOrder>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const mockOrder = MockDb.trackOrder(orderNumber);
      if (mockOrder) return successResponse(mockOrder);
      return errorResponse(`No order found matching "${orderNumber}". Please verify your order number.`);
    }

    const order = await Order.findOne({ orderNumber: orderNumber.trim().toUpperCase() }).lean();
    if (!order) {
      const mockOrder = MockDb.trackOrder(orderNumber);
      if (mockOrder) return successResponse(mockOrder);
      return errorResponse(`No order found matching "${orderNumber}". Please verify your order number.`);
    }
    return successResponse(JSON.parse(JSON.stringify(order)));
  } catch (error: unknown) {
    const mockOrder = MockDb.trackOrder(orderNumber);
    if (mockOrder) return successResponse(mockOrder);
    return handleActionError(error);
  }
}

export async function getUserOrders(userId: string): Promise<ActionResult<IOrder[]>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      return successResponse(MockDb.getAllOrders());
    }

    const orders = await Order.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();
    return successResponse(JSON.parse(JSON.stringify(orders)));
  } catch (error: unknown) {
    return successResponse(MockDb.getAllOrders());
  }
}

export async function getAllOrders(filters?: {
  status?: string;
  paymentStatus?: string;
  search?: string;
  archived?: boolean;
}): Promise<ActionResult<IOrder[]>> {
  try {
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
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const updated = MockDb.updateOrderStatus(orderId, updates);
      if (!updated) return errorResponse('Order not found.');
      return successResponse(updated);
    }

    const updated = await Order.findByIdAndUpdate(orderId, { $set: updates }, { new: true }).lean();
    if (!updated) {
      const mockUpdated = MockDb.updateOrderStatus(orderId, updates);
      if (mockUpdated) return successResponse(mockUpdated);
      return errorResponse('Order not found.');
    }

    // Cancel referral if order is cancelled or returned
    if (updates.status === OrderStatus.CANCELLED || updates.status === OrderStatus.RETURNED) {
      await cancelReferral(orderId);
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
  } catch (error: unknown) {
    const mockUpdated = MockDb.updateOrderStatus(orderId, updates);
    if (mockUpdated) return successResponse(mockUpdated);
    return handleActionError(error);
  }
}
