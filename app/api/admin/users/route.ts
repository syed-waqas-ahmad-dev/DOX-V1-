import { NextRequest, NextResponse } from 'next/server';
import { verifyDepartmentAuth, verifySuperAdminAuth } from '@/lib/auth-guard';
import { connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { User } from '@/models/User';
import { UserRole } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyDepartmentAuth({ allowElevatedAdmin: true });

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Access Denied: Administrative privileges required.' },
        { status: 401 }
      );
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      return NextResponse.json(
        { success: false, error: 'Database service is currently unavailable.' },
        { status: 503 }
      );
    }

    const users = await User.find({ isDeleted: { $ne: true } })
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: users,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch users';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await verifyDepartmentAuth({ allowElevatedAdmin: true });

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized: Administrative access required.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { userId, role, isActive } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required.' },
        { status: 400 }
      );
    }

    // Role elevation / modification is strictly restricted to SUPER_ADMIN (live check)
    if (role !== undefined) {
      const superAdminAuth = await verifySuperAdminAuth();
      if (!superAdminAuth.authorized) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Only Super Administrators can modify user roles.' },
          { status: 403 }
        );
      }
    }

    // Prevent assigning invalid roles
    if (role && !Object.values(UserRole).includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid user role requested.' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      return NextResponse.json(
        { success: false, error: 'Database connection is unavailable.' },
        { status: 503 }
      );
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'Target user not found.' },
        { status: 404 }
      );
    }

    // Protect Super Admin accounts from being demoted by unauthorized actions
    if (targetUser.role === UserRole.SUPER_ADMIN && role && role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { success: false, error: 'Super Admin accounts cannot be demoted via this endpoint.' },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (role) updateData.role = role;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    const updated = await User.findByIdAndUpdate(userId, updateData, { new: true })
      .select('-password')
      .lean();

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update user';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
