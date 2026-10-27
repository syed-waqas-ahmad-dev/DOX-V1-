/**
 * @file models/Order.ts
 * @description Mongoose schema & model for OX Shoes customer orders.
 * Tailored for Pakistani e-commerce: COD with OTP security, Open-Box Inspection,
 * TCS/Leopards courier status, 17% GST accounting, and compound index querying.
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type HydratedDocument } from 'mongoose';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Courier,
  type IOrder,
  type IOrderItem,
  type IOrderShippingAddress,
  type IOrderPaymentDetails,
} from '@/types';

/**
 * Snapshot schema of each purchased line item
 */
const orderItemSchema = new Schema<IOrderItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
    },
    name: { type: String, required: true, trim: true },
    image: { type: String, required: true },
    size: { type: String, required: true },
    color: { type: String, required: true },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Item price cannot be negative'],
    },
    sku: { type: String, required: true, uppercase: true },
  },
  { _id: true }
);

/**
 * Immutable recipient shipping destination
 */
const orderShippingAddressSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: {
      type: String,
      required: true,
      match: [/^\+923\d{9}$/, 'Must be a valid Pakistani mobile number (+923XXXXXXXXX)'],
    },
    address: { type: String, trim: true, default: '' },
    street: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
  },
  { _id: false }
);

/**
 * Payment transaction record
 */
const orderPaymentDetailsSchema = new Schema<IOrderPaymentDetails>(
  {
    transactionId: { type: String, trim: true },
    gatewayResponse: { type: Schema.Types.Mixed, default: {} },
    receiptUrl: { type: String, trim: true },
  },
  { _id: false }
);

export type OrderDocument = HydratedDocument<IOrder>;
export type OrderModelType = Model<IOrder>;

const orderSchema = new Schema<IOrder, OrderModelType>(
  {
    orderNumber: {
      type: String,
      unique: true,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    guestEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    guestPhone: {
      type: String,
      trim: true,
    },
    orderItems: {
      type: [orderItemSchema],
      required: [true, 'Order must contain at least one item'],
      validate: {
        validator: (v: IOrderItem[]) => Array.isArray(v) && v.length > 0,
        message: 'Order must have at least one line item',
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: [0, 'Subtotal cannot be negative'],
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, 'Discount amount cannot be negative'],
    },
    couponCode: {
      type: String,
      uppercase: true,
      trim: true,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: [0, 'Tax amount cannot be negative'],
    },
    shippingCharges: {
      type: Number,
      default: 0,
      min: [0, 'Shipping charges cannot be negative'],
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Total amount cannot be negative'],
    },
    shippingAddress: {
      type: orderShippingAddressSchema,
      required: [true, 'Shipping address is required'],
    },
    status: {
      type: String,
      enum: {
        values: Object.values(OrderStatus),
        message: '{VALUE} is not a valid order status',
      },
      default: OrderStatus.PENDING,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: {
        values: Object.values(PaymentMethod),
        message: '{VALUE} is not a valid payment method',
      },
      required: [true, 'Payment method is required'],
    },
    paymentStatus: {
      type: String,
      enum: {
        values: Object.values(PaymentStatus),
        message: '{VALUE} is not a valid payment status',
      },
      default: PaymentStatus.PENDING,
      index: true,
    },
    paymentDetails: {
      type: orderPaymentDetailsSchema,
      default: {},
    },
    trackingNumber: {
      type: String,
      trim: true,
      index: true,
    },
    courier: {
      type: String,
      trim: true,
    },
    estimatedDelivery: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    codOtp: {
      type: String,
      select: false, // Hidden by default for COD anti-fraud
    },
    codOtpExpiry: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
    adminNotes: {
      type: String,
      trim: true,
    },
    invoiceUrl: {
      type: String,
      trim: true,
    },
    archived: {
      type: Boolean,
      default: false,
    },
    riderId: {
      type: Schema.Types.ObjectId,
      ref: 'DeliveryPartner',
      default: null,
      index: true,
    },
    riderStatus: {
      type: String,
      enum: ['pending', 'assigned', 'out_for_delivery', 'delivered', 'failed'],
      default: 'pending',
      index: true,
    },
    lastUpdatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    version: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// High-frequency Compound Indexes
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, createdAt: -1 });
orderSchema.index({ courier: 1, trackingNumber: 1 });
orderSchema.index({ archived: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });

/**
 * Pre-save middleware: Generate OX-YYYY-XXXX order number and calculate total
 */
orderSchema.pre('save', function () {
  if (!this.orderNumber) {
    const year = new Date().getFullYear();
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    this.orderNumber = `OX-${year}-${randomHex}`;
  }

  // Calculate 17% Pakistani GST on taxable subtotal if not preset
  if (this.taxAmount === 0 && this.subtotal > 0) {
    this.taxAmount = Math.round(this.subtotal * 0.17);
  }

  // Auto-calculate final total amount
  this.totalAmount = Math.max(
    0,
    this.subtotal - this.discountAmount + this.taxAmount + this.shippingCharges
  );
});

export const Order: OrderModelType =
  (models.Order as OrderModelType) || model<IOrder, OrderModelType>('Order', orderSchema);

export default Order;
