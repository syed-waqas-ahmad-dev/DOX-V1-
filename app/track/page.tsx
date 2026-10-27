'use client';

/**
 * @file app/track/page.tsx
 * @description Universal real-time order and courier tracking hub for OX Shoes Pakistan.
 * Integrates interactive transit visualizer, TCS / Leopards consignment tracking,
 * and direct links to official tax invoices.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { trackOrder, getOrderById } from '@/actions/order.actions';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { OrderTransitMap } from '@/components/maps/OrderTransitMap';
import { formatPKR } from '@/lib/formatters/currency';
import { formatDate } from '@/lib/formatters/date';
import type { IOrder } from '@/types';
import {
  Search,
  Truck,
  Package,
  Calendar,
  CheckCircle2,
  FileText,
  MapPin,
  Clock,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

function TrackOrderContent() {
  const searchParams = useSearchParams();
  const initialOrder = searchParams?.get('order') || '';

  const [inputVal, setInputVal] = useState(initialOrder);
  const [order, setOrder] = useState<IOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSearch = async (queryToSearch: string) => {
    const q = queryToSearch.trim().toUpperCase();
    if (!q) return;

    setLoading(true);
    setErrorMsg(null);

    // Try track by order number
    const res = await trackOrder(q);
    if (res.success) {
      setOrder(res.data);
    } else {
      // Try ID lookup fallback
      const idRes = await getOrderById(q);
      if (idRes.success) {
        setOrder(idRes.data);
      } else {
        setErrorMsg(
          idRes.error ||
            `No order found for reference "${q}". Please check your order confirmation SMS or email.`
        );
        setOrder(null);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!initialOrder) return;
    let active = true;
    const q = initialOrder.trim().toUpperCase();
    trackOrder(q).then((res) => {
      if (!active) return;
      if (res.success) {
        setOrder(res.data);
      } else {
        getOrderById(q).then((idRes) => {
          if (!active) return;
          if (idRes.success) {
            setOrder(idRes.data);
          } else {
            setErrorMsg(
              idRes.error ||
                `No order found for reference "${q}". Please check your order confirmation SMS or email.`
            );
            setOrder(null);
          }
        });
      }
    });
    return () => {
      active = false;
    };
  }, [initialOrder]);

  const destCity =
    (order?.shippingAddress as unknown as Record<string, string> | undefined)?.city || 'Lahore';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 w-full flex-1 space-y-8">
      {/* Title */}
      <div className="text-center space-y-2">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full inline-block">
          Nationwide Courier Dispatch Tracking
        </span>
        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-neutral-950">
          Track Your OX Shoes Shipment
        </h1>
        <p className="text-xs sm:text-sm text-neutral-600 max-w-md mx-auto">
          Enter your Order Reference Number (e.g., <strong className="font-mono">OX-2026-XXXX</strong>) to view real-time courier status and route.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="max-w-xl mx-auto">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch(inputVal);
          }}
          className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-neutral-300 shadow-md focus-within:border-neutral-950 focus-within:ring-2 focus-within:ring-neutral-950/10 transition-all"
        >
          <Search className="h-5 w-5 text-neutral-400 ml-3 shrink-0" />
          <input
            type="text"
            placeholder="e.g. OX-2026-4821 or order ID"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            className="w-full px-2 py-2 text-sm bg-transparent border-none outline-none text-neutral-950 placeholder:text-neutral-400 font-medium"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shrink-0 transition-colors"
          >
            {loading ? 'Searching...' : 'Track'}
          </button>
        </form>

        {errorMsg && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Tracking Results Card */}
      {order && (
        <div className="space-y-6 pt-4">
          {/* Status Header */}
          <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block">
                  Order Reference
                </span>
                <h3 className="text-xl font-black font-mono text-neutral-950">
                  {order.orderNumber}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Status: {order.status}
                </span>
                <Link
                  href={`/invoice/${order._id}`}
                  className="px-3 py-1 rounded-full text-xs font-bold bg-neutral-950 text-white hover:bg-neutral-800 flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <FileText className="h-3.5 w-3.5" />
                  View Tax Invoice
                </Link>
              </div>
            </div>

            {/* Courier Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-neutral-400 block text-[10px] uppercase font-bold">Courier Partner</span>
                <span className="font-bold text-neutral-950 flex items-center gap-1 mt-0.5">
                  <Truck className="h-3.5 w-3.5 text-amber-600" />
                  {order.courier || 'TCS Express'}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px] uppercase font-bold">Consignment #</span>
                <span className="font-mono font-bold text-neutral-950 block mt-0.5">
                  {order.trackingNumber || 'Pending Dispatch'}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px] uppercase font-bold">Payment Method</span>
                <span className="font-bold text-neutral-950 block mt-0.5">
                  {order.paymentMethod} ({order.paymentStatus})
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px] uppercase font-bold">Order Total</span>
                <span className="font-bold text-emerald-600 block mt-0.5">
                  {formatPKR(order.totalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Google Map Shipment Route */}
          <OrderTransitMap
            destinationCity={destCity}
            orderNumber={order.orderNumber}
            courierName={order.courier || 'TCS Express'}
            trackingNumber={order.trackingNumber}
          />

          {/* Purchased Items Summary */}
          <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-neutral-950 border-b border-neutral-100 pb-2">
              Shipment Contents ({order.orderItems?.length || 0} items)
            </h4>
            <div className="divide-y divide-neutral-100">
              {order.orderItems?.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-neutral-950 block">{item.name}</span>
                    <span className="text-[11px] text-neutral-500">
                      Size: {item.size} • Color: {item.color} • Qty: {item.quantity}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-neutral-950">
                    {formatPKR(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between">
      <AnnouncementBar />
      <Header onOpenSearch={() => {}} />

      <main className="w-full flex-1">
        <Suspense
          fallback={
            <div className="p-12 text-center text-xs font-semibold text-neutral-500">
              Loading tracking interface...
            </div>
          }
        >
          <TrackOrderContent />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
