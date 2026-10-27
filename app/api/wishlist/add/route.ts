import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { Wishlist } from '@/models/Wishlist';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, productId } = body;

    if (!userId || !productId) {
      return NextResponse.json(
        { success: false, error: 'Both userId and productId are required' },
        { status: 400 }
      );
    }

    const conn = await connectToDatabase();
    if (!conn) {
      // Mock mode fallback when database is not connected
      return NextResponse.json({
        success: true,
        message: 'Saved to wishlist (mock mode)',
        item: { userId, productId, createdAt: new Date() },
      });
    }

    // Upsert or create item in wishlists collection
    const item = await Wishlist.findOneAndUpdate(
      { userId, productId },
      { userId, productId, createdAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({
      success: true,
      message: 'Item added to wishlist successfully',
      item,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to add item to wishlist';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
