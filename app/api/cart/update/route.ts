import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { Cart } from '@/models/Cart';
import { resolveCartIdentity, attachGuestCartCookie } from '@/lib/cart-session';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId: providedUserId, productId, size, quantity } = body;

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
        message: 'Cart quantity updated (mock mode)',
      });
      return attachGuestCartCookie(res, newGuestCookieId);
    }

    const qty = Number(quantity);
    const filter: Record<string, unknown> = { userId, productId };
    if (size) {
      filter.size = size;
    }

    if (qty <= 0) {
      await Cart.deleteMany(filter);
      const res = NextResponse.json({
        success: true,
        message: 'Item removed from cart',
      });
      return attachGuestCartCookie(res, newGuestCookieId);
    }

    const updated = await Cart.findOneAndUpdate(
      filter,
      { $set: { quantity: qty } },
      { new: true }
    );

    const res = NextResponse.json({
      success: true,
      message: 'Cart quantity updated successfully',
      item: updated,
    });
    return attachGuestCartCookie(res, newGuestCookieId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update cart quantity';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
