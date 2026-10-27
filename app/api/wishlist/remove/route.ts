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
      return NextResponse.json({
        success: true,
        message: 'Removed from wishlist (mock mode)',
      });
    }

    await Wishlist.deleteOne({ userId, productId });

    return NextResponse.json({
      success: true,
      message: 'Item removed from wishlist successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to remove item from wishlist';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
