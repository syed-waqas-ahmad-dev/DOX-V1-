'use client';

/**
 * @file app/admin/orders/[id]/page.tsx
 * @description Dedicated Order Management & Customer Contact Console for OX Shoes Pakistan.
 * Includes 100% Free WhatsApp Direct (wa.me) dispatch — no token, no business API, opens directly.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getOrderById, updateOrderStatus } from '@/actions/order.actions';
import { OrderStatus, PaymentStatus, type IOrder } from '@/types';
import { formatPKR } from '@/lib/formatters/currency';
import { formatDate } from '@/lib/formatters/date';
import { Logo } from '@/components/layout/Logo';
import {
  ArrowLeft,
  Truck,
  Printer,
  Tag,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  User,
  ShoppingBag,
  Share2,
  ExternalLink,
  Archive,
  ArchiveRestore,
} from 'lucide-react';

export default function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const orderId = resolvedParams.id;

  const [order, setOrder] = useState<IOrder | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchOrder = async () => {
    setLoading(true);
    const res = await getOrderById(orderId);
    if (res.success && res.data) {
      setOrder(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    getOrderById(orderId)
      .then((res) => {
        if (active && res.success && res.data) {
          setOrder(res.data);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [orderId]);

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!order) return;
    setUpdating(true);
    const res = await updateOrderStatus(order._id.toString(), { status: newStatus });
    if (res.success && res.data) {
      setOrder(res.data);
      setStatusMessage(`Order status updated to ${newStatus}! In-app notification automatically created.`);
      setTimeout(() => setStatusMessage(null), 4000);
    }
    setUpdating(false);
  };

  const handleArchiveOrder = async () => {
    if (!order) return;
    setUpdating(true);
    try {
      const res = await fetch('/api/admin/orders/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order._id.toString() }),
      });
      const data = await res.json();
      if (data.success) {
        setOrder({ ...order, archived: true });
        setStatusMessage('Order archived successfully! Saved in Atlas archive.');
      } else {
        setStatusMessage(data.error || 'Failed to archive order.');
      }
    } catch {
      setStatusMessage('Network error while archiving order.');
    } finally {
      setUpdating(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const handleUnarchiveOrder = async () => {
    if (!order) return;
    setUpdating(true);
    try {
      const res = await fetch('/api/admin/orders/unarchive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order._id.toString() }),
      });
      const data = await res.json();
      if (data.success) {
        setOrder({ ...order, archived: false });
        setStatusMessage('Order restored/unarchived successfully!');
      } else {
        setStatusMessage(data.error || 'Failed to unarchive order.');
      }
    } catch {
      setStatusMessage('Network error while unarchiving order.');
    } finally {
      setUpdating(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const getCleanPhone = (phoneStr?: string): string => {
    if (!phoneStr) return '923001234567';
    let cleaned = phoneStr.replace(/\D/g, '');
    if (cleaned.startsWith('03')) {
      cleaned = '92' + cleaned.slice(1);
    } else if (cleaned.startsWith('3') && cleaned.length === 10) {
      cleaned = '92' + cleaned;
    }
    return cleaned || '923001234567';
  };

  const shipAddr = order?.shippingAddress as unknown as Record<string, string> | undefined;
  const customerName = shipAddr?.fullName || 'Customer';
  const customerPhone = shipAddr?.phone || '';
  const cleanPhone = getCleanPhone(customerPhone);
  const currentStatus = order?.status || 'Processing';
  const orderNumber = order?.orderNumber || orderId;

  // Prompt requirement: https://wa.me/${phone}?text=${encodeURIComponent('Hello ' + name + ', your order ' + orderId + ' is ' + status + ' - OX Shoes')}
  const whatsAppText = `Hello ${customerName}, your order ${orderNumber} is ${currentStatus} - OX Shoes`;
  const whatsAppUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsAppText)}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="h-8 w-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-neutral-400 font-medium">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white p-8">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <h2 className="text-xl font-bold">Order Not Found</h2>
          <p className="text-xs text-neutral-400">Order ID: {orderId}</p>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-black text-xs font-bold"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Admin Console</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Logo theme="dark" size="sm" withLink={false} />
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-amber-500 text-black uppercase tracking-widest">
            Order Fulfillment
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <Link
            href="/admin"
            className="text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>All Orders</span>
          </Link>
          <Link
            href={`/invoice/${order._id}`}
            className="text-amber-400 hover:text-amber-300 font-bold transition-colors flex items-center gap-1"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Invoice</span>
          </Link>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-6">
        {/* Top Action Bar */}
        <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold text-amber-400">#{order.orderNumber}</span>
              <span className="text-xs text-neutral-400">• Cash on Delivery (COD)</span>
            </div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">
              Order Management & Dispatch
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Placed on {formatDate(order.createdAt)} with TCS Courier Dispatch
            </p>
          </div>

          {/* Primary Action: Direct WhatsApp Button & Archive Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-2 group hover:scale-105"
              title="Open WhatsApp chat with prefilled order notification"
            >
              <Share2 className="h-4 w-4" />
              <span>WhatsApp Customer</span>
              <ExternalLink className="h-3 w-3 opacity-70 group-hover:opacity-100" />
            </a>

            {order.archived ? (
              <button
                type="button"
                onClick={handleUnarchiveOrder}
                disabled={updating}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5"
                title="Restore order from archive"
              >
                <ArchiveRestore className="h-4 w-4" />
                <span>Restore / Unarchive</span>
              </button>
            ) : order.status === OrderStatus.DELIVERED ? (
              <button
                type="button"
                onClick={handleArchiveOrder}
                disabled={updating}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-amber-500 text-amber-400 hover:text-black font-black text-xs uppercase tracking-wider transition-all border border-neutral-700 shadow-md flex items-center gap-1.5"
                title="Archive delivered order to save database space"
              >
                <Archive className="h-4 w-4" />
                <span>Archive Order</span>
              </button>
            ) : null}
          </div>
        </div>

        {statusMessage && (
          <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* 2-Column Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Customer & Address Card */}
          <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2 border-b border-neutral-800 pb-3">
              <User className="h-4 w-4 text-amber-400" />
              <span>Customer Details</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-neutral-500 block">Full Name:</span>
                <span className="text-white font-bold text-sm">{customerName}</span>
              </div>

              <div>
                <span className="text-neutral-500 block">Phone / Mobile:</span>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-white font-mono font-bold">{customerPhone || 'Not provided'}</span>
                  <a
                    href={whatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold hover:bg-emerald-500/20 flex items-center gap-1"
                  >
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>

              <div className="border-t border-neutral-800/80 pt-3">
                <span className="text-neutral-500 block">Delivery Address:</span>
                <span className="text-neutral-200 block mt-0.5 leading-relaxed">
                  {shipAddr?.street || shipAddr?.address || 'Street Address'}
                </span>
                <span className="text-amber-400 font-bold block mt-1 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {shipAddr?.city || 'Lahore'}, Pakistan
                </span>
              </div>
            </div>
          </div>

          {/* Fulfillment & Courier Status */}
          <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2 border-b border-neutral-800 pb-3">
              <Truck className="h-4 w-4 text-sky-400" />
              <span>Fulfillment & Courier</span>
            </h3>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-neutral-400 font-bold block">Current Status:</label>
                <select
                  value={order.status}
                  disabled={updating}
                  onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                >
                  <option value={OrderStatus.CONFIRMED}>CONFIRMED</option>
                  <option value={OrderStatus.PROCESSING}>PROCESSING</option>
                  <option value={OrderStatus.SHIPPED}>SHIPPED (TCS Express)</option>
                  <option value={OrderStatus.DELIVERED}>DELIVERED</option>
                  <option value={OrderStatus.CANCELLED}>CANCELLED</option>
                </select>
                <span className="text-[10px] text-neutral-500">
                  Changing to Shipped/Delivered auto-creates customer in-app notification.
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-neutral-500 block">Assigned Courier:</span>
                <span className="text-white font-bold block">{order.courier || 'TCS Express'}</span>
              </div>

              <div className="space-y-1">
                <span className="text-neutral-500 block">Tracking Number:</span>
                <Link
                  href={`/track?order=${order.orderNumber}`}
                  className="font-mono text-xs text-amber-400 hover:text-amber-300 underline block"
                >
                  {order.trackingNumber || 'Track Order'}
                </Link>
              </div>
            </div>
          </div>

          {/* Payment & Total Amount */}
          <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2 border-b border-neutral-800 pb-3">
              <Tag className="h-4 w-4 text-emerald-400" />
              <span>Accounting (PKR)</span>
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-neutral-400">
                <span>Payment Mode:</span>
                <span className="text-white font-bold">Cash on Delivery (COD)</span>
              </div>

              <div className="flex items-center justify-between text-neutral-400">
                <span>Subtotal:</span>
                <span className="text-white font-mono">{formatPKR(order.subtotal)}</span>
              </div>

              <div className="flex items-center justify-between text-neutral-400">
                <span>Shipping Fee:</span>
                <span className="text-white font-mono">{formatPKR(order.shippingCharges || 0)}</span>
              </div>

              <div className="flex items-center justify-between text-neutral-400">
                <span>FBR GST (17%):</span>
                <span className="text-white font-mono">{formatPKR(order.taxAmount || 0)}</span>
              </div>

              <div className="pt-2 border-t border-neutral-800 flex items-center justify-between text-sm font-black">
                <span className="text-white">Total COD Payable:</span>
                <span className="text-emerald-400 font-mono text-base">{formatPKR(order.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Order Items List */}
        <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2 border-b border-neutral-800 pb-3">
            <ShoppingBag className="h-4 w-4 text-amber-400" />
            <span>Ordered Footwear ({(order.orderItems || (order as unknown as { items?: unknown[] }).items || []).length})</span>
          </h3>

          <div className="divide-y divide-neutral-800">
            {(order.orderItems || (order as unknown as { items?: typeof order.orderItems }).items || []).map((item, idx) => (
              <div key={idx} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="relative h-14 w-14 rounded-xl bg-neutral-950 overflow-hidden shrink-0 border border-neutral-800">
                    {item.image && (
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        referrerPolicy="no-referrer"
                        className="object-cover"
                        sizes="60px"
                      />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-white">{item.name}</h4>
                    <span className="text-[11px] text-neutral-400">
                      Size: <strong className="text-neutral-200">{item.size}</strong> • Color: {item.color} • Qty: {item.quantity}
                    </span>
                  </div>
                </div>

                <div className="text-right font-mono text-xs font-bold text-white">
                  {formatPKR(item.price * item.quantity)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
