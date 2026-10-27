/**
 * @file lib/coupon-validator.ts
 * @description Validates promotional coupons against active cart contents and restrictions.
 * Strict TypeScript: ZERO `any`.
 */

import type { ICoupon, IOrderItem } from '@/types';
import { CouponType } from '@/types';

export interface CouponValidationResult {
  valid: boolean;
  message?: string;
  discountAmount: number;
}

export function validateCouponRules(
  coupon: ICoupon,
  subtotal: number,
  items: Array<{ category?: string; brand?: string }> = [],
  isFirstOrder = false
): CouponValidationResult {
  const now = new Date();

  if (!coupon.isActive) {
    return { valid: false, message: 'This coupon code is currently disabled.', discountAmount: 0 };
  }

  if (coupon.startsAt && new Date(coupon.startsAt) > now) {
    return { valid: false, message: 'This coupon has not started yet.', discountAmount: 0 };
  }

  if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
    return { valid: false, message: 'This coupon code has expired.', discountAmount: 0 };
  }

  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, message: 'Coupon usage limit has been reached.', discountAmount: 0 };
  }

  if (coupon.minOrderAmount > 0 && subtotal < coupon.minOrderAmount) {
    return {
      valid: false,
      message: `Minimum order amount of PKR ${coupon.minOrderAmount.toLocaleString()} required.`,
      discountAmount: 0,
    };
  }

  if (coupon.isFirstOrderOnly && !isFirstOrder) {
    return {
      valid: false,
      message: 'This coupon is valid only on your first order.',
      discountAmount: 0,
    };
  }

  // Category & Brand Restrictions
  if (coupon.applicableCategories && coupon.applicableCategories.length > 0) {
    const hasCategoryMatch = items.some(
      (item) => item.category && coupon.applicableCategories.includes(item.category as any)
    );
    if (!hasCategoryMatch) {
      return {
        valid: false,
        message: 'This coupon is not applicable to the shoe categories in your cart.',
        discountAmount: 0,
      };
    }
  }

  // Compute discount
  let discountAmount = 0;
  if (coupon.type === CouponType.PERCENTAGE) {
    discountAmount = Math.round((subtotal * coupon.value) / 100);
    if (coupon.maxDiscountAmount && coupon.maxDiscountAmount > 0) {
      discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
    }
  } else if (coupon.type === CouponType.FIXED) {
    discountAmount = Math.min(subtotal, coupon.value);
  } else if (coupon.type === CouponType.FREE_SHIPPING) {
    discountAmount = 0; // Handled in shipping line item
  }

  return {
    valid: true,
    discountAmount,
    message: `Coupon ${coupon.code} applied successfully!`,
  };
}
