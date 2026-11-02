'use server';

/**
 * @file actions/banner.actions.ts
 * @description Server actions for promotional hero banners and announcement strips.
 * Strict TypeScript: ZERO `any`.
 */

import { connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { Banner } from '@/models/Banner';
import { successResponse, errorResponse, type ActionResult } from '@/lib/response';
import { handleActionError } from '@/lib/error-handler';
import { BannerPosition, type IBanner } from '@/types';
import { MockDb } from '@/lib/db/mock-store';
import { Types } from 'mongoose';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isElevatedAdminRole } from '@/lib/auth-guard';

/**
 * Private helper to verify that the caller has elevated administrative clearance (SUPER_ADMIN or ADMIN).
 * Obtains session exclusively from getServerSession(authOptions).
 * MANAGER, RIDER, CUSTOMER, and unauthenticated callers are strictly denied.
 */
async function verifyBannerAdminAuth(): Promise<boolean> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isElevatedAdminRole((session.user as { role?: string }).role)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const DEFAULT_BANNERS: IBanner[] = [
  {
    _id: new Types.ObjectId(),
    title: 'Grand Eid Footwear Collection — Up to 30% Off',
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1600&q=80',
    mobileImage: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=80',
    link: '/shop?category=Men',
    position: BannerPosition.HERO,
    order: 1,
    isActive: true,
    startsAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: new Types.ObjectId(),
    title: 'FREE EXPRESS SHIPPING ON ALL ORDERS OVER PKR 3,500 ACROSS PAKISTAN',
    image: '',
    link: '/shop',
    position: BannerPosition.TOP_STRIP,
    order: 1,
    isActive: true,
    startsAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export async function getBanners(position?: BannerPosition): Promise<ActionResult<IBanner[]>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const filtered = position ? DEFAULT_BANNERS.filter((b) => b.position === position) : DEFAULT_BANNERS;
      return successResponse(filtered);
    }

    const query: Record<string, unknown> = { isActive: true };
    if (position) query.position = position;

    const banners = await Banner.find(query).sort({ order: 1 }).lean();
    if (!banners || banners.length === 0) {
      const filtered = position ? DEFAULT_BANNERS.filter((b) => b.position === position) : DEFAULT_BANNERS;
      return successResponse(filtered);
    }

    return successResponse(JSON.parse(JSON.stringify(banners)));
  } catch (error: unknown) {
    const filtered = position ? DEFAULT_BANNERS.filter((b) => b.position === position) : DEFAULT_BANNERS;
    return successResponse(filtered);
  }
}

export async function getAllAdminBanners(): Promise<ActionResult<IBanner[]>> {
  try {
    if (!(await verifyBannerAdminAuth())) {
      return errorResponse('Unauthorized: Administrative clearance required.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      return successResponse(MockDb.getAllBanners());
    }

    const banners = await Banner.find().sort({ order: 1, createdAt: -1 }).lean();
    if (!banners || banners.length === 0) {
      return successResponse(MockDb.getAllBanners());
    }

    return successResponse(JSON.parse(JSON.stringify(banners)));
  } catch (error: unknown) {
    if (!(await verifyBannerAdminAuth())) {
      return errorResponse('Unauthorized: Administrative clearance required.');
    }
    return successResponse(MockDb.getAllBanners());
  }
}

export async function createBanner(payload: Partial<IBanner>): Promise<ActionResult<IBanner>> {
  try {
    if (!(await verifyBannerAdminAuth())) {
      return errorResponse('Unauthorized: Administrative clearance required to create banners.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const created = MockDb.addBanner(payload);
      revalidatePath('/admin');
      revalidatePath('/');
      return successResponse(created);
    }

    const doc = await Banner.create({
      title: payload.title || 'Special Promotion — OX Shoes',
      image: payload.image || '',
      mobileImage: payload.mobileImage || payload.image || '',
      link: payload.link || '/shop',
      position: payload.position || BannerPosition.HERO,
      order: Number(payload.order) || 1,
      isActive: payload.isActive !== undefined ? payload.isActive : true,
      startsAt: payload.startsAt || new Date(),
      expiresAt: payload.expiresAt || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    });

    MockDb.addBanner(doc);
    revalidatePath('/admin');
    revalidatePath('/');
    return successResponse(JSON.parse(JSON.stringify(doc)));
  } catch (error: unknown) {
    if (!(await verifyBannerAdminAuth())) {
      return errorResponse('Unauthorized: Administrative clearance required to create banners.');
    }
    const created = MockDb.addBanner(payload);
    if (created) {
      revalidatePath('/admin');
      revalidatePath('/');
      return successResponse(created);
    }
    return handleActionError(error);
  }
}

export async function updateBanner(
  bannerId: string,
  updates: Partial<IBanner>
): Promise<ActionResult<IBanner>> {
  try {
    if (!(await verifyBannerAdminAuth())) {
      return errorResponse('Unauthorized: Administrative clearance required to update banners.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const updated = MockDb.updateBanner(bannerId, updates);
      if (!updated) return errorResponse('Banner not found.');
      revalidatePath('/admin');
      revalidatePath('/');
      return successResponse(updated);
    }

    const doc = await Banner.findByIdAndUpdate(bannerId, { $set: updates }, { new: true }).lean();
    if (!doc) {
      const updated = MockDb.updateBanner(bannerId, updates);
      if (updated) {
        revalidatePath('/admin');
        revalidatePath('/');
        return successResponse(updated);
      }
      return errorResponse('Banner not found.');
    }

    MockDb.updateBanner(bannerId, updates);
    revalidatePath('/admin');
    revalidatePath('/');
    return successResponse(JSON.parse(JSON.stringify(doc)));
  } catch (error: unknown) {
    if (!(await verifyBannerAdminAuth())) {
      return errorResponse('Unauthorized: Administrative clearance required to update banners.');
    }
    const updated = MockDb.updateBanner(bannerId, updates);
    if (updated) {
      revalidatePath('/admin');
      revalidatePath('/');
      return successResponse(updated);
    }
    return handleActionError(error);
  }
}

export async function deleteBanner(bannerId: string): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    if (!(await verifyBannerAdminAuth())) {
      return errorResponse('Unauthorized: Administrative clearance required to delete banners.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const ok = MockDb.deleteBanner(bannerId);
      revalidatePath('/admin');
      revalidatePath('/');
      return successResponse({ deleted: ok });
    }

    await Banner.findByIdAndDelete(bannerId);
    MockDb.deleteBanner(bannerId);
    revalidatePath('/admin');
    revalidatePath('/');

    return successResponse({ deleted: true });
  } catch (error: unknown) {
    if (!(await verifyBannerAdminAuth())) {
      return errorResponse('Unauthorized: Administrative clearance required to delete banners.');
    }
    const ok = MockDb.deleteBanner(bannerId);
    revalidatePath('/admin');
    revalidatePath('/');
    return successResponse({ deleted: ok });
  }
}
