'use server';

/**
 * @file actions/coupon.actions.ts
 * @description Server action for validating promotional coupons at checkout.
 * Strict TypeScript: ZERO `any`.
 */

import { connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { Coupon } from '@/models/Coupon';
import { validateCouponRules } from '@/lib/coupon-validator';
import { successResponse, errorResponse, type ActionResult } from '@/lib/response';
import { handleActionError } from '@/lib/error-handler';
import { MockDb } from '@/lib/db/mock-store';
import { CouponType, type ICoupon } from '@/types';
import { revalidatePath } from 'next/cache';

export async function validateCouponAction(
  code: string,
  subtotal: number
): Promise<
  ActionResult<{
    code: string;
    discountAmount: number;
    type: string;
    message: string;
  }>
> {
  try {
    if (!code || code.trim().length === 0) {
      return errorResponse('Please provide a coupon code.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const mockCoupon = MockDb.getCoupon(code);
      if (!mockCoupon) {
        return errorResponse('Invalid coupon code. Please check and try again.');
      }
      const result = validateCouponRules(mockCoupon, subtotal);
      if (!result.valid) {
        return errorResponse(result.message || 'Coupon is not eligible for this order.');
      }
      return successResponse({
        code: mockCoupon.code,
        discountAmount: result.discountAmount,
        type: mockCoupon.type,
        message: result.message || 'Coupon applied!',
      });
    }

    const coupon = await Coupon.findOne({
      code: code.trim().toUpperCase(),
      isActive: true,
    }).lean();

    if (!coupon) {
      const mockCoupon = MockDb.getCoupon(code);
      if (mockCoupon) {
        const result = validateCouponRules(mockCoupon, subtotal);
        if (result.valid) {
          return successResponse({
            code: mockCoupon.code,
            discountAmount: result.discountAmount,
            type: mockCoupon.type,
            message: result.message || 'Coupon applied!',
          });
        }
      }
      return errorResponse('Invalid coupon code. Please check and try again.');
    }

    const result = validateCouponRules(coupon, subtotal);
    if (!result.valid) {
      return errorResponse(result.message || 'Coupon is not eligible for this order.');
    }

    return successResponse({
      code: coupon.code,
      discountAmount: result.discountAmount,
      type: coupon.type,
      message: result.message || 'Coupon applied!',
    });
  } catch (error: unknown) {
    const mockCoupon = MockDb.getCoupon(code);
    if (mockCoupon) {
      const result = validateCouponRules(mockCoupon, subtotal);
      if (result.valid) {
        return successResponse({
          code: mockCoupon.code,
          discountAmount: result.discountAmount,
          type: mockCoupon.type,
          message: result.message || 'Coupon applied!',
        });
      }
    }
    return handleActionError(error);
  }
}

export async function getAllCoupons(): Promise<ActionResult<ICoupon[]>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      return successResponse(MockDb.getAllCoupons());
    }

    const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
    if (!coupons || coupons.length === 0) {
      return successResponse(MockDb.getAllCoupons());
    }

    return successResponse(JSON.parse(JSON.stringify(coupons)));
  } catch (error: unknown) {
    return successResponse(MockDb.getAllCoupons());
  }
}

export async function createCoupon(payload: Partial<ICoupon>): Promise<ActionResult<ICoupon>> {
  try {
    await connectToDatabase();

    const normalizedCode = (payload.code || 'COUPON').trim().toUpperCase();

    if (!isDatabaseConnected()) {
      const created = MockDb.addCoupon({ ...payload, code: normalizedCode });
      revalidatePath('/admin');
      return successResponse(created);
    }

    const doc = await Coupon.create({
      code: normalizedCode,
      type: payload.type || CouponType.PERCENTAGE,
      value: Number(payload.value) || 10,
      minOrderAmount: Number(payload.minOrderAmount) || 0,
      maxDiscountAmount: payload.maxDiscountAmount ? Number(payload.maxDiscountAmount) : undefined,
      usageLimit: Number(payload.usageLimit) || 100,
      usedCount: 0,
      perUserLimit: 1,
      applicableCategories: [],
      applicableBrands: [],
      isFirstOrderOnly: false,
      startsAt: payload.startsAt || new Date(),
      expiresAt: payload.expiresAt || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      isActive: payload.isActive !== undefined ? payload.isActive : true,
    });

    MockDb.addCoupon(doc);
    revalidatePath('/admin');
    return successResponse(JSON.parse(JSON.stringify(doc)));
  } catch (error: unknown) {
    const created = MockDb.addCoupon(payload);
    if (created) {
      revalidatePath('/admin');
      return successResponse(created);
    }
    return handleActionError(error);
  }
}

export async function updateCoupon(
  couponId: string,
  updates: Partial<ICoupon>
): Promise<ActionResult<ICoupon>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const updated = MockDb.updateCoupon(couponId, updates);
      if (!updated) return errorResponse('Coupon not found.');
      revalidatePath('/admin');
      return successResponse(updated);
    }

    const doc = await Coupon.findByIdAndUpdate(couponId, { $set: updates }, { new: true }).lean();
    if (!doc) {
      const updated = MockDb.updateCoupon(couponId, updates);
      if (updated) {
        revalidatePath('/admin');
        return successResponse(updated);
      }
      return errorResponse('Coupon not found.');
    }

    MockDb.updateCoupon(couponId, updates);
    revalidatePath('/admin');
    return successResponse(JSON.parse(JSON.stringify(doc)));
  } catch (error: unknown) {
    const updated = MockDb.updateCoupon(couponId, updates);
    if (updated) {
      revalidatePath('/admin');
      return successResponse(updated);
    }
    return handleActionError(error);
  }
}

export async function deleteCoupon(couponId: string): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const ok = MockDb.deleteCoupon(couponId);
      revalidatePath('/admin');
      return successResponse({ deleted: ok });
    }

    await Coupon.findByIdAndDelete(couponId);
    MockDb.deleteCoupon(couponId);
    revalidatePath('/admin');

    return successResponse({ deleted: true });
  } catch (error: unknown) {
    const ok = MockDb.deleteCoupon(couponId);
    revalidatePath('/admin');
    return successResponse({ deleted: ok });
  }
}
