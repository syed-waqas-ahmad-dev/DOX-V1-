/**
 * @file models/Notification.ts
 * @description Mongoose schema & model for user notifications (order dispatch, Eid deals, review responses).
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type HydratedDocument } from 'mongoose';
import { NotificationType, type INotification } from '@/types';

export type NotificationDocument = HydratedDocument<INotification>;
export type NotificationModelType = Model<INotification>;

const notificationSchema = new Schema<INotification, NotificationModelType>(
  {
    userId: {
      type: Schema.Types.Mixed,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: Object.values(NotificationType),
        message: '{VALUE} is not a valid notification type',
      },
      required: [true, 'Notification type is required'],
      default: NotificationType.ORDER_UPDATE,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    message: {
      type: String,
      required: [true, 'Notification message body is required'],
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    link: {
      type: String,
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    collection: 'notifications',
    timestamps: true,
  }
);

// High-performance compound index for unread badge count and inbox listing
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification: NotificationModelType =
  (models.Notification as NotificationModelType) ||
  model<INotification, NotificationModelType>('Notification', notificationSchema);

export default Notification;
