/**
 * @file models/DeliveryAssignment.ts
 * @description Mongoose schema & model for delivery order dispatch assignments.
 * Tracks assignment lifecycle: assigned -> picked -> out_for_delivery -> delivered / failed.
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type HydratedDocument } from 'mongoose';
import { DeliveryAssignmentStatus, type IDeliveryAssignment } from '@/types';

export interface IDeliveryAssignmentDocument extends Omit<IDeliveryAssignment, '_id'> {}

export type DeliveryAssignmentModelType = Model<IDeliveryAssignmentDocument>;

const deliveryAssignmentSchema = new Schema<IDeliveryAssignmentDocument, DeliveryAssignmentModelType>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order reference is required'],
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      index: true,
    },
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: 'DeliveryPartner',
      required: [true, 'Partner reference is required'],
      index: true,
    },
    partnerName: {
      type: String,
      required: true,
    },
    partnerPhone: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(DeliveryAssignmentStatus),
      default: DeliveryAssignmentStatus.ASSIGNED,
      index: true,
    },
    codAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    codCollected: {
      type: Boolean,
      default: false,
      index: true,
    },
    deliveryAddress: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    customerPhone: {
      type: String,
      required: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    assignedByAdmin: {
      type: String,
      default: 'Super Admin',
    },
    pickedAt: {
      type: Date,
    },
    outForDeliveryAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    failedAt: {
      type: Date,
    },
    failureReason: {
      type: String,
    },
    proofPhotoUrl: {
      type: String,
    },
    deliveryNotes: {
      type: String,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const DeliveryAssignment: DeliveryAssignmentModelType =
  (models.DeliveryAssignment as DeliveryAssignmentModelType) ||
  model<IDeliveryAssignmentDocument, DeliveryAssignmentModelType>(
    'DeliveryAssignment',
    deliveryAssignmentSchema
  );

export default DeliveryAssignment;
