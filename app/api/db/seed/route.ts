/**
 * @file app/api/db/seed/route.ts
 * @description API endpoint to trigger or dry-run database seeding for OX Shoes.
 * Strict TypeScript: ZERO `any`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { seedDatabase } from '@/lib/db/seed';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { wipeExisting?: boolean; dryRun?: boolean };
    const wipe = body.wipeExisting !== false;

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

    // Attempt real database connection & seeding
    const results = await seedDatabase(wipe);

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully with authentic Pakistani footwear and enterprise records!',
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Seeding failed';
    return NextResponse.json(
      {
        success: false,
        error: message,
        tip: 'Ensure MONGODB_URI is configured with valid credentials in your environment or .env.local file.',
      },
      { status: 500 }
    );
  }
}
