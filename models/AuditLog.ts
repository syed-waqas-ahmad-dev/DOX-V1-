/**
 * @file models/AuditLog.ts
 * @description Mongoose schema & model for administrative action audits in OX Shoes.
 * Features 1-year auto-cleanup MongoDB TTL index (31,536,000 seconds).
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type HydratedDocument } from 'mongoose';
import { type IAuditLog } from '@/types';

export type AuditLogDocument = HydratedDocument<IAuditLog>;
export type AuditLogModelType = Model<IAuditLog>;

const auditLogSchema = new Schema<IAuditLog, AuditLogModelType>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Admin user reference is required'],
      index: true,
    },
    action: {
      type: String,
      required: [true, 'Action identifier is required (e.g. UPDATE_PRICE, REFUND_ORDER)'],
      trim: true,
      index: true,
    },
    entity: {
      type: String,
      required: [true, 'Entity name is required (e.g. Product, Order, User)'],
      trim: true,
      index: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Target entity ID is required'],
      index: true,
    },
    changes: {
      before: { type: Schema.Types.Mixed, default: {} },
      after: { type: Schema.Types.Mixed, default: {} },
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// TTL Index: Automatically purge audit entries older than 365 days (1 year)
// 365 days * 24 hours * 60 minutes * 60 seconds = 31,536,000 seconds
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

// Compound filter index for administrative security reviews
auditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ adminId: 1, createdAt: -1 });

export const AuditLog: AuditLogModelType =
  (models.AuditLog as AuditLogModelType) ||
  model<IAuditLog, AuditLogModelType>('AuditLog', auditLogSchema);

export default AuditLog;
