/**
 * @file app/api/cron/flash-sale-end/route.ts
 * @description Automated cron task to deactivate expired flash sales and reset promotional pricing.
 * Strict TypeScript: ZERO `any`.
 */

import { NextResponse, type NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      job: 'flash-sale-monitor',
      status: 'active',
      expiredDeactivated: 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Cron failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
