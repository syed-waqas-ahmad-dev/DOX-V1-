/**
 * @file lib/pricing.ts
 * @description Enterprise pricing calculations for Pakistani e-commerce:
 * line items subtotal, 17% GST calculation, shipping tariffs, and coupon deductions.
 * Strict TypeScript: ZERO `any`.
 */

import { GST_RATE, FREE_SHIPPING_THRESHOLD } from './constants';
import type { ICoupon, IOrderItem } from '@/types';
import { CouponType } from '@/types';

export interface OrderPricingBreakdown {
  subtotal: number;
  discountAmount: number;
  taxAmount: number; // 17% GST
  shippingCharges: number;
  totalAmount: number;
}

export function calculateSubtotal(items: Array<{ price: number; quantity: number }>): number {
  return items.reduce((sum, item) => sum + Math.max(0, item.price) * Math.max(1, item.quantity), 0);
}

export function calculateGST(taxableSubtotal: number): number {
  return Math.round(Math.max(0, taxableSubtotal) * GST_RATE);
}

export function calculateShipping(
  city = 'Lahore',
  totalWeightGrams = 800,
  subtotal = 0
): number {
  if (subtotal >= FREE_SHIPPING_THRESHOLD && subtotal > 0) {
    return 0; // Free shipping over PKR 5,000
  }

  const normalizedCity = city.trim().toLowerCase();
  const weightKg = Math.max(1, Math.ceil(totalWeightGrams / 1000));

  // Regional baseline tariffs: Karachi, Lahore, Islamabad/Rawalpindi = 150 PKR, others = 250 PKR
  const isMajorMetro =
    normalizedCity.includes('lahore') ||
    normalizedCity.includes('karachi') ||
    normalizedCity.includes('islamabad') ||
    normalizedCity.includes('rawalpindi');

  const baseTariff = isMajorMetro ? 150 : 250;
  const excessWeightCharge = Math.max(0, weightKg - 1) * 50;

  return baseTariff + excessWeightCharge;
}

export function calculateCouponDiscount(
  subtotal: number,
  coupon?: Pick<ICoupon, 'type' | 'value' | 'maxDiscountAmount' | 'minOrderAmount'> | null
): number {
  if (!coupon || subtotal < (coupon.minOrderAmount || 0)) {
    return 0;
  }

  let discount = 0;

  if (coupon.type === CouponType.PERCENTAGE) {
    discount = Math.round((subtotal * coupon.value) / 100);
    if (coupon.maxDiscountAmount && coupon.maxDiscountAmount > 0) {
      discount = Math.min(discount, coupon.maxDiscountAmount);
    }
  } else if (coupon.type === CouponType.FIXED) {
    discount = Math.min(subtotal, coupon.value);
  } else if (coupon.type === CouponType.FREE_SHIPPING) {
    // Free shipping handles the shipping line item, not the subtotal discount directly
    discount = 0;
  }

  return Math.max(0, discount);
}

export function calculateOrderTotals(
  items: Array<{ price: number; quantity: number }>,
  city = 'Lahore',
  totalWeightGrams = 800,
  coupon?: Pick<ICoupon, 'type' | 'value' | 'maxDiscountAmount' | 'minOrderAmount'> | null
): OrderPricingBreakdown {
  const subtotal = calculateSubtotal(items);
  let discountAmount = calculateCouponDiscount(subtotal, coupon);

  let shippingCharges = calculateShipping(city, totalWeightGrams, subtotal);
  if (coupon?.type === CouponType.FREE_SHIPPING && subtotal >= (coupon.minOrderAmount || 0)) {
    shippingCharges = 0;
  }

  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const taxAmount = calculateGST(discountedSubtotal);
  const totalAmount = discountedSubtotal + taxAmount + shippingCharges;

  return {
    subtotal,
    discountAmount,
    taxAmount,
    shippingCharges,
    totalAmount,
  };
}
