import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { Cart } from '@/models/Cart';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, productId, size, quantity } = body;

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
        message: 'Cart quantity updated (mock mode)',
      });
    }

    const qty = Number(quantity);
    const filter: Record<string, unknown> = { userId, productId };
    if (size) {
      filter.size = size;
    }

    if (qty <= 0) {
      await Cart.deleteMany(filter);
      return NextResponse.json({
        success: true,
        message: 'Item removed from cart',
      });
    }

    const updated = await Cart.findOneAndUpdate(
      filter,
      { $set: { quantity: qty } },
      { new: true }
    );

    return NextResponse.json({
      success: true,
      message: 'Cart quantity updated successfully',
      item: updated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update cart quantity';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
