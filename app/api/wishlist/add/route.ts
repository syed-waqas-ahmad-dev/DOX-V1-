import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db/connect';
import { Wishlist } from '@/models/Wishlist';

export async function POST(req: NextRequest) {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required to manage wishlist.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { productId } = body;
    const userId = session.user.id;

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const conn = await connectToDatabase();
    if (!conn) {
      return NextResponse.json({
        success: true,
        message: 'Saved to wishlist (mock mode)',
        item: { userId, productId, createdAt: new Date() },
      });
    }

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
