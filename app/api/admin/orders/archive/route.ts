/**
 * @file app/api/admin/orders/archive/route.ts
 * @description Secure administrative endpoint to archive orders.
 * Strictly enforced RBAC: ADMIN or SUPER_ADMIN required.
 * Input validation: Valid ObjectId format enforced.
 * Database fail-closed: No mock fallbacks for modifying orders.
 * Strict TypeScript: ZERO `any`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserRole } from '@/types';
import { connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { Order } from '@/models/Order';
import { Types } from 'mongoose';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Authentication & RBAC Check
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }
    const sessionRole = (session?.user as { role?: string } | undefined)?.role;

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required.' },
        { status: 401 }
      );
    }

    const isAuthorized = sessionRole === UserRole.ADMIN || sessionRole === UserRole.SUPER_ADMIN;
    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Administrative privileges required.' },
        { status: 403 }
      );
    }

    // 2. Input Validation
    const body = (await req.json().catch(() => ({}))) as { orderId?: string };
    const { orderId } = body;

    if (!orderId || typeof orderId !== 'string' || orderId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required.' },
        { status: 400 }
      );
    }

    const cleanOrderId = orderId.trim();
    if (!Types.ObjectId.isValid(cleanOrderId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid Order ID format.' },
        { status: 400 }
      );
    }

    // 3. Database Connection & Fail-Closed Behavior
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      return NextResponse.json(
        { success: false, error: 'Database service is currently unavailable.' },
        { status: 503 }
      );
    }

    // 4. Atomic Order Update
    const order = await Order.findByIdAndUpdate(
      cleanOrderId,
      { $set: { archived: true } },
      { new: true }
    ).lean();

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Order archived successfully.',
      order,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to archive order';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
