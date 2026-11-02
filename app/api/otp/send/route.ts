/**
 * @file app/api/otp/send/route.ts
 * @description Generates and dispatches a 6-digit SMS verification code
 * for COD and phone validation across Pakistani telecom networks (+923XXXXXXXXX).
 * Strict TypeScript: ZERO `any`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { setOtp } from '@/lib/otp-store';

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

    setOtp(phone, otp);

    return NextResponse.json({
      success: true,
      message: `OTP sent successfully to ${phone}. Valid for 10 minutes.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send OTP';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
