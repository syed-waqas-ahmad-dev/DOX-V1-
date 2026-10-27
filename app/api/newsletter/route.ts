/**
 * @file app/api/newsletter/route.ts
 * @description Captures customer emails for new drops, Eid deals, and discount vouchers.
 * Strict TypeScript: ZERO `any`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { Newsletter } from '@/models/Newsletter';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string };
    const email = body.email?.trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const existing = await Newsletter.findOne({ email });
    if (!existing) {
      await Newsletter.create({ email, isActive: true, source: 'storefront_footer' });
    }

    return NextResponse.json({
      success: true,
      message: 'Thank you! You have subscribed to OX Shoes exclusive drops & Eid vouchers.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Subscription error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
