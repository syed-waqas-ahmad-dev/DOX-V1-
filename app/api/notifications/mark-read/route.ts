import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db/connect';
import { Notification } from '@/models/Notification';

export async function POST(req: NextRequest) {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required to mark notifications as read.' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await req.json().catch(() => ({}));
    const { notificationId, all } = body;

    const conn = await connectToDatabase();
    if (!conn) {
      return NextResponse.json({
        success: true,
        message: 'Marked read (mock mode)',
      });
    }

    if (all) {
      await Notification.updateMany({ userId }, { $set: { isRead: true } });
      await Notification.updateMany({ userId: 'all' }, { $addToSet: { readBy: userId } });
      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read',
      });
    }

    if (notificationId) {
      const target = await Notification.findOne({
        _id: notificationId,
        $or: [{ userId }, { userId: 'all' }],
      });

      if (!target) {
        return NextResponse.json(
          { success: false, error: 'Notification not found or access denied.' },
          { status: 404 }
        );
      }

      if (target.userId === 'all') {
        await Notification.updateOne(
          { _id: notificationId },
          { $addToSet: { readBy: userId } }
        );
      } else {
        await Notification.updateOne(
          { _id: notificationId, userId },
          { $set: { isRead: true } }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Notification marked as read',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Provide notificationId or all: true' },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to mark notification as read';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
