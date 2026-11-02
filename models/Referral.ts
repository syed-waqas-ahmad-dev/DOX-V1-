/**
 * @file models/Referral.ts
 * @description Mongoose schema & model for referral incentive rewards in OX Shoes.
 * Tracks referrer customer, referred new customer, voucher code, and PKR rewards.
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type HydratedDocument } from 'mongoose';
import { ReferralStatus, type IReferral } from '@/types';

export type ReferralDocument = HydratedDocument<IReferral>;
export type ReferralModelType = Model<IReferral>;

const referralSchema = new Schema<IReferral, ReferralModelType>(
  {
    referrerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Referrer user ID is required'],
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: false,
      default: null,
      index: true,
    },
    refereeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null,
      index: true,
    },
    referredEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    referredName: {
      type: String,
      trim: true,
      default: null,
    },
    code: {
      type: String,
      required: [true, 'Referral code is required'],
      uppercase: true,
      trim: true,
      index: true,
    },
    rewardAmount: {
      type: Number,
      required: [true, 'Reward amount in PKR is required'],
      min: [0, 'Reward amount cannot be negative'],
      default: 200, // PKR 200 store credit reward
    },
    status: {
      type: String,
      enum: {
        values: Object.values(ReferralStatus),
        message: '{VALUE} is not a valid referral status',
      },
      default: ReferralStatus.PENDING,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

referralSchema.index({ referrerId: 1, status: 1 });
referralSchema.index({ code: 1, status: 1 });
referralSchema.index(
  { referrerId: 1, refereeId: 1 },
  { unique: true, partialFilterExpression: { refereeId: { $type: 'objectId' } } }
);
referralSchema.index(
  { referrerId: 1, referredEmail: 1 },
  { unique: true, partialFilterExpression: { referredEmail: { $type: 'string' } } }
);

export const Referral: ReferralModelType =
  (models.Referral as ReferralModelType) ||
  model<IReferral, ReferralModelType>('Referral', referralSchema);

export default Referral;
