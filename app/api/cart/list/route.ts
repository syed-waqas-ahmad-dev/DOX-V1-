import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { Cart } from '@/models/Cart';
import { Product } from '@/models/Product';

async function handleGetCart(userId: string | null) {
  if (!userId) {
    return NextResponse.json({ success: true, items: [] });
  }

  const conn = await connectToDatabase();
  if (!conn) {
    return NextResponse.json({ success: true, items: [] });
  }

  if (!Product) {
    // Ensure Product model is initialized for population
  }

  const items = await Cart.find({ userId })
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
    return await handleGetCart(userId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list cart items';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = body?.userId;
    return await handleGetCart(userId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list cart items';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
