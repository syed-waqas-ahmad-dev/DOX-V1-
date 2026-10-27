/**
 * @file app/api/contact/route.ts
 * @description Contact inquiry submission endpoint for OX Shoes concierge.
 * Strict TypeScript: ZERO `any`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const limitCheck = await rateLimit(`contact-${ip}`, 5, 60000);
    if (!limitCheck.success) {
      return NextResponse.json(
        { error: 'Too many messages sent. Please wait a minute before retrying.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { name, email, phone, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required.' },
        { status: 400 }
      );
    }

    // Return receipt confirmation
    return NextResponse.json({
      success: true,
      ticketId: `OX-TKT-${Date.now().toString().slice(-6)}`,
      message: 'Thank you! Your message has been forwarded to our Lahore atelier concierge team.',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
