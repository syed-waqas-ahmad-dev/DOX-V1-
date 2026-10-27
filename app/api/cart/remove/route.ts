import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { Cart } from '@/models/Cart';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, productId, size } = body;

    if (!userId || !productId) {
      return NextResponse.json(
        { success: false, error: 'Both userId and productId are required' },
        { status: 400 }
      );
    }

    const conn = await connectToDatabase();
    if (!conn) {
      return NextResponse.json({
        success: true,
        message: 'Removed from cart (mock mode)',
      });
    }

    const filter: Record<string, unknown> = { userId, productId };
    if (size) {
      filter.size = size;
    }

    await Cart.deleteMany(filter);

    return NextResponse.json({
      success: true,
      message: 'Item removed from cart successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to remove item from cart';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
