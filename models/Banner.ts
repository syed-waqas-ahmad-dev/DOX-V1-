/**
 * @file models/Banner.ts
 * @description Mongoose schema & model for promotional storefront banners in OX Shoes.
 * Supports placement positioning (hero slider, Eid top strip, mid page) and scheduled visibility.
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type HydratedDocument } from 'mongoose';
import { BannerPosition, type IBanner } from '@/types';

export type BannerDocument = HydratedDocument<IBanner>;
export type BannerModelType = Model<IBanner>;

const bannerSchema = new Schema<IBanner, BannerModelType>(
  {
    title: {
      type: String,
      required: [true, 'Banner title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    image: {
      type: String,
      trim: true,
      default: '',
    },
    mobileImage: {
      type: String,
      trim: true,
    },
    link: {
      type: String,
      trim: true,
    },
    position: {
      type: String,
      enum: {
        values: Object.values(BannerPosition),
        message: '{VALUE} is not a valid banner position',
      },
      required: [true, 'Banner placement position is required'],
      index: true,
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    startsAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Banner expiration date is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to quickly fetch live banners ordered by display weight
bannerSchema.index({ position: 1, isActive: 1, order: 1 });
bannerSchema.index({ expiresAt: 1 });

export const Banner: BannerModelType =
  (models.Banner as BannerModelType) || model<IBanner, BannerModelType>('Banner', bannerSchema);

export default Banner;
