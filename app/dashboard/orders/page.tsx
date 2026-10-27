'use client';

/**
 * @file app/dashboard/orders/page.tsx
 * @description Customer order history list with live courier tracking status.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { formatPKR } from '@/lib/formatters/currency';
import { formatDate } from '@/lib/formatters/date';
import { Package, Truck, ArrowRight, Clock, ShieldCheck } from 'lucide-react';

interface OrderListItem {
  _id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: number;
  courier: string;
  trackingNumber: string;
  createdAt: string;
  itemsCount: number;
  firstItem: string;
}

const initialDemoOrders: OrderListItem[] = [
  {
    _id: '660e1234567890abcdef1234',
    orderNumber: 'OX-2026-1042',
    status: 'Delivered',
    paymentMethod: 'COD',
    paymentStatus: 'Paid',
    totalAmount: 4965,
    courier: 'TCS',
    trackingNumber: 'TCS7789123049PK',
    createdAt: new Date().toISOString(),
    itemsCount: 1,
    firstItem: 'Kaptaan Special Peshawari Chappal Double Sole',
  },
];

export default function UserOrdersPage() {
  const [orders] = useState<OrderListItem[]>(initialDemoOrders);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between">
      <AnnouncementBar />
      <Header onOpenSearch={() => {}} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-200 pb-4 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-neutral-950">
              My Orders & Dispatches
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">Track your TCS / Leopards deliveries nationwide</p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto text-xs font-bold">
            <Link href="/dashboard/profile" className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-full text-neutral-700">
              Profile
            </Link>
            <Link href="/dashboard/orders" className="px-4 py-2 bg-neutral-950 text-white rounded-full">
              Orders
            </Link>
            <Link href="/dashboard/wishlist" className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-full text-neutral-700">
              Wishlist
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          {orders.map((ord) => (
            <div key={ord._id} className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-100 gap-2">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-neutral-900" />
                  <span className="font-mono font-bold text-sm text-neutral-950">{ord.orderNumber}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                    {ord.status}
                  </span>
                </div>
                <span className="text-xs text-neutral-400">Placed on {formatDate(ord.createdAt)}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-neutral-400 block text-[11px] font-bold">Primary Footwear</span>
                  <span className="font-bold text-neutral-900 line-clamp-1">{ord.firstItem}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[11px] font-bold">Total Paid</span>
                  <span className="font-bold text-neutral-900">{formatPKR(ord.totalAmount)}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[11px] font-bold">Courier & Tracking</span>
                  <span className="font-bold text-neutral-900 flex items-center gap-1 font-mono">
                    <Truck className="h-3.5 w-3.5 text-amber-600" />
                    {ord.courier}: {ord.trackingNumber}
                  </span>
                </div>
                <div className="flex sm:justify-end items-center gap-2">
                  <Link
                    href={`/invoice/${ord._id}`}
                    className="px-3.5 py-1.5 rounded-full bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold transition-colors"
                  >
                    Tax Invoice
                  </Link>
                  <Link
                    href={`/track?order=${ord.orderNumber}`}
                    className="px-3.5 py-1.5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold transition-colors"
                  >
                    Track Route
                  </Link>
                  <Link
                    href={`/order-confirmation/${ord._id}`}
                    className="px-3 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs font-bold flex items-center gap-1 transition-colors"
                  >
                    <span>Details</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
