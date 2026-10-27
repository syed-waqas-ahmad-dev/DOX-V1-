/**
 * @file app/api/notifications/list/route.ts
 * @description API route to list in-app customer notifications from MongoDB 'notifications' collection.
 * Strict TypeScript: ZERO `any`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { Notification } from '@/models/Notification';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    const conn = await connectToDatabase();
    if (!conn) {
      return NextResponse.json({
        success: true,
        notifications: [
          {
            _id: 'mock-notif-1',
            userId: userId || 'guest',
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

    const filter: Record<string, unknown> = {};
    if (userId) {
      filter.$or = [{ userId }, { userId: 'all' }, { userId: 'guest' }];
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

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
    const body = await req.json().catch(() => ({}));
    const userId = body?.userId;

    const conn = await connectToDatabase();
    if (!conn) {
      return NextResponse.json({
        success: true,
        notifications: [],
        unreadCount: 0,
      });
    }

    const filter: Record<string, unknown> = {};
    if (userId) {
      filter.$or = [{ userId }, { userId: 'all' }, { userId: 'guest' }];
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

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
