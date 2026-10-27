/**
 * @file models/GalleryItem.ts
 * @description Mongoose model for About Page showcase gallery items (images & short clips).
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type Types } from 'mongoose';

export type GalleryMediaType = 'image' | 'video';

export interface IGalleryItem {
  _id: Types.ObjectId | string;
  url: string;
  type: GalleryMediaType;
  title?: string;
  description?: string;
  publicId?: string;
  createdBy?: Types.ObjectId | string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const galleryItemSchema = new Schema<IGalleryItem>(
  {
    url: {
      type: String,
      required: [true, 'Media URL is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['image', 'video'],
      required: [true, 'Media type must be either image or video'],
    },
    title: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    publicId: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

galleryItemSchema.index({ createdAt: -1 });

export const GalleryItem: Model<IGalleryItem> =
  (models.GalleryItem as Model<IGalleryItem>) ||
  model<IGalleryItem>('GalleryItem', galleryItemSchema);

export default GalleryItem;
