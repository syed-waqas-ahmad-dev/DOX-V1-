/**
 * @file models/Wishlist.ts
 * @description Mongoose schema & model for customer wishlist in OX Shoes Pakistan.
 * MongoDB collection: wishlists.
 * Schema: { userId, productId, createdAt }
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type HydratedDocument } from 'mongoose';

export interface IWishlistItem {
  _id?: string;
  userId: string;
  productId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type WishlistDocument = HydratedDocument<IWishlistItem>;
export type WishlistModelType = Model<IWishlistItem>;

const wishlistSchema = new Schema<IWishlistItem, WishlistModelType>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
      trim: true,
    },
    productId: {
      type: String,
      ref: 'Product',
      required: [true, 'Product reference is required'],
      index: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'wishlists',
    timestamps: true,
  }
);

// Compound index so a user cannot add the same product twice to wishlist
wishlistSchema.index({ userId: 1, productId: 1 }, { unique: true });

export const Wishlist: WishlistModelType =
  (models.Wishlist as WishlistModelType) || model<IWishlistItem, WishlistModelType>('Wishlist', wishlistSchema, 'wishlists');

export default Wishlist;
