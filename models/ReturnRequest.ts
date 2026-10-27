/**
 * @file models/ReturnRequest.ts
 * @description Mongoose schema & model for shoe returns, sizing replacements,
 * and refunds in OX Shoes Pakistan.
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type HydratedDocument } from 'mongoose';
import { ReturnReason, ReturnStatus, PaymentMethod, type IReturnRequest } from '@/types';

export type ReturnRequestDocument = HydratedDocument<IReturnRequest>;
export type ReturnRequestModelType = Model<IReturnRequest>;

const returnRequestSchema = new Schema<IReturnRequest, ReturnRequestModelType>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order reference is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    orderItemId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Order item reference is required'],
    },
    reason: {
      type: String,
      enum: {
        values: Object.values(ReturnReason),
        message: '{VALUE} is not a valid return reason',
      },
      required: [true, 'Reason for return/exchange is required'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    images: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: {
        values: Object.values(ReturnStatus),
        message: '{VALUE} is not a valid return status',
      },
      default: ReturnStatus.PENDING,
      index: true,
    },
    refundAmount: {
      type: Number,
      required: [true, 'Refund amount in PKR is required'],
      min: [0, 'Refund amount cannot be negative'],
    },
    refundMethod: {
      type: String,
      enum: {
        values: Object.values(PaymentMethod),
        message: '{VALUE} is not a valid refund payment method',
      },
      default: PaymentMethod.COD,
    },
    adminNotes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
returnRequestSchema.index({ userId: 1, createdAt: -1 });
returnRequestSchema.index({ status: 1, createdAt: -1 });
returnRequestSchema.index({ orderId: 1, status: 1 });

export const ReturnRequest: ReturnRequestModelType =
  (models.ReturnRequest as ReturnRequestModelType) ||
  model<IReturnRequest, ReturnRequestModelType>('ReturnRequest', returnRequestSchema);

export default ReturnRequest;
