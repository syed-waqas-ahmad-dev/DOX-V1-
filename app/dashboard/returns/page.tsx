'use client';

/**
 * @file app/dashboard/returns/page.tsx
 * @description Customer size exchange & return history with RMA tracking.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { getUserReturns } from '@/actions/return.actions';
import { formatDate } from '@/lib/formatters/date';
import type { IReturnRequest } from '@/types';
import { RotateCcw, CheckCircle2, Truck, Plus, Package, ShieldCheck } from 'lucide-react';

export default function CustomerReturnsPage() {
  const [returns, setReturns] = useState<IReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReturns() {
      setLoading(true);
      const res = await getUserReturns();
      if (res.success && res.data) {
        setReturns(res.data);
      }
      setLoading(false);
    }
    loadReturns();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between selection:bg-neutral-950 selection:text-white">
      <AnnouncementBar />
      <Header onOpenSearch={() => {}} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-200 pb-4 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-neutral-950">
              Returns & Exchanges ({returns.length})
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              7-Day doorstep size exchange and RMA tracking
            </p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto text-xs font-bold">
            <Link href="/dashboard/profile" className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-full text-neutral-700">
              Profile
            </Link>
            <Link href="/dashboard/orders" className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-full text-neutral-700">
              Orders
            </Link>
            <Link href="/dashboard/returns" className="px-4 py-2 bg-neutral-950 text-white rounded-full">
              Returns
            </Link>
            <Link href="/dashboard/wishlist" className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-full text-neutral-700">
              Wishlist
            </Link>
          </div>
        </div>

        <div className="flex justify-end">
          <Link
            href="/returns"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Request New Exchange</span>
          </Link>
        </div>

        {returns.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white border border-neutral-200 space-y-3">
            <RotateCcw className="h-10 w-10 text-neutral-300 mx-auto" />
            <h3 className="font-bold text-base text-neutral-900">No Return Requests</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              You haven’t initiated any return or size exchange requests. All purchases come with 7-day hassle-free exchange protection.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {returns.map((ret) => (
              <div
                key={ret._id.toString()}
                className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-100 gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm text-neutral-950">
                      RMA: {ret.rmaNumber}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                      {ret.status}
                    </span>
                  </div>
                  <span className="text-xs text-neutral-400">
                    Requested on {formatDate(ret.createdAt)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-neutral-400 block text-[11px] font-bold">Reason</span>
                    <span className="font-bold text-neutral-900">{ret.reason}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block text-[11px] font-bold">Courier Pickup</span>
                    <span className="font-bold text-neutral-900 flex items-center gap-1">
                      <Truck className="h-3.5 w-3.5 text-amber-600" />
                      TCS Doorstep Collection
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block text-[11px] font-bold">Comments</span>
                    <span className="text-neutral-600 line-clamp-1">{ret.comments || 'Size replacement requested'}</span>
                  </div>
                </div>

                {ret.adminNotes && (
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-700">
                    <span className="font-bold block text-[11px] text-neutral-500 uppercase">
                      Atelier Operations Update:
                    </span>
                    <p className="mt-0.5">{ret.adminNotes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
