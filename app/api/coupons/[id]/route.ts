import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isElevatedAdminRole } from '@/lib/auth-guard';
import { connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { Coupon } from '@/models/Coupon';
import { MockDb } from '@/lib/db/mock-store';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    if (!session?.user || !isElevatedAdminRole((session.user as { role?: string }).role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Administrative clearance required to delete coupons.' },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Coupon ID is required' }, { status: 400 });
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const ok = MockDb.deleteCoupon(id);
      revalidatePath('/admin');
      return NextResponse.json({ success: true, message: 'Coupon deleted successfully', deleted: ok });
    }

    await Coupon.findByIdAndDelete(id);
    MockDb.deleteCoupon(id);

    revalidatePath('/admin');

    return NextResponse.json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to delete coupon';
    return NextResponse.json({ success: false, error: err }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    if (!session?.user || !isElevatedAdminRole((session.user as { role?: string }).role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Administrative clearance required to inspect coupons.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const coupon = MockDb.getAllCoupons().find((c) => c._id?.toString() === id);
      return NextResponse.json({ success: true, data: coupon });
    }

    const coupon = await Coupon.findById(id).lean();
    return NextResponse.json({ success: true, data: coupon });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to get coupon';
    return NextResponse.json({ success: false, error: err }, { status: 500 });
  }
}
