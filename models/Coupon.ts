/**
 * @file models/Coupon.ts
 * @description Mongoose schema & model for promotional discounts, Eid offers,
 * and first-order vouchers in OX Shoes Pakistan.
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type HydratedDocument } from 'mongoose';
import { CouponType, ProductCategory, ProductBrand, type ICoupon } from '@/types';

export type CouponDocument = HydratedDocument<ICoupon>;
export type CouponModelType = Model<ICoupon>;

const couponSchema = new Schema<ICoupon, CouponModelType>(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [3, 'Code must be at least 3 characters'],
      maxlength: [30, 'Code cannot exceed 30 characters'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: Object.values(CouponType),
        message: '{VALUE} is not a valid coupon type',
      },
      required: [true, 'Coupon discount type is required'],
    },
    value: {
      type: Number,
      required: [true, 'Discount value is required (percentage or PKR amount)'],
      min: [0, 'Discount value cannot be negative'],
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: [0, 'Minimum order amount cannot be negative'],
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
      min: [0, 'Maximum discount cap cannot be negative'],
    },
    usageLimit: {
      type: Number,
      default: 1000,
      min: [1, 'Usage limit must be at least 1'],
    },
    usedCount: {
      type: Number,
      default: 0,
      min: [0, 'Used count cannot be negative'],
    },
    perUserLimit: {
      type: Number,
      default: 1,
      min: [1, 'Per-user limit must be at least 1'],
    },
    applicableCategories: {
      type: [String],
      enum: Object.values(ProductCategory),
      default: [],
    },
    applicableBrands: {
      type: [String],
      enum: Object.values(ProductBrand),
      default: [],
    },
    isFirstOrderOnly: {
      type: Boolean,
      default: false,
    },
    isReferralReward: {
      type: Boolean,
      default: false,
    },
    startsAt: {
      type: Date,
      required: [true, 'Start date is required'],
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required'],
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Index for fast checkout validation
couponSchema.index({ code: 1, isActive: 1, expiresAt: 1 });

/**
 * Pre-save middleware: Force code uppercase
 */
couponSchema.pre('save', function () {
  if (this.code) {
    this.code = this.code.trim().toUpperCase();
  }
});

export const Coupon: CouponModelType =
  (models.Coupon as CouponModelType) || model<ICoupon, CouponModelType>('Coupon', couponSchema);

export default Coupon;
