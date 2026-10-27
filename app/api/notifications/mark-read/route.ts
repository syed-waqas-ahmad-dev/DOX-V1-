/**
 * @file app/api/notifications/mark-read/route.ts
 * @description API route to mark notifications as read in MongoDB 'notifications' collection.
 * Strict TypeScript: ZERO `any`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { Notification } from '@/models/Notification';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { notificationId, userId, all } = body;

    const conn = await connectToDatabase();
    if (!conn) {
      return NextResponse.json({
        success: true,
        message: 'Marked read (mock mode)',
      });
    }

    if (all) {
      const filter: Record<string, unknown> = {};
      if (userId) {
        filter.$or = [{ userId }, { userId: 'all' }, { userId: 'guest' }];
      }
      await Notification.updateMany(filter, { $set: { isRead: true } });
      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read',
      });
    }

    if (notificationId) {
      await Notification.findByIdAndUpdate(notificationId, { $set: { isRead: true } });
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
    const msg = error instanceof Error ? error.message : 'Failed to mark notification as read';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
