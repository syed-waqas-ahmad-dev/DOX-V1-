/**
 * @file models/AbandonedCart.ts
 * @description Mongoose schema & model for abandoned cart recovery automation.
 * Captures customers who dropped off during checkout to trigger reminder SMS/emails.
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type HydratedDocument } from 'mongoose';
import { type IAbandonedCart, type ICartProductItem } from '@/types';

/**
 * Snapshot subdocument of cart state at abandonment
 */
const cartSnapshotItemSchema = new Schema<ICartProductItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    size: { type: String, required: true },
    color: { type: String, required: true },
    quantity: { type: Number, required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

export type AbandonedCartDocument = HydratedDocument<IAbandonedCart>;
export type AbandonedCartModelType = Model<IAbandonedCart>;

const abandonedCartSchema = new Schema<IAbandonedCart, AbandonedCartModelType>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Customer email is required for recovery messaging'],
      trim: true,
      lowercase: true,
      index: true,
    },
    cartSnapshot: {
      type: [cartSnapshotItemSchema],
      default: [],
    },
    recoveryEmailSent: {
      type: Boolean,
      default: false,
      index: true,
    },
    recoveredAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

abandonedCartSchema.index({ recoveryEmailSent: 1, createdAt: 1 });
abandonedCartSchema.index({ email: 1, createdAt: -1 });

export const AbandonedCart: AbandonedCartModelType =
  (models.AbandonedCart as AbandonedCartModelType) ||
  model<IAbandonedCart, AbandonedCartModelType>('AbandonedCart', abandonedCartSchema);

export default AbandonedCart;
