/**
 * @file models/ShippingZone.ts
 * @description Mongoose schema & model for Pakistani logistics shipping zones.
 * Maps Pakistani metropolitan hubs and districts (Lahore, Karachi, Rawalpindi, Islamabad, etc.)
 * to courier rates, estimated delivery days, and free shipping limits.
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type HydratedDocument } from 'mongoose';
import { type IShippingZone, type IEstimatedDeliveryDays } from '@/types';

/**
 * Delivery SLA subdocument
 */
const estimatedDeliveryDaysSchema = new Schema<IEstimatedDeliveryDays>(
  {
    min: {
      type: Number,
      required: true,
      min: [1, 'Minimum delivery days cannot be less than 1'],
    },
    max: {
      type: Number,
      required: true,
      min: [1, 'Maximum delivery days cannot be less than 1'],
    },
  },
  { _id: false }
);

export type ShippingZoneDocument = HydratedDocument<IShippingZone>;
export type ShippingZoneModelType = Model<IShippingZone>;

const shippingZoneSchema = new Schema<IShippingZone, ShippingZoneModelType>(
  {
    name: {
      type: String,
      required: [true, 'Zone name is required (e.g. Lahore Urban, Karachi Central)'],
      trim: true,
      unique: true,
    },
    cities: {
      type: [String],
      required: [true, 'At least one city must be mapped to this zone'],
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length > 0,
        message: 'Shipping zone must include at least one city',
      },
    },
    baseRate: {
      type: Number,
      required: [true, 'Base shipping rate in PKR is required'],
      min: [0, 'Base rate cannot be negative'],
    },
    perKgRate: {
      type: Number,
      required: [true, 'Per kg incremental rate in PKR is required'],
      min: [0, 'Per kg rate cannot be negative'],
      default: 50,
    },
    estimatedDays: {
      type: estimatedDeliveryDaysSchema,
      required: true,
    },
    freeShippingThreshold: {
      type: Number,
      default: 3500, // Default free shipping above PKR 3,500
      min: [0, 'Free shipping threshold cannot be negative'],
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

// Multikey index for ultra-fast city lookup during address validation & checkout calculation
shippingZoneSchema.index({ cities: 1, isActive: 1 });

export const ShippingZone: ShippingZoneModelType =
  (models.ShippingZone as ShippingZoneModelType) ||
  model<IShippingZone, ShippingZoneModelType>('ShippingZone', shippingZoneSchema);

export default ShippingZone;
