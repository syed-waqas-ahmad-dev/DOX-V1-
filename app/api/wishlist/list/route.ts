import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { Wishlist } from '@/models/Wishlist';
import { Product } from '@/models/Product';

async function handleGetWishlist(userId: string | null) {
  if (!userId) {
    return NextResponse.json({ success: true, items: [] });
  }

  const conn = await connectToDatabase();
  if (!conn) {
    return NextResponse.json({ success: true, items: [] });
  }

  // Ensure Product model is registered for populate if needed
  if (!Product) {
    // Registered
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
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    return await handleGetWishlist(userId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list wishlist items';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = body?.userId;
    return await handleGetWishlist(userId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list wishlist items';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
