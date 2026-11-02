import { Schema, model, models, type Model, type Document } from 'mongoose';

/**
 * @file models/TrackingAttempt.ts
 * @description Stores failed order tracking attempts to prevent brute-force discovery of order numbers.
 * TTL index ensures records are automatically purged after 1 hour.
 */

export interface ITrackingAttempt extends Document {
  ip: string;
  orderNumber: string;
  attempts: number;
  lastAttempt: Date;
}

const trackingAttemptSchema = new Schema<ITrackingAttempt>(
  {
    ip: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true, index: true },
    attempts: { type: Number, default: 1 },
    lastAttempt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// TTL Index: Expire records after 3600 seconds (1 hour)
trackingAttemptSchema.index({ lastAttempt: 1 }, { expireAfterSeconds: 3600 });

// Compound index for efficient lookup
trackingAttemptSchema.index({ ip: 1, orderNumber: 1 }, { unique: true });

export const TrackingAttempt: Model<ITrackingAttempt> =
  models.TrackingAttempt || model<ITrackingAttempt>('TrackingAttempt', trackingAttemptSchema);

export default TrackingAttempt;
