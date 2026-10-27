import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { Cart } from '@/models/Cart';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, productId, quantity = 1, size = '41', color = 'Standard' } = body;

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
        message: 'Added to cart (mock mode)',
        item: { userId, productId, quantity, size, color, createdAt: new Date() },
      });
    }

    const existing = await Cart.findOne({ userId, productId, size });
    let item;
    if (existing) {
      existing.quantity += Number(quantity) || 1;
      item = await existing.save();
    } else {
      item = await Cart.create({
        userId,
        productId,
        quantity: Number(quantity) || 1,
        size,
        color,
        createdAt: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Item added to cart successfully',
      item,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to add item to cart';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
