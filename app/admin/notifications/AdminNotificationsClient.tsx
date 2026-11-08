'use client';

/**
 * @file app/admin/notifications/page.tsx
 * @description Admin Notification Management Suite for OX Shoes Pakistan.
 * 100% Free Stack — No paid external notification services.
 * Features:
 *  - Send to Single Customer
 *  - Send to All Customers (Broadcast)
 *  - 1-Click Message Templates (Order Dispatched, Delivered, Promo, Eid, COD)
 *  - Live List of Sent Notifications from MongoDB
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/formatters/date';
import { Logo } from '@/components/layout/Logo';
import {
  Bell,
  Send,
  Users,
  User,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  ArrowLeft,
  FileText,
  Tag,
  Truck,
  ShieldCheck,
  Megaphone,
} from 'lucide-react';

interface SentNotification {
  _id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

const TEMPLATES = [
  {
    id: 'dispatch',
    name: 'Order Dispatched (TCS)',
    icon: Truck,
    type: 'order_update',
    title: 'Order Dispatched! 🚚',
    message: 'Hello, your OX Shoes order has been dispatched via TCS Express courier. Expected delivery within 2-3 business days with Cash on Delivery.',
    link: '/dashboard/orders',
  },
  {
    id: 'delivered',
    name: 'Order Delivered',
    icon: CheckCircle2,
    type: 'order_update',
    title: 'Order Delivered! 🎉',
    message: 'Your OX Shoes handcrafted footwear has been delivered. Thank you for shopping with us! Enjoy your open-box verified shoes.',
    link: '/dashboard/orders',
  },
  {
    id: 'eid_drop',
    name: 'Heritage Footwear Drop',
    icon: Sparkles,
    type: 'promotion',
    title: 'New Peshawari & Norozi Collection Live ✨',
    message: 'Explore our latest authentic cow-leather Peshawari and Norozi chappals, handcrafted in KP and ready for nationwide Cash on Delivery.',
    link: '/shop',
  },
  {
    id: 'flash_sale',
    name: 'Flash Sale (20% Off)',
    icon: Tag,
    type: 'promotion',
    title: 'Flash Sale: 20% Off Selected Footwear 🏷️',
    message: 'Limited time flash sale is now live! Use code OX20 at checkout for instant 20% discount on all casuals and formals.',
    link: '/shop',
  },
  {
    id: 'cod_confirm',
    name: 'COD Order Confirmed',
    icon: ShieldCheck,
    type: 'order_update',
    title: 'COD Order Confirmed ✅',
    message: 'Your Cash on Delivery order is verified and is being prepared for dispatch. No advance payment required.',
    link: '/dashboard/orders',
  },
];

export default function AdminNotificationsPage() {
  const [activeTab, setActiveTab] = useState<'send' | 'history'>('send');
  const [targetType, setTargetType] = useState<'all' | 'single'>('all');
  const [userId, setUserId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [notificationType, setNotificationType] = useState<string>('promotion');
  const [linkUrl, setLinkUrl] = useState<string>('');

  const [sending, setSending] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [history, setHistory] = useState<SentNotification[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/notifications/list');
      const data = await res.json();
      if (data.success && Array.isArray(data.notifications)) {
        setHistory(data.notifications);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch('/api/notifications/list')
      .then((res) => res.json())
      .then((data) => {
        if (active && data.success && Array.isArray(data.notifications)) {
          setHistory(data.notifications);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingHistory(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleApplyTemplate = (tpl: (typeof TEMPLATES)[0]) => {
    setTitle(tpl.title);
    setMessage(tpl.message);
    setNotificationType(tpl.type);
    setLinkUrl(tpl.link);
    setStatusMessage({ type: 'success', text: `Template "${tpl.name}" applied!` });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setStatusMessage({ type: 'error', text: 'Please fill in both title and message body.' });
      return;
    }

    if (targetType === 'single' && !userId.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a target Customer ID or Phone for single send.' });
      return;
    }

    setSending(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: targetType,
          userId: targetType === 'single' ? userId.trim() : undefined,
          title: title.trim(),
          message: message.trim(),
          type: notificationType,
          link: linkUrl.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: targetType === 'all'
            ? 'Broadcast notification successfully created for all customers!'
            : `Notification successfully sent to customer ${userId}!`,
        });
        setTitle('');
        setMessage('');
        setLinkUrl('');
        loadHistory();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to dispatch notification.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Network error while dispatching notification.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
      {/* Admin Navbar */}
      <header className="border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Logo theme="dark" size="sm" withLink={false} />
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-amber-500 text-black uppercase tracking-widest">
            Customer Notifications Hub
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <Link
            href="/admin"
            className="text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Admin ERP</span>
          </Link>
          <Link
            href="/admin/customers"
            className="text-neutral-400 hover:text-white transition-colors"
          >
            Customers
          </Link>
          <Link
            href="/account/notifications"
            target="_blank"
            className="text-amber-400 hover:text-amber-300 font-bold transition-colors"
          >
            Live Customer View ↗
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-6">
        {/* Banner */}
        <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                100% Free Notification Architecture
              </span>
              <span className="text-xs text-neutral-400">Zero Paid Services</span>
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2.5">
              <Megaphone className="h-6 w-6 text-amber-400" />
              <span>Customer Notification Center</span>
            </h1>
            <p className="text-xs text-neutral-400 max-w-2xl leading-relaxed">
              Notify customers instantly using in-app alerts stored directly in MongoDB <code className="text-amber-400 font-mono">notifications</code> collection or send direct <code className="text-emerald-400 font-mono">wa.me</code> WhatsApp messages without any third-party fees.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('send')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                activeTab === 'send'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
              }`}
            >
              Compose & Send
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('history');
                loadHistory();
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
              }`}
            >
              <span>Sent History ({history.length})</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Compose & Send */}
        {activeTab === 'send' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Form */}
            <div className="lg:col-span-2 space-y-6">
              <form onSubmit={handleSend} className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-5">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <Send className="h-4 w-4 text-amber-400" />
                    <span>Dispatch In-App Notification</span>
                  </h3>
                  <span className="text-[11px] text-neutral-400">Stores in MongoDB Collection</span>
                </div>

                {statusMessage && (
                  <div
                    className={`p-3.5 rounded-2xl text-xs flex items-center gap-2 ${
                      statusMessage.type === 'success'
                        ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                        : 'bg-red-950/60 border border-red-500/40 text-red-300'
                    }`}
                  >
                    {statusMessage.type === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                    )}
                    <span>{statusMessage.text}</span>
                  </div>
                )}

                {/* Recipient Target Radio */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-300 block">Recipient Target</label>
                  <div className="grid grid-cols-2 gap-3 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setTargetType('all')}
                      className={`p-3 rounded-2xl border transition-colors flex items-center gap-2.5 ${
                        targetType === 'all'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                          : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <Users className="h-4 w-4" />
                      <span>Send to All Customers (Broadcast)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTargetType('single')}
                      className={`p-3 rounded-2xl border transition-colors flex items-center gap-2.5 ${
                        targetType === 'single'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                          : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <User className="h-4 w-4" />
                      <span>Send to Single Customer</span>
                    </button>
                  </div>
                </div>

                {targetType === 'single' && (
                  <div className="space-y-1.5 animate-in fade-in">
                    <label className="text-xs font-bold text-neutral-300 block">
                      Customer ID / User ID / Phone Number
                    </label>
                    <input
                      type="text"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      placeholder="e.g. 660f8b1c4e92... or customer phone 03001234567"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                )}

                {/* Type Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-300 block">Notification Category</label>
                    <select
                      value={notificationType}
                      onChange={(e) => setNotificationType(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="promotion">Promotion & Deals</option>
                      <option value="order_update">Order Update & Courier</option>
                      <option value="system">System Announcement</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-300 block">
                      Target Link <span className="text-neutral-500 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="/shop or /track?order=OX-..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300 block">
                    Notification Headline / Title <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Flash Sale: 20% Off Leather Chappals"
                    maxLength={150}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>

                {/* Message Body */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300 block">
                    Message Body <span className="text-amber-400">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write the message text that will display on the customer's /account/notifications page..."
                    maxLength={1000}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white focus:outline-none focus:border-amber-500 leading-relaxed resize-none"
                  />
                  <div className="text-right text-[10px] text-neutral-500">
                    {message.length}/1000 characters
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[11px] text-neutral-400">
                    Free & Instant: Zero third-party fees
                  </span>
                  <button
                    type="submit"
                    disabled={sending}
                    className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    <span>{sending ? 'Dispatching...' : 'Dispatch Notification'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Right 1 Col: Quick Templates */}
            <div className="space-y-4">
              <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <FileText className="h-4 w-4 text-amber-400" />
                    <span>1-Click Message Templates</span>
                  </h3>
                  <span className="text-[10px] text-neutral-400">Tap to load</span>
                </div>

                <div className="space-y-2.5">
                  {TEMPLATES.map((tpl) => {
                    const Icon = tpl.icon;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => handleApplyTemplate(tpl)}
                        className="w-full p-3 rounded-2xl bg-neutral-950/60 border border-neutral-800 hover:border-amber-500/60 hover:bg-neutral-800/50 transition-all text-left group space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white group-hover:text-amber-400 flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                            <span>{tpl.name}</span>
                          </span>
                          <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
                            Apply →
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                          {tpl.message}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* WhatsApp wa.me Shortcut Card */}
              <div className="p-5 rounded-3xl bg-emerald-950/30 border border-emerald-500/30 space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <Sparkles className="h-4 w-4" />
                  <span>WhatsApp Direct (wa.me)</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Need to send an individual customer a WhatsApp message directly from your phone or web browser? Open the <strong>Orders</strong> or <strong>Customers</strong> tab and tap the <strong>WhatsApp</strong> button next to any order.
                </p>
                <div className="pt-1">
                  <Link
                    href="/admin"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300"
                  >
                    <span>View Orders on Admin ERP</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Sent Notifications History */}
        {activeTab === 'history' && (
          <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  <span>Sent Notifications History ({history.length})</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  All alerts recorded in MongoDB <code className="text-amber-400 font-mono">notifications</code> collection
                </p>
              </div>

              <button
                type="button"
                onClick={loadHistory}
                disabled={loadingHistory}
                className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-300 flex items-center gap-1.5 border border-neutral-700"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingHistory ? 'animate-spin text-amber-400' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingHistory && history.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <div className="h-6 w-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-neutral-500">Loading notification history...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-500">
                No notifications dispatched yet. Use the Compose tab to send your first customer alert!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-800 text-neutral-400">
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3">Recipient</th>
                      <th className="py-3 px-3">Title & Message</th>
                      <th className="py-3 px-3">Link</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60 font-medium">
                    {history.map((item) => (
                      <tr key={item._id} className="hover:bg-neutral-800/40 transition-colors">
                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              item.type === 'order_update'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : item.type === 'promotion'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-neutral-800 text-neutral-300'
                            }`}
                          >
                            {item.type}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="font-mono text-white text-[11px] block">
                            {item.userId === 'all' ? (
                              <span className="text-amber-400 font-bold">ALL CUSTOMERS</span>
                            ) : (
                              item.userId
                            )}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 max-w-md">
                          <span className="text-white font-bold block">{item.title}</span>
                          <span className="text-neutral-400 text-[11px] line-clamp-1">{item.message}</span>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-[11px] text-neutral-400">
                          {item.link || '—'}
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`text-[10px] font-bold ${
                              item.isRead ? 'text-emerald-400' : 'text-neutral-500'
                            }`}
                          >
                            {item.isRead ? 'Read' : 'Unread'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right text-neutral-400 text-[11px] font-mono whitespace-nowrap">
                          {formatDate(item.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
