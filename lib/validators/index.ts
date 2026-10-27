/**
 * @file lib/validators/index.ts
 * @description Master Zod schemas for forms and server actions.
 * Strict TypeScript: ZERO `any`.
 */

import { z } from 'zod';
import { ProductCategory, ProductSubCategory, ProductBrand, PaymentMethod } from '@/types';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Please enter a valid email address'),
  phone: z
    .string()
    .regex(/^\+923\d{9}$/, 'Phone must be a valid Pakistani mobile number (+923XXXXXXXXX)'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  referralCode: z.string().optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const addressSchema = z.object({
  label: z.string().min(1, 'Label is required (e.g. Home, Office)').max(50),
  fullName: z.string().min(2, 'Recipient full name is required').max(100),
  phone: z
    .string()
    .regex(/^\+923\d{9}$/, 'Must be a valid Pakistani mobile number (+923XXXXXXXXX)'),
  street: z.string().optional().default(''),
  address: z.string().optional(),
  villageAddress: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  postalCode: z.string().min(2, 'Postal code is required').optional().default('54000'),
  isDefault: z.boolean().default(false),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const checkoutOrderSchema = z.object({
  guestEmail: z.string().email().optional(),
  guestPhone: z
    .string()
    .regex(/^\+923\d{9}$/, 'Pakistani mobile number required')
    .optional(),
  shippingAddress: addressSchema.omit({ label: true, isDefault: true }),
  paymentMethod: z.union([z.nativeEnum(PaymentMethod), z.string()]),
  couponCode: z.string().optional(),
  walletCreditUsed: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});
export type CheckoutOrderInput = z.infer<typeof checkoutOrderSchema>;

export const createReviewSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  orderId: z.string().min(1, 'Order ID is required'),
  rating: z.number().min(1).max(5),
  title: z.string().max(100).optional(),
  comment: z.string().min(5, 'Comment must be at least 5 characters').max(2000),
  images: z.array(z.string()).default([]),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
