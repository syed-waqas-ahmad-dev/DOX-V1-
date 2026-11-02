import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db/connect';
import { Wishlist } from '@/models/Wishlist';
import { Product } from '@/models/Product';

async function handleGetWishlist() {
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch {
    session = null;
  }

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Authentication required to view wishlist.' },
      { status: 401 }
    );
  }

  const userId = session.user.id;

  const conn = await connectToDatabase();
  if (!conn) {
    return NextResponse.json({ success: true, items: [] });
  }

  if (!Product) {
    // Ensure Product model is registered for populate
  }

  const items = await Wishlist.find({ userId })
    .populate('productId')
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({
    success: true,
    items,
  });
}

export async function GET(req: NextRequest) {
  try {
    return await handleGetWishlist();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list wishlist items';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    return await handleGetWishlist();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list wishlist items';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
