import { NextRequest, NextResponse } from 'next/server';
import { canUseMockDatabase, connectToDatabase } from '@/lib/db/connect';
import { Cart } from '@/models/Cart';
import { Product } from '@/models/Product';
import { resolveCartIdentity, attachGuestCartCookie } from '@/lib/cart-session';

async function handleGetCart(req: NextRequest, providedUserId: string | null) {
  const { userId, newGuestCookieId, unauthorizedResponse } = await resolveCartIdentity(req, providedUserId);
  if (unauthorizedResponse) return unauthorizedResponse;

  const conn = await connectToDatabase();
  if (!conn) {
    if (!canUseMockDatabase()) {
      return NextResponse.json(
        { success: false, items: [], error: 'Database connection unavailable.' },
        { status: 503 }
      );
    }
    const res = NextResponse.json({ success: true, items: [] });
    return attachGuestCartCookie(res, newGuestCookieId);
  }

  if (!Product) {
    // Ensure Product model is initialized for population
  }

  const items = await Cart.find({ userId })
    .populate('productId')
    .sort({ createdAt: -1 })
    .lean();

  const res = NextResponse.json({
    success: true,
    items,
  });
  return attachGuestCartCookie(res, newGuestCookieId);
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    return await handleGetCart(req, userId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list cart items';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = body?.userId;
    return await handleGetCart(req, userId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list cart items';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
