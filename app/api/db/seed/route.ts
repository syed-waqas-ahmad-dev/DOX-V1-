/**
 * @file app/api/db/seed/route.ts
 * @description Secure administrative API endpoint to trigger or dry-run database seeding for OX Shoes.
 * Production protection: Strictly disabled in production (process.env.NODE_ENV === 'production').
 * RBAC authorization: Strictly restricted to Super Administrator session.
 * Safe defaults: wipeExisting defaults to FALSE; destructive wiping requires explicit confirmWipe === true.
 * Strict TypeScript: ZERO `any`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserRole } from '@/types';
import { seedDatabase } from '@/lib/db/seed';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Production Safeguard: Never permit database wiping or synthetic re-seeding in production
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: Database seeding is strictly disabled in production environments.',
        },
        { status: 403 }
      );
    }

    // 2. Authentication & RBAC Check: Require authenticated Super Administrator
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }
    const sessionRole = (session?.user as { role?: string } | undefined)?.role;

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required.' },
        { status: 401 }
      );
    }

    if (sessionRole !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only Super Administrators can execute database seeding.' },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      wipeExisting?: boolean;
      confirmWipe?: boolean;
      dryRun?: boolean;
    };

    // 3. Safe Default: Wiping requires BOTH wipeExisting: true AND confirmWipe: true
    const wipe = body.wipeExisting === true && body.confirmWipe === true;

    if (body.dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: 'Dry run successful. Ready to seed 22 authentic Pakistani shoes, 5 categories, 3 users, 3 shipping zones, 5 coupons, and 3 size guides.',
        summary: {
          products: 22,
          categories: 5,
          users: 3,
          shippingZones: 3,
          coupons: 5,
          sizeGuides: 3,
          banners: 3,
          flashSales: 1,
          orders: 1,
          reviews: 1,
        },
      });
    }

    // 4. Execute seeding only in non-production with verified Super Admin credentials
    const results = await seedDatabase(wipe);

    return NextResponse.json({
      success: true,
      message: wipe
        ? 'Database wiped and seeded successfully with baseline records.'
        : 'Baseline records seeded successfully without wiping existing data.',
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Seeding failed';
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
