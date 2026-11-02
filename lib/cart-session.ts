/**
 * @file lib/cart-session.ts
 * @description Secure helper for resolving cart identity across cart API routes.
 * Enforces session authentication for user carts, rejects impersonation attempts,
 * and binds guest carts to server-issued HTTP-only cookies.
 * Strict TypeScript: ZERO `any`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export interface CartIdentityResult {
  userId?: string;
  newGuestCookieId?: string;
  unauthorizedResponse?: NextResponse;
}

export async function resolveCartIdentity(
  req: NextRequest,
  providedUserId?: string | null
): Promise<CartIdentityResult> {
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch {
    session = null;
  }

  // 1. Authenticated User
  if (session?.user?.id) {
    const sessionUserId = session.user.id;
    const cleanProvided = (providedUserId || '').trim();
    if (cleanProvided && cleanProvided !== sessionUserId) {
      return {
        unauthorizedResponse: NextResponse.json(
          { success: false, error: 'Unauthorized: Authentication required to access user cart.' },
          { status: 401 }
        ),
      };
    }
    return { userId: sessionUserId };
  }

  // 2. Unauthenticated User (Guest)
  const cleanProvided = (providedUserId || '').trim();
  if (cleanProvided && !cleanProvided.startsWith('guest') && !cleanProvided.startsWith('anonymous') && !cleanProvided.includes('-guest-')) {
    return {
      unauthorizedResponse: NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required to access user cart.' },
        { status: 401 }
      ),
    };
  }

  // Derive guest identity from HTTP-Only cookie, ignoring arbitrary client-controlled strings
  let guestCookieId = req.cookies.get('guest_cart_id')?.value;
  let newGuestCookieId: string | undefined = undefined;

  if (!guestCookieId || !/^guest_[a-f0-9\-]{36}$/i.test(guestCookieId)) {
    guestCookieId = `guest_${crypto.randomUUID()}`;
    newGuestCookieId = guestCookieId;
  }

  return {
    userId: guestCookieId,
    newGuestCookieId,
  };
}

export function attachGuestCartCookie(res: NextResponse, newGuestCookieId?: string): NextResponse {
  if (newGuestCookieId) {
    res.cookies.set('guest_cart_id', newGuestCookieId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });
  }
  return res;
}
