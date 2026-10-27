'use client';

/**
 * @file app/account/notifications/page.tsx
 * @description Customer in-app notifications inbox for OX Shoes Pakistan.
 * Real-time connection with MongoDB 'notifications' collection via /api/notifications/list and /api/notifications/mark-read.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/formatters/date';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import {
  Bell,
  Truck,
  Tag,
  ShieldCheck,
  CheckCheck,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Clock,
  Package,
} from 'lucide-react';

interface NotificationItem {
  _id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export default function AccountNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'order' | 'promotion'>('all');

  useEffect(() => {
    let active = true;
    fetch('/api/notifications/list')
      .then((res) => res.json())
      .then((data) => {
        if (active && data.success && Array.isArray(data.notifications)) {
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount || 0);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    fetch('/api/notifications/list')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.notifications)) {
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount || 0);
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Ignore
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'order') return n.type === 'order_update' || n.type === 'order';
    if (filter === 'promotion') return n.type === 'promotion' || n.type === 'promo';
    return true;
  });

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between selection:bg-neutral-950 selection:text-white">
      <AnnouncementBar />
      <Header onOpenSearch={() => {}} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1 space-y-6">
        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-200 pb-5 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded bg-amber-100 text-amber-800">
                In-App Inbox • 100% Free Stack
              </span>
              <span className="text-xs text-neutral-400">Direct MongoDB Alerts</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-neutral-950 flex items-center gap-2.5">
              <Bell className="h-6 w-6 text-amber-500 fill-amber-500" />
              <span>Notifications & Alerts</span>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-black">
                  {unreadCount} Unread
                </span>
              )}
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Updates regarding order milestones, TCS courier dispatches, and exclusive footwear releases
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 bg-white border border-neutral-300 hover:bg-neutral-100 rounded-full text-neutral-700 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
            </button>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="px-4 py-2 bg-neutral-950 hover:bg-neutral-800 text-white rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark All Read</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 rounded-full transition-colors ${
              filter === 'all'
                ? 'bg-neutral-950 text-white'
                : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('unread')}
            className={`px-3.5 py-1.5 rounded-full transition-colors flex items-center gap-1 ${
              filter === 'unread'
                ? 'bg-neutral-950 text-white'
                : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="h-4 px-1.5 rounded-full bg-amber-400 text-black text-[10px] font-black">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setFilter('order')}
            className={`px-3.5 py-1.5 rounded-full transition-colors ${
              filter === 'order'
                ? 'bg-neutral-950 text-white'
                : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            Orders & Courier
          </button>
          <button
            type="button"
            onClick={() => setFilter('promotion')}
            className={`px-3.5 py-1.5 rounded-full transition-colors ${
              filter === 'promotion'
                ? 'bg-neutral-950 text-white'
                : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            Offers & Deals
          </button>
        </div>

        {/* Notifications List */}
        {loading && notifications.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="h-8 w-8 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-neutral-500 font-medium">Checking for latest notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white border border-neutral-200 space-y-4 shadow-sm">
            <div className="h-16 w-16 bg-neutral-100 text-neutral-400 rounded-full mx-auto flex items-center justify-center">
              <Bell className="h-8 w-8" />
            </div>
            <h3 className="font-bold text-lg text-neutral-950">No Notifications</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
              You are all caught up! When you place an order or your footwear is dispatched via TCS / Leopards courier, updates will appear here automatically.
            </p>
            <div className="pt-2">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md"
              >
                <span>Browse Footwear</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notif) => {
              const isOrder = notif.type === 'order_update' || notif.type === 'order';
              const isPromo = notif.type === 'promotion' || notif.type === 'promo';

              return (
                <div
                  key={notif._id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all flex items-start gap-4 ${
                    notif.isRead
                      ? 'bg-white/70 border-neutral-200 hover:border-neutral-300'
                      : 'bg-white border-amber-400/80 shadow-md ring-1 ring-amber-400/20'
                  }`}
                >
                  <div
                    className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${
                      isOrder
                        ? 'bg-amber-100 text-amber-700'
                        : isPromo
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-neutral-100 text-neutral-800'
                    }`}
                  >
                    {isOrder && <Truck className="h-5 w-5" />}
                    {isPromo && <Tag className="h-5 w-5" />}
                    {!isOrder && !isPromo && <ShieldCheck className="h-5 w-5" />}
                  </div>

                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-sm text-neutral-950 truncate">{notif.title}</h4>
                        {!notif.isRead && (
                          <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                        )}
                      </div>
                      <span className="text-[11px] text-neutral-400 font-medium shrink-0 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(notif.createdAt)}</span>
                      </span>
                    </div>

                    <p className="text-xs text-neutral-600 leading-relaxed">{notif.message}</p>

                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100">
                      {notif.link ? (
                        <Link
                          href={notif.link}
                          className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-800 transition-colors"
                        >
                          <span>View Details</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="text-[11px] text-neutral-400">OX Shoes Verified Update</span>
                      )}

                      {!notif.isRead && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsRead(notif._id)}
                          className="text-[11px] font-bold text-neutral-500 hover:text-neutral-900 transition-colors flex items-center gap-1"
                        >
                          <CheckCheck className="h-3 w-3" />
                          <span>Mark as read</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
