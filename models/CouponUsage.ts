/**
 * @file models/CouponUsage.ts
 * @description Mongoose schema & model for audit tracking of applied vouchers.
 * Enforces strict per-user and per-order coupon uniqueness constraints.
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type HydratedDocument } from 'mongoose';
import { type ICouponUsage } from '@/types';

export type CouponUsageDocument = HydratedDocument<ICouponUsage>;
export type CouponUsageModelType = Model<ICouponUsage>;

const couponUsageSchema = new Schema<ICouponUsage, CouponUsageModelType>(
  {
    couponId: {
      type: Schema.Types.ObjectId,
      ref: 'Coupon',
      required: [true, 'Coupon reference is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order reference is required'],
      index: true,
    },
    discountApplied: {
      type: Number,
      required: [true, 'Discount amount applied in PKR is required'],
      min: [0, 'Discount applied cannot be negative'],
    },
    usedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Unique Index: Prevents duplicate coupon applications on the same order
couponUsageSchema.index({ couponId: 1, userId: 1, orderId: 1 }, { unique: true });
couponUsageSchema.index({ couponId: 1, userId: 1 });

export const CouponUsage: CouponUsageModelType =
  (models.CouponUsage as CouponUsageModelType) ||
  model<ICouponUsage, CouponUsageModelType>('CouponUsage', couponUsageSchema);

export default CouponUsage;
