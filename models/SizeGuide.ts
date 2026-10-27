/**
 * @file models/SizeGuide.ts
 * @description Mongoose schema & model for shoe size charts.
 * Translates between Pakistani/UK sizing, US sizing, EU sizing, and foot measurements in centimeters.
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type HydratedDocument } from 'mongoose';
import { type ISizeGuide, type ISizeMeasurement } from '@/types';

/**
 * Footwear dimension mapping subdocument
 */
const measurementSchema = new Schema<ISizeMeasurement>(
  {
    size: {
      type: String,
      required: true,
      trim: true,
    },
    length_cm: {
      type: Number,
      required: true,
      min: [10, 'Foot length must be realistic (> 10cm)'],
    },
    width_cm: {
      type: Number,
      required: true,
      min: [4, 'Foot width must be realistic (> 4cm)'],
    },
    ukSize: {
      type: String,
      required: true,
      trim: true,
    },
    usSize: {
      type: String,
      required: true,
      trim: true,
    },
    euSize: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

export type SizeGuideDocument = HydratedDocument<ISizeGuide>;
export type SizeGuideModelType = Model<ISizeGuide>;

const sizeGuideSchema = new Schema<ISizeGuide, SizeGuideModelType>(
  {
    name: {
      type: String,
      required: [true, 'Size guide name is required (e.g. Men Peshawari Chappal Sizing)'],
      trim: true,
      unique: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    measurements: {
      type: [measurementSchema],
      required: [true, 'At least one measurement breakdown is required'],
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const SizeGuide: SizeGuideModelType =
  (models.SizeGuide as SizeGuideModelType) ||
  model<ISizeGuide, SizeGuideModelType>('SizeGuide', sizeGuideSchema);

export default SizeGuide;
