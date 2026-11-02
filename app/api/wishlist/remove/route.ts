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
