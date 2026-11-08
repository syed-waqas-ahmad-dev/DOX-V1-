'use server';

/**
 * @file app/admin/fleet/actions.ts
 * @description Foodpanda-style fleet logistics server actions for OX Shoes.
 * Handles order assignment to riders, rider creation, and OTP-verified delivery completion.
 * Strict TypeScript: ZERO `any` types. Strictly NO wallet bonus.
 */

import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db/connect';
import { Order } from '@/models/Order';
import { DeliveryPartner } from '@/models/DeliveryPartner';
import { DeliveryPartnerStatus } from '@/types';

import { cookies } from 'next/headers';
import { RIDER_COOKIE_NAME, verifyRiderToken } from '@/lib/rider-auth';
import { verifySuperAdminAuth, isElevatedAdminRole } from '@/lib/auth-guard';
import { verifyDeliveryAdminAuth } from '@/actions/delivery.actions';

/**
 * Assigns an order to a rider with delivery:dispatch permission and city matching verification.
 */
export async function assignOrderToRider(
  orderId: string,
  riderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyDeliveryAdminAuth('delivery:dispatch');
    if (!auth.authorized) {
      return { success: false, error: 'Unauthorized: Delivery dispatch clearance required.' };
    }

    if (!orderId || !riderId) {
      return { success: false, error: 'Order ID and Rider ID are required' };
    }

    await connectToDatabase();

    const order = await Order.findById(orderId);
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    const rider = await DeliveryPartner.findById(riderId);
    if (!rider) {
      return { success: false, error: 'Rider not found' };
    }

    const orderCity = order.shippingAddress?.city?.trim().toLowerCase();
    const riderCity = rider.city?.trim().toLowerCase();

    if (!orderCity || !riderCity || orderCity !== riderCity) {
      return { success: false, error: 'City mismatch' };
    }

    const updateData: Record<string, unknown> = {
      riderId,
      riderStatus: 'assigned',
    };

    if (auth.adminId) {
      updateData.lastUpdatedBy = auth.adminId;
    }

    await Order.findByIdAndUpdate(orderId, {
      $set: updateData,
      $inc: { version: 1 },
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to assign order to rider';
    return { success: false, error: message };
  }
}

/**
 * Registers a new delivery rider in the fleet with unique phone check and bcrypt hashing.
 * Strictly gated behind Super Admin clearance.
 */
export async function createRiderBySuperAdmin(data: {
  name: string;
  phone: string;
  password: string;
  city: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifySuperAdminAuth();
    if (!auth.authorized) {
      return { success: false, error: auth.error || 'Unauthorized' };
    }

    if (!data.name?.trim() || !data.phone?.trim() || !data.password || !data.city?.trim()) {
      return { success: false, error: 'All fields (name, phone, password, city) are required' };
    }

    await connectToDatabase();

    const cleanPhone = data.phone.trim();
    const existing = await DeliveryPartner.findOne({ phone: cleanPhone });
    if (existing) {
      return { success: false, error: 'Phone number already registered' };
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    await DeliveryPartner.create({
      name: data.name.trim(),
      phone: cleanPhone,
      password: hashedPassword,
      city: data.city.trim(),
      cnic: '00000-0000000-0',
      bikeNumber: 'N/A',
      area: data.city.trim(),
      status: DeliveryPartnerStatus.ACTIVE,
      role: 'rider',
      currentLoad: 0,
      totalDeliveries: 0,
      isDeleted: false,
      createdByAdminId: auth.userId || 'super_admin',
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create rider';
    return { success: false, error: message };
  }
}

/**
 * Validates delivery OTP and marks the order as delivered and paid.
 * Enforces cryptographic HMAC rider session cookie verification and assignment riderId matching.
 * Preserves separate explicit Admin completion path.
 */
export async function riderAction_markDelivered(
  orderId: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!orderId || !otp?.trim()) {
      return { success: false, error: 'Order ID and OTP are required' };
    }

    await connectToDatabase();

    const order = await Order.findById(orderId).select('+codOtp +deliveryOTP');
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    const orderWithOtp = order as unknown as {
      status?: string;
      deliveryOTP?: string;
      codOtp?: string;
      riderId?: string;
    };

    if (orderWithOtp.status === 'cancelled' || orderWithOtp.status === 'delivered') {
      return { success: false, error: `Order cannot be marked delivered in ${orderWithOtp.status} status` };
    }

    // Determine authorization:
    // 1. Separate & explicitly verified Admin path
    const session = await getServerSession(authOptions);
    const sessionRole = (session?.user as { role?: string })?.role;
    const isAdmin = isElevatedAdminRole(sessionRole);

    let authenticatedRiderId: string | null = null;

    if (!isAdmin) {
      // 2. Rider path: Must possess valid cryptographic HMAC cookie token matching assigned order riderId
      let token: string | undefined;
      try {
        const cookieStore = await cookies();
        token = cookieStore.get(RIDER_COOKIE_NAME)?.value;
      } catch {
        token = undefined;
      }

      if (!token) {
        return { success: false, error: 'Unauthorized: Valid rider session cookie required' };
      }

      const payload = verifyRiderToken(token);
      if (!payload || !payload.partnerId || payload.role !== 'rider') {
        return { success: false, error: 'Unauthorized: Invalid or expired rider session token' };
      }

      authenticatedRiderId = payload.partnerId;

      const orderRiderIdStr = orderWithOtp.riderId ? orderWithOtp.riderId.toString() : '';
      if (!orderRiderIdStr || orderRiderIdStr !== authenticatedRiderId) {
        return { success: false, error: 'Unauthorized: You are not the assigned rider for this order' };
      }
    }

    // OTP Verification (Preserve existing logic)
    const expectedOtp = orderWithOtp.deliveryOTP || orderWithOtp.codOtp;
    if (!expectedOtp || expectedOtp !== otp.trim()) {
      return { success: false, error: 'Invalid OTP' };
    }

    // Execute delivery completion
    await Order.findByIdAndUpdate(
      orderId,
      {
        $set: {
          status: 'delivered',
          paymentStatus: 'paid',
          deliveredAt: new Date(),
        },
      },
      { runValidators: false }
    );

    const targetRiderId = orderWithOtp.riderId || authenticatedRiderId;
    if (targetRiderId) {
      await DeliveryPartner.findByIdAndUpdate(targetRiderId, {
        $inc: { currentLoad: -1, totalDeliveries: 1 },
      });
    }

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to mark order as delivered';
    return { success: false, error: message };
  }
}
