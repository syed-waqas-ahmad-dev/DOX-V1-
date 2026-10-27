/**
 * @file app/api/notifications/send/route.ts
 * @description API route for Admin to dispatch in-app notifications (Single Customer or All Customers).
 * 100% Free Stack using MongoDB notifications collection.
 * Strict TypeScript: ZERO `any`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { Notification } from '@/models/Notification';
import { User } from '@/models/User';
import { NotificationType } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { target, userId, title, message, type = 'promotion', link = '' } = body;

    if (!title || !message) {
      return NextResponse.json(
        { success: false, error: 'Both title and message are required' },
        { status: 400 }
      );
    }

    const conn = await connectToDatabase();
    if (!conn) {
      return NextResponse.json({
        success: true,
        message: 'Notification dispatched (mock mode)',
        count: target === 'all' ? 10 : 1,
      });
    }

    const notifType = Object.values(NotificationType).includes(type as NotificationType)
      ? (type as NotificationType)
      : NotificationType.PROMOTION;

    if (target === 'all') {
      // Find all users or insert broadcast
      const users = await User.find({ isActive: true }).select('_id').lean();
      if (users.length > 0) {
        const docs = users.map((u) => ({
          userId: u._id.toString(),
          title,
          message,
          type: notifType,
          link: link || '/shop',
          isRead: false,
          createdAt: new Date(),
        }));
        // Also insert an 'all' broadcast for guest / new visitors
        docs.push({
          userId: 'all',
          title,
          message,
          type: notifType,
          link: link || '/shop',
          isRead: false,
          createdAt: new Date(),
        });
        await Notification.insertMany(docs);
        return NextResponse.json({
          success: true,
          message: `Dispatched to ${docs.length} recipients`,
          count: docs.length,
        });
      } else {
        const doc = await Notification.create({
          userId: 'all',
          title,
          message,
          type: notifType,
          link: link || '/shop',
          isRead: false,
          createdAt: new Date(),
        });
        return NextResponse.json({
          success: true,
          message: 'Broadcast notification created for all customers',
          notification: doc,
          count: 1,
        });
      }
    } else {
      if (!userId) {
        return NextResponse.json(
          { success: false, error: 'Customer / User ID is required for single target' },
          { status: 400 }
        );
      }

      const doc = await Notification.create({
        userId,
        title,
        message,
        type: notifType,
        link: link || '/dashboard/orders',
        isRead: false,
        createdAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        message: 'Notification sent successfully to customer',
        notification: doc,
        count: 1,
      });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to send notification';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
