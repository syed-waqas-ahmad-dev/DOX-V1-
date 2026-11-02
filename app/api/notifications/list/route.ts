import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db/connect';
import { Notification } from '@/models/Notification';

export async function GET(req: NextRequest) {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    // Authenticated user's ID or fallback to 'guest' / broadcast notifications for unauthenticated visitors
    const userId = session?.user?.id || 'guest';

    const conn = await connectToDatabase();
    if (!conn) {
      return NextResponse.json({
        success: true,
        notifications: [
          {
            _id: 'mock-notif-1',
            userId,
            title: 'Welcome to OX Shoes Pakistan 🎉',
            message: 'Nationwide Cash on Delivery with open-box delivery inspection available on all orders.',
            type: 'promotion',
            isRead: false,
            createdAt: new Date(),
          },
        ],
        unreadCount: 1,
      });
    }

    const filter: Record<string, unknown> = {
      $or: [{ userId }, { userId: 'all' }],
    };

    const rawNotifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const notifications = rawNotifications.map((n) => {
      const isReadForUser =
        n.userId === 'all'
          ? Array.isArray(n.readBy) && n.readBy.some((id) => String(id) === String(userId))
          : Boolean(n.isRead);
      return {
        ...n,
        isRead: isReadForUser,
      };
    });

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to retrieve notifications';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    const userId = session?.user?.id || 'guest';

    const conn = await connectToDatabase();
    if (!conn) {
      return NextResponse.json({
        success: true,
        notifications: [],
        unreadCount: 0,
      });
    }

    const filter: Record<string, unknown> = {
      $or: [{ userId }, { userId: 'all' }],
    };

    const rawNotifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const notifications = rawNotifications.map((n) => {
      const isReadForUser =
        n.userId === 'all'
          ? Array.isArray(n.readBy) && n.readBy.some((id) => String(id) === String(userId))
          : Boolean(n.isRead);
      return {
        ...n,
        isRead: isReadForUser,
      };
    });

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to retrieve notifications';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
