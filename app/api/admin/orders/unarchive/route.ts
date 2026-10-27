import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { Order } from '@/models/Order';
import { MockDb } from '@/lib/db/mock-store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const mockUpdated = MockDb.unarchiveOrder(orderId);
      if (!mockUpdated) {
        return NextResponse.json(
          { success: false, error: 'Order not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        message: 'Order unarchived / restored successfully',
        order: mockUpdated,
      });
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      { $set: { archived: false } },
      { new: true }
    ).lean();

    if (!order) {
      // Fallback to mock store
      const mockUpdated = MockDb.unarchiveOrder(orderId);
      if (mockUpdated) {
        return NextResponse.json({
          success: true,
          message: 'Order unarchived / restored successfully',
          order: mockUpdated,
        });
      }

      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Order unarchived / restored successfully',
      order,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to unarchive order';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
