import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { Cart } from '@/models/Cart';
import { resolveCartIdentity, attachGuestCartCookie } from '@/lib/cart-session';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId: providedUserId, productId, quantity = 1, size = '41', color = 'Standard' } = body;

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
        message: 'Added to cart (mock mode)',
        item: { userId, productId, quantity, size, color, createdAt: new Date() },
      });
      return attachGuestCartCookie(res, newGuestCookieId);
    }

    const existing = await Cart.findOne({ userId, productId, size });
    let item;
    if (existing) {
      existing.quantity += Number(quantity) || 1;
      item = await existing.save();
    } else {
      item = await Cart.create({
        userId,
        productId,
        quantity: Number(quantity) || 1,
        size,
        color,
        createdAt: new Date(),
      });
    }

    const res = NextResponse.json({
      success: true,
      message: 'Item added to cart successfully',
      item,
    });
    return attachGuestCartCookie(res, newGuestCookieId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to add item to cart';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
