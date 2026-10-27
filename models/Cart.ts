/**
 * @file models/Cart.ts
 * @description Mongoose schema & model for customer shopping carts in OX Shoes Pakistan.
 * MongoDB collection: carts.
 * Schema: { userId, productId, quantity, size, createdAt }
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type HydratedDocument } from 'mongoose';

export interface ICartItem {
  _id?: string;
  userId: string;
  productId: string;
  quantity: number;
  size: string;
  color?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CartDocument = HydratedDocument<ICartItem>;
export type CartModelType = Model<ICartItem>;

const cartSchema = new Schema<ICartItem, CartModelType>(
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
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      default: 1,
    },
    size: {
      type: String,
      required: [true, 'Shoe size selection is required'],
      trim: true,
    },
    color: {
      type: String,
      trim: true,
      default: '',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'carts',
    timestamps: true,
  }
);

// Compound index so a user cannot duplicate the same item with identical size
cartSchema.index({ userId: 1, productId: 1, size: 1 }, { unique: true });

export const Cart: CartModelType =
  (models.Cart as CartModelType) || model<ICartItem, CartModelType>('Cart', cartSchema, 'carts');

export default Cart;
