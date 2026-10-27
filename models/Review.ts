/**
 * @file models/Review.ts
 * @description Mongoose schema & model for verified customer product ratings and reviews.
 * Includes verified purchase linkage, automated rating aggregation on Product,
 * and anti-spam unique compound constraints.
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type HydratedDocument, Types } from 'mongoose';
import { type IReview } from '@/types';
import { Product } from './Product';

export type ReviewDocument = HydratedDocument<IReview>;
export type ReviewModelType = Model<IReview>;

const reviewSchema = new Schema<IReview, ReviewModelType>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order reference required for verified buyer reviews'],
      index: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating (1 to 5) is required'],
      min: [1, 'Rating must be at least 1 star'],
      max: [5, 'Rating cannot exceed 5 stars'],
    },
    title: {
      type: String,
      trim: true,
      maxlength: [100, 'Review title cannot exceed 100 characters'],
    },
    comment: {
      type: String,
      required: [true, 'Review comment text is required'],
      trim: true,
      minlength: [5, 'Comment must be at least 5 characters'],
      maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    },
    images: {
      type: [String],
      default: [],
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: true,
    },
    isApproved: {
      type: Boolean,
      default: true, // Auto-approve or admin flag
      index: true,
    },
    helpfulCount: {
      type: Number,
      default: 0,
      min: [0, 'Helpful count cannot be negative'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound Indexes
reviewSchema.index({ productId: 1, isApproved: 1, createdAt: -1 });
// Enforce unique review per user, product, and specific order
reviewSchema.index({ userId: 1, productId: 1, orderId: 1 }, { unique: true });

/**
 * Static helper function to recalculate and update product rating and count
 */
async function updateProductRatingStats(productId: Types.ObjectId): Promise<void> {
  const stats = await Review.aggregate([
    {
      $match: {
        productId: new Types.ObjectId(productId),
        isApproved: true,
      },
    },
    {
      $group: {
        _id: '$productId',
        numReviews: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  if (stats.length > 0) {
    const rawAvg = stats[0].avgRating as number;
    const roundedRating = Math.round(rawAvg * 10) / 10;
    await Product.findByIdAndUpdate(productId, {
      rating: roundedRating,
      numReviews: stats[0].numReviews as number,
    });
  } else {
    await Product.findByIdAndUpdate(productId, {
      rating: 0,
      numReviews: 0,
    });
  }
}

/**
 * Post-save hook: Recalculate average rating for the target product
 */
reviewSchema.post('save', async function (doc) {
  try {
    await updateProductRatingStats(doc.productId);
  } catch (err: unknown) {
    console.error('[Review post-save] Failed to update product rating stats:', err);
  }
});

export const Review: ReviewModelType =
  (models.Review as ReviewModelType) || model<IReview, ReviewModelType>('Review', reviewSchema);

export default Review;
