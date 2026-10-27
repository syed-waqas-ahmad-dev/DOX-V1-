/**
 * @file models/DeliveryLog.ts
 * @description Mongoose schema & model for real-time delivery GPS route breadcrumbs and status logs.
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model } from 'mongoose';
import { type IDeliveryLog } from '@/types';

export interface IDeliveryLogDocument extends Omit<IDeliveryLog, '_id'> {}

export type DeliveryLogModelType = Model<IDeliveryLogDocument>;

const deliveryLogSchema = new Schema<IDeliveryLogDocument, DeliveryLogModelType>(
  {
    assignmentId: {
      type: Schema.Types.ObjectId,
      ref: 'DeliveryAssignment',
      required: [true, 'Assignment reference is required'],
      index: true,
    },
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: 'DeliveryPartner',
      required: [true, 'Partner reference is required'],
      index: true,
    },
    status: {
      type: String,
      required: true,
    },
    lat: {
      type: Number,
    },
    lng: {
      type: Number,
    },
    note: {
      type: String,
      trim: true,
    },
    photoUrl: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

export const DeliveryLog: DeliveryLogModelType =
  (models.DeliveryLog as DeliveryLogModelType) ||
  model<IDeliveryLogDocument, DeliveryLogModelType>('DeliveryLog', deliveryLogSchema);

export default DeliveryLog;
