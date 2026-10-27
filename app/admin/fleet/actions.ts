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

/**
 * Assigns an order to a rider with super_admin permission and city matching verification.
 */
export async function assignOrderToRider(
  orderId: string,
  riderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'super_admin') {
      return { success: false, error: 'Unauthorized' };
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

    if (session.user.id) {
      updateData.lastUpdatedBy = session.user.id;
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
 */
export async function createRiderBySuperAdmin(data: {
  name: string;
  phone: string;
  password: string;
  city: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'super_admin') {
      return { success: false, error: 'Unauthorized' };
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
      createdByAdminId: session.user.id || 'super_admin',
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create rider';
    return { success: false, error: message };
  }
}

/**
 * Validates delivery OTP and marks the order as delivered and paid.
 * Strictly NO wallet bonus. Decrements rider load when applicable.
 */
export async function riderAction_markDelivered(
  orderId: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'rider') {
      return { success: false, error: 'Unauthorized' };
    }

    if (!orderId || !otp) {
      return { success: false, error: 'Order ID and OTP are required' };
    }

    await connectToDatabase();

    const order = await Order.findById(orderId).select('+codOtp +deliveryOTP');
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    const orderWithOtp = order as unknown as { deliveryOTP?: string; codOtp?: string; riderId?: string };
    const expectedOtp = orderWithOtp.deliveryOTP || orderWithOtp.codOtp;

    if (!expectedOtp || expectedOtp !== otp.trim()) {
      return { success: false, error: 'Invalid OTP' };
    }

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

    if (orderWithOtp.riderId) {
      await DeliveryPartner.findByIdAndUpdate(orderWithOtp.riderId, {
        $inc: { currentLoad: -1, totalDeliveries: 1 },
      });
    }

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to mark order as delivered';
    return { success: false, error: message };
  }
}
