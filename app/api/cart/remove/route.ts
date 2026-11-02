import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { Cart } from '@/models/Cart';
import { resolveCartIdentity, attachGuestCartCookie } from '@/lib/cart-session';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId: providedUserId, productId, size } = body;

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const { userId, newGuestCookieId, unauthorizedResponse } = await resolveCartIdentity(req, providedUserId);
    if (unauthorizedResponse) return unauthorizedResponse;

    const conn = await connectToDatabase();
    if (!conn) {
      const res = NextResponse.json({
        success: true,
        message: 'Removed from cart (mock mode)',
      });
      return attachGuestCartCookie(res, newGuestCookieId);
    }

    const filter: Record<string, unknown> = { userId, productId };
    if (size) {
      filter.size = size;
    }

    await Cart.deleteMany(filter);

    const res = NextResponse.json({
      success: true,
      message: 'Item removed from cart successfully',
    });
    return attachGuestCartCookie(res, newGuestCookieId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to remove item from cart';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
