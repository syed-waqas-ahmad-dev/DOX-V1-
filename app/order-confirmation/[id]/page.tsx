'use client';

/**
 * @file app/order-confirmation/[id]/page.tsx
 * @description Customer order confirmation receipt and post-purchase tracking hub.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getOrderById } from '@/actions/order.actions';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { formatPKR } from '@/lib/formatters/currency';
import { formatDate } from '@/lib/formatters/date';
import type { IOrder } from '@/types';
import { OrderTransitMap } from '@/components/maps/OrderTransitMap';
import {
  CheckCircle2,
  Truck,
  Package,
  Calendar,
  MapPin,
  ArrowRight,
  ShieldCheck,
  FileText,
} from 'lucide-react';

interface OrderConfirmationProps {
  params: Promise<{ id: string }>;
}

export default function OrderConfirmationPage({ params }: OrderConfirmationProps) {
  const resolvedParams = use(params);
  const orderId = resolvedParams.id;

  const [order, setOrder] = useState<IOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrder() {
      setLoading(true);
      const res = await getOrderById(orderId);
      if (res.success && res.data) {
        setOrder(res.data);
      }
      setLoading(false);
    }
    fetchOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center text-xs font-semibold text-neutral-600">
        Loading order receipt...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col justify-between">
        <Header onOpenSearch={() => {}} />
        <main className="max-w-md mx-auto my-auto p-8 text-center space-y-4">
          <h2 className="text-xl font-bold text-neutral-900">Order Not Found</h2>
          <p className="text-xs text-neutral-500">We could not locate this order reference.</p>
          <Link href="/" className="inline-block px-6 py-2.5 bg-neutral-950 text-white rounded-full text-xs font-bold">
            Back to Home
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between">
      <Header onOpenSearch={() => {}} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 w-full flex-1 space-y-8">
        {/* Celebration Banner */}
        <div className="text-center space-y-3">
          <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center shadow-md">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full inline-block">
            Order Confirmed & Dispatching Soon
          </span>
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-neutral-950">
            Shukriya! Your Order is Placed
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 max-w-md mx-auto">
            Order <strong className="text-neutral-950 font-mono">{order.orderNumber}</strong> has been received and sent to our craftsman fulfillment center.
          </p>
        </div>

        {/* Tax Invoice Notification Banner */}
        <div className="p-4 rounded-2xl bg-neutral-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg border border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-400 text-black flex items-center justify-center font-bold shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-white">
                  Official FBR Tax Invoice Generated
                </h3>
                <span className="text-[10px] font-mono bg-neutral-800 px-2 py-0.5 rounded text-amber-400 font-bold">
                  INV-{(order.orderNumber || '').replace('OX-', '')}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Compliant with Sales Tax Act • NTN: 8241920-4 • Download or print anytime.
              </p>
            </div>
          </div>
          <Link
            href={`/invoice/${order._id}`}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black uppercase tracking-wider transition-transform hover:scale-105 shrink-0 shadow-md"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>View & Print Tax Invoice</span>
          </Link>
        </div>

        {/* Courier & Shipping Timeline Card */}
        <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-neutral-800">
              <Truck className="h-4 w-4 text-amber-600" />
              <span>Courier: {order.courier || 'TCS Express'}</span>
            </div>
            <span className="text-xs font-mono font-bold text-neutral-500">
              Tracking: {order.trackingNumber || 'Pending Dispatch'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-neutral-400 block text-[11px] uppercase font-bold">Estimated Delivery</span>
              <span className="font-bold text-neutral-950 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-neutral-500" />
                2 to 4 Working Days
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-neutral-400 block text-[11px] uppercase font-bold">Payment Method</span>
              <span className="font-bold text-neutral-950">{order.paymentMethod}</span>
            </div>
            <div className="space-y-1">
              <span className="text-neutral-400 block text-[11px] uppercase font-bold">Payment Status</span>
              <span className="font-bold text-amber-600 capitalize">{order.paymentStatus}</span>
            </div>
          </div>
        </div>

        {/* Live Courier Transit Route on Interactive Map */}
        <OrderTransitMap
          destinationCity={
            (order.shippingAddress as unknown as Record<string, string> | undefined)?.city || 'Lahore'
          }
          orderNumber={order.orderNumber}
          courierName={order.courier || 'TCS Express'}
          trackingNumber={order.trackingNumber}
        />

        {/* Items & Financial Breakdown */}
        <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm space-y-5">
          <h3 className="font-bold text-sm text-neutral-950 uppercase tracking-wider border-b border-neutral-100 pb-2">
            Items in Order ({order.orderItems?.length || 0})
          </h3>

          <div className="divide-y divide-neutral-100">
            {order.orderItems?.map((item, idx) => (
              <div key={idx} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="relative h-14 w-14 rounded-lg bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0">
                    {item.image && <Image src={item.image} alt={item.name} fill referrerPolicy="no-referrer" className="object-cover" sizes="56px" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-neutral-950">{item.name}</h4>
                    <span className="text-[11px] text-neutral-500">
                      Size: {item.size} • Color: {item.color} • Qty: {item.quantity}
                    </span>
                  </div>
                </div>
                <span className="font-bold text-xs text-neutral-950">
                  {formatPKR(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-neutral-200 space-y-2 text-xs text-neutral-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatPKR(order.subtotal)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Discount Applied</span>
                <span>-{formatPKR(order.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>GST (17%)</span>
              <span>{formatPKR(order.taxAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping Charges</span>
              <span>{order.shippingCharges === 0 ? 'FREE' : formatPKR(order.shippingCharges)}</span>
            </div>
            <div className="flex justify-between text-base font-black text-neutral-950 pt-2 border-t border-neutral-200">
              <span>Total Paid / Payable</span>
              <span>{formatPKR(order.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={`/invoice/${order._id}`}
            className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-amber-400 hover:bg-amber-300 text-black text-xs font-black uppercase tracking-wider text-center shadow-lg transition-transform hover:scale-105 flex items-center justify-center gap-2"
          >
            <FileText className="h-4 w-4" />
            <span>Download / Print Invoice</span>
          </Link>
          <Link
            href={`/track?order=${order.orderNumber}`}
            className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-black uppercase tracking-wider text-center shadow-lg flex items-center justify-center gap-2"
          >
            <Truck className="h-4 w-4" />
            <span>Track Delivery</span>
          </Link>
          <Link
            href="/shop"
            className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-800 text-xs font-bold uppercase tracking-wider text-center"
          >
            Continue Shopping
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
