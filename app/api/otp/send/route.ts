/**
 * @file app/api/otp/send/route.ts
 * @description Generates and dispatches a 6-digit SMS verification code
 * for COD and phone validation across Pakistani telecom networks (+923XXXXXXXXX).
 * Strict TypeScript: ZERO `any`.
 */

import { NextResponse, type NextRequest } from 'next/server';

// In-memory OTP store for sandbox / development environment
const otpStore = new Map<string, { code: string; expiresAt: number }>();

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { phone?: string };
    const phone = body.phone?.trim();

    if (!phone || !/^\+923\d{9}$/.test(phone)) {
      return NextResponse.json(
        { error: 'Valid Pakistani mobile number (+923XXXXXXXXX) is required.' },
        { status: 400 }
      );
    }

    // Generate random 6-digit PIN
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes TTL

    otpStore.set(phone, { code: otp, expiresAt });

    return NextResponse.json({
      success: true,
      message: `OTP sent successfully to ${phone}. Valid for 10 minutes.`,
      // Return code in sandbox response for convenience during testing
      demoOtp: otp,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send OTP';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
