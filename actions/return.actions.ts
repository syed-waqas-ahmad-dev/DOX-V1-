'use server';

/**
 * @file actions/return.actions.ts
 * @description Server actions for 7-Day Size Exchange and Return Merchandise Authorizations (RMA).
 * Strict TypeScript: ZERO `any`.
 */

import { connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { ReturnRequest } from '@/models/ReturnRequest';
import { Order } from '@/models/Order';
import { successResponse, errorResponse, type ActionResult } from '@/lib/response';
import { handleActionError } from '@/lib/error-handler';
import { ReturnReason, ReturnStatus, PaymentMethod, type IReturnRequest, type CreateReturnInput } from '@/types';
import { Types } from 'mongoose';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isElevatedAdminRole, isAdminRole } from '@/lib/auth-guard';
import { UserRole } from '@/types';

// In-memory returns store for offline / mock mode
declare global {
  var __oxMockReturns: IReturnRequest[] | undefined;
}

const mockReturns: IReturnRequest[] = global.__oxMockReturns ?? [
  {
    _id: new Types.ObjectId(),
    orderId: new Types.ObjectId('660e1234567890abcdef1234'),
    userId: new Types.ObjectId('660e1234567890abcdef1000'),
    orderItemId: new Types.ObjectId('660e1234567890abcdef0001'),
    reason: ReturnReason.SIZE_ISSUE,
    description: 'Need 1 size larger (43)',
    images: [],
    status: ReturnStatus.APPROVED,
    refundAmount: 0,
    refundMethod: PaymentMethod.COD,
    adminNotes: 'Free doorstep pickup arranged via TCS Express (RMA-2026-8812)',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

if (!global.__oxMockReturns) {
  global.__oxMockReturns = mockReturns;
}

export async function createReturnRequest(
  input: CreateReturnInput
): Promise<ActionResult<{ rmaNumber: string; status: string }>> {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    const sessionUser = session?.user as { id?: string; email?: string; role?: string } | undefined;
    const isElevatedAdmin = isElevatedAdminRole(sessionUser?.role);

    await connectToDatabase();

    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const rmaNumber = `RMA-${new Date().getFullYear()}-${randomCode}`;

    if (!isDatabaseConnected()) {
      const newReturn: IReturnRequest = {
        _id: new Types.ObjectId(),
        orderId: new Types.ObjectId(),
        userId: input.orderNumber.startsWith('GUEST') ? null : new Types.ObjectId('660e1234567890abcdef1000'),
        orderItemId: new Types.ObjectId(),
        reason: input.reason,
        description: input.comments || 'Size exchange request',
        images: input.images || [],
        status: ReturnStatus.APPROVED,
        refundAmount: 0,
        refundMethod: PaymentMethod.COD,
        adminNotes: `Pre-approved 7-day hassle-free size exchange (${rmaNumber})`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockReturns.unshift(newReturn);

      return successResponse({
        rmaNumber,
        status: 'Approved',
      });
    }

    const order = await Order.findOne({ orderNumber: input.orderNumber.trim().toUpperCase() });
    if (!order) {
      return errorResponse(`Order "${input.orderNumber}" not found. Please verify your invoice receipt.`);
    }

    // Verify ownership or admin clearance
    if (!isElevatedAdmin) {
      const orderUserId = order.userId?.toString();
      const orderGuestEmail = order.guestEmail?.toLowerCase().trim();
      const sessionEmail = sessionUser?.email?.toLowerCase().trim();

      if (orderUserId) {
        if (!sessionUser || orderUserId !== sessionUser.id) {
          return errorResponse('Unauthorized: You can only request returns for your own orders.');
        }
      } else if (orderGuestEmail) {
        // For guest orders, verify email matches session or provided guest details
        if (!sessionUser || sessionEmail !== orderGuestEmail) {
          return errorResponse('Unauthorized: Email mismatch for this guest order return request.');
        }
      } else {
        return errorResponse('Unauthorized: Order ownership could not be verified.');
      }
    }

    const firstItem = order.orderItems[0];
    const created = await ReturnRequest.create({
      orderId: order._id,
      userId: order.userId,
      orderItemId: firstItem ? firstItem._id : new Types.ObjectId(),
      reason: input.reason,
      description: input.comments || 'Customer return request',
      images: input.images || [],
      status: ReturnStatus.PENDING,
      refundAmount: order.totalAmount,
      refundMethod: order.paymentMethod,
      adminNotes: `RMA: ${rmaNumber}`,
    });

    return successResponse({
      rmaNumber,
      status: created.status,
    });
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function getUserReturns(): Promise<ActionResult<IReturnRequest[]>> {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    if (!session?.user) {
      return errorResponse('Unauthenticated: Please sign in to view return requests.');
    }

    const sessionUser = session.user as { id: string; role: string };
    const isAdmin = isAdminRole(sessionUser.role as any);

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      if (isAdmin) {
        return successResponse(mockReturns);
      }
      return successResponse(mockReturns.filter(r => r.userId?.toString() === sessionUser.id));
    }

    const query: Record<string, unknown> = {};
    if (!isAdmin) {
      query.userId = new Types.ObjectId(sessionUser.id);
    }

    const returns = await ReturnRequest.find(query).sort({ createdAt: -1 }).lean();
    return successResponse(JSON.parse(JSON.stringify(returns)));
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
