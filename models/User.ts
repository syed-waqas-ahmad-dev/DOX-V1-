/**
 * @file models/User.ts
 * @description Mongoose schema & model for OX Shoes customer & administrative accounts.
 * Features Pakistani phone validation, bcrypt password hashing, auto referral code,
 * soft-delete pre-find filtering, and compound indexes.
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type HydratedDocument, type Query } from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserRole, type IUser, type IAddress } from '@/types';

/**
 * Subdocument schema for customer delivery addresses
 */
const addressSchema = new Schema<IAddress>(
  {
    label: {
      type: String,
      required: [true, 'Address label is required (e.g. Home, Office)'],
      trim: true,
      maxlength: [50, 'Label cannot exceed 50 characters'],
    },
    fullName: {
      type: String,
      required: [true, 'Full recipient name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Recipient phone number is required'],
      match: [
        /^\+923\d{9}$/,
        'Phone number must be a valid Pakistani mobile number in format +923XXXXXXXXX',
      ],
    },
    street: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    postalCode: {
      type: String,
      required: [true, 'Postal code is required'],
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

/**
 * Instance methods on User document
 */
export interface IUserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export type UserDocument = HydratedDocument<IUser, IUserMethods>;

export type UserModelType = Model<IUser, Record<string, never>, IUserMethods>;

const userSchema = new Schema<IUser, UserModelType, IUserMethods>(
  {
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid email address',
      ],
      index: true,
    },
    password: {
      type: String,
      select: false, // Never return in default queries
      minlength: [6, 'Password must be at least 6 characters'],
    },
    googleId: {
      type: String,
      sparse: true,
      index: true,
    },
    image: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: {
        values: Object.values(UserRole),
        message: '{VALUE} is not a valid user role',
      },
      default: UserRole.CUSTOMER,
      index: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
    phone: {
      type: String,
      required: false,
      trim: true,
      match: [
        /^\+923\d{9}$/,
        'Phone number must be a valid Pakistani mobile number in format +923XXXXXXXXX',
      ],
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    addresses: {
      type: [addressSchema],
      default: [],
    },
    walletBalance: {
      type: Number,
      default: 0,
      min: [0, 'Wallet balance cannot be negative'],
    },
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
    },
    referredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
userSchema.index({ email: 1, isDeleted: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1, createdAt: -1 });

/**
 * Pre-save hook: Hash password with bcrypt and generate unique referral code
 */
userSchema.pre('save', async function () {
  // Generate referral code if absent
  if (!this.referralCode) {
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.referralCode = `OX-${randomHex}`;
  }

  // Hash password if modified
  if (!this.isModified('password') || !this.password) {
    return;
  }

  // Prevent double-hashing if password was already hashed before saving
  if (typeof this.password === 'string' && /^\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{53}$/.test(this.password)) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Pre-find middleware: Exclude soft-deleted users automatically unless explicitly requested
 */
userSchema.pre(/^find/, function (this: Query<unknown, IUser>) {
  // If query explicitly sets isDeleted, respect caller's intent
  const currentFilter = this.getFilter();
  if (currentFilter.isDeleted === undefined) {
    this.where({ isDeleted: { $ne: true } });
  }
});

/**
 * Instance method to verify password
 */
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Virtual to populate user orders
 */
userSchema.virtual('orders', {
  ref: 'Order',
  localField: '_id',
  foreignField: 'userId',
});

export const User: UserModelType =
  (models.User as UserModelType) || model<IUser, UserModelType>('User', userSchema);

export default User;
