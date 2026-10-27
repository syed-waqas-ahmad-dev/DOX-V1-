/**
 * @file models/FlashSale.ts
 * @description Mongoose schema & model for scheduled flash deals and 11.11 / Eid shoe sales.
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type HydratedDocument } from 'mongoose';
import { type IFlashSale } from '@/types';

export type FlashSaleDocument = HydratedDocument<IFlashSale>;
export type FlashSaleModelType = Model<IFlashSale>;

const flashSaleSchema = new Schema<IFlashSale, FlashSaleModelType>(
  {
    name: {
      type: String,
      required: [true, 'Flash sale campaign title is required'],
      trim: true,
      maxlength: [120, 'Name cannot exceed 120 characters'],
    },
    productIds: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: 'Product',
        },
      ],
      required: [true, 'At least one product must be included in the flash sale'],
      validate: {
        validator: (v: unknown[]) => Array.isArray(v) && v.length > 0,
        message: 'Flash sale must reference at least one product',
      },
    },
    discountPercentage: {
      type: Number,
      required: [true, 'Discount percentage is required'],
      min: [1, 'Discount must be at least 1%'],
      max: [90, 'Discount cannot exceed 90%'],
    },
    startsAt: {
      type: Date,
      required: [true, 'Sale start time is required'],
    },
    endsAt: {
      type: Date,
      required: [true, 'Sale end time is required'],
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

// High-speed compound index for store homepage deal widgets
flashSaleSchema.index({ isActive: 1, startsAt: 1, endsAt: 1 });

export const FlashSale: FlashSaleModelType =
  (models.FlashSale as FlashSaleModelType) ||
  model<IFlashSale, FlashSaleModelType>('FlashSale', flashSaleSchema);

export default FlashSale;
