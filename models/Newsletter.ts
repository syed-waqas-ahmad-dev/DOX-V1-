/**
 * @file models/Newsletter.ts
 * @description Mongoose schema & model for marketing newsletter subscribers.
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type HydratedDocument } from 'mongoose';
import { type INewsletter } from '@/types';

export type NewsletterDocument = HydratedDocument<INewsletter>;
export type NewsletterModelType = Model<INewsletter>;

const newsletterSchema = new Schema<INewsletter, NewsletterModelType>(
  {
    email: {
      type: String,
      required: [true, 'Subscriber email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid subscriber email address',
      ],
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    source: {
      type: String,
      default: 'website_footer',
      trim: true,
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
    },
    unsubscribedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

newsletterSchema.index({ isActive: 1, subscribedAt: -1 });

export const Newsletter: NewsletterModelType =
  (models.Newsletter as NewsletterModelType) ||
  model<INewsletter, NewsletterModelType>('Newsletter', newsletterSchema);

export default Newsletter;
