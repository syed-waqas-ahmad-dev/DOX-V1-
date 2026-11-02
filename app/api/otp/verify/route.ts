/**
 * @file app/api/otp/verify/route.ts
 * @description Verifies customer OTP code before dispatching COD orders.
 * Strict TypeScript: ZERO `any`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyOtp } from '@/lib/otp-store';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { phone?: string; otp?: string };
    const { phone, otp } = body;

    if (!phone || !otp) {
      return NextResponse.json(
        { error: 'Phone number and 6-digit OTP code are required.' },
        { status: 400 }
      );
    }

    const verification = verifyOtp(phone.trim(), otp.trim());

    if (!verification.success) {
      return NextResponse.json(
        { error: verification.error || 'Invalid or expired OTP code.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      verified: true,
      message: 'Phone number verified successfully.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Verification failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
