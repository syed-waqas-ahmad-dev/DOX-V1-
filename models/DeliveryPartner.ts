/**
 * @file models/DeliveryPartner.ts
 * @description Mongoose schema & model for OX Shoes Private Delivery Partners (Riders).
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type HydratedDocument } from 'mongoose';
import bcrypt from 'bcryptjs';
import { DeliveryPartnerStatus, type IDeliveryPartner } from '@/types';

export interface IDeliveryPartnerDocument extends Omit<IDeliveryPartner, '_id'> {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export type DeliveryPartnerModelType = Model<IDeliveryPartnerDocument>;

const deliveryPartnerSchema = new Schema<IDeliveryPartnerDocument, DeliveryPartnerModelType>(
  {
    name: {
      type: String,
      required: [true, 'Partner full name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Partner phone number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    cnic: {
      type: String,
      required: [true, 'CNIC number is required'],
      trim: true,
    },
    bikeNumber: {
      type: String,
      required: [true, 'Bike registration number is required'],
      trim: true,
      uppercase: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required for rider portal'],
      select: false,
    },
    area: {
      type: String,
      required: [true, 'Operational area is required'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'Operating city is required'],
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(DeliveryPartnerStatus),
      default: DeliveryPartnerStatus.ACTIVE,
      index: true,
    },
    role: {
      type: String,
      enum: ['rider', 'partner'],
      default: 'rider',
      index: true,
    },
    currentLoad: {
      type: Number,
      default: 0,
      min: 0,
    },
    walletBalance: {
      type: Number,
      default: 0,
    },
    codCollectedBalance: {
      type: Number,
      default: 0,
    },
    totalDeliveries: {
      type: Number,
      default: 0,
      min: 0,
    },
    rating: {
      type: Number,
      default: 5.0,
      min: 1.0,
      max: 5.0,
    },
    photo: {
      type: String,
      default: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    },
    currentLat: {
      type: Number,
    },
    currentLng: {
      type: Number,
    },
    lastLocationUpdate: {
      type: Date,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdByAdminId: {
      type: String,
      default: 'admin-super',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Pre-save password hashing
deliveryPartnerSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password as string, salt);
});

// Compare password method
deliveryPartnerSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  const currentPassword = this.password as string;
  if (!currentPassword) return false;
  return bcrypt.compare(candidatePassword, currentPassword);
};

export const DeliveryPartner: DeliveryPartnerModelType =
  (models.DeliveryPartner as DeliveryPartnerModelType) ||
  model<IDeliveryPartnerDocument, DeliveryPartnerModelType>('DeliveryPartner', deliveryPartnerSchema);

export default DeliveryPartner;
