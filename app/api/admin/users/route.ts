import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { User } from '@/models/User';
import { UserRole } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionRole = (session?.user as any)?.role;
    const sessionEmail = session?.user?.email?.toLowerCase();

    const isAuthorized =
      sessionEmail === 'ahmadsyedwaqas4@gmail.com' ||
      sessionRole === 'super_admin' ||
      sessionRole === 'admin';

    // Allow in development or if authorized
    if (!isAuthorized && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      return NextResponse.json({
        success: true,
        data: [
          {
            _id: 'admin-dawood-khan',
            name: 'Super Admin Ahmad Syed Waqas',
            email: 'ahmadsyedwaqas4@gmail.com',
            phone: '+923265695170',
            role: UserRole.SUPER_ADMIN,
            isEmailVerified: true,
            isPhoneVerified: true,
            createdAt: new Date().toISOString(),
          },
        ],
      });
    }

    const users = await User.find({ isDeleted: { $ne: true } })
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    // Ensure ahmadsyedwaqas4@gmail.com is always represented as SUPER_ADMIN
    const sanitizedUsers = users.map((u) => {
      if (u.email?.toLowerCase() === 'ahmadsyedwaqas4@gmail.com') {
        return { ...u, role: UserRole.SUPER_ADMIN };
      }
      return u;
    });

    return NextResponse.json({
      success: true,
      data: sanitizedUsers,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionRole = (session?.user as any)?.role;
    const sessionEmail = session?.user?.email?.toLowerCase();

    const isAuthorized =
      sessionEmail === 'ahmadsyedwaqas4@gmail.com' ||
      sessionRole === 'super_admin' ||
      sessionRole === 'admin';

    if (!isAuthorized && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { userId, role, isActive } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    await connectToDatabase();

    if (isDatabaseConnected()) {
      const updateData: Record<string, any> = {};
      if (role) updateData.role = role;
      if (typeof isActive === 'boolean') updateData.isActive = isActive;

      const updated = await User.findByIdAndUpdate(userId, updateData, { new: true })
        .select('-password')
        .lean();

      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ success: true, message: 'Updated (mock mode)' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update user' },
      { status: 500 }
    );
  }
}
