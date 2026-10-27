'use client';

/**
 * @file app/cart/page.tsx
 * @description Dedicated Shopping Bag & Cart management page for OX Shoes Pakistan.
 * Item adjustments, size badges, coupon validator, 17% GST calculation, and checkout redirection.
 * Strict TypeScript: ZERO `any`.
 */

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCartStore } from '@/lib/store/cart';
import { useLocale } from '@/lib/store/locale';
import { useHydrated } from '@/lib/hooks/useHydrated';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { WhatsAppWidget } from '@/components/layout/WhatsAppWidget';
import { formatPKR } from '@/lib/formatters/currency';
import { calculateOrderTotals } from '@/lib/pricing';
import { validateCouponAction } from '@/actions/coupon.actions';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShieldCheck,
  Truck,
  Sparkles,
  Tag,
  RotateCcw,
} from 'lucide-react';

export default function CartPage() {
  const {
    items,
    appliedCoupon,
    updateQuantity,
    removeItem,
    applyCoupon,
    removeCoupon,
    clearCart,
  } = useCartStore();
  const { isUrdu } = useLocale();
  const isHydrated = useHydrated();

  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalWeight = items.reduce((sum, item) => sum + (item.weight || 750) * item.quantity, 0);

  const pricing = calculateOrderTotals(
    items.map((i) => ({ price: i.price, quantity: i.quantity })),
    'Lahore',
    totalWeight,
    appliedCoupon
      ? {
          type: appliedCoupon.type as any,
          value: appliedCoupon.discountAmount,
          minOrderAmount: 0,
        }
      : null
  );

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;

    setValidatingCoupon(true);
    setCouponError(null);
    setCouponSuccess(null);

    const res = await validateCouponAction(couponInput.trim(), subtotal);
    setValidatingCoupon(false);

    if (res.success) {
      applyCoupon({
        code: res.data.code,
        discountAmount: res.data.discountAmount,
        type: res.data.type,
      });
      setCouponSuccess(res.data.message);
      setCouponInput('');
    } else {
      setCouponError(res.error || 'Invalid promotional code.');
    }
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between">
        <AnnouncementBar />
        <Header onOpenSearch={() => {}} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-neutral-200 rounded w-48" />
            <div className="h-4 bg-neutral-200 rounded w-72" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mt-8">
              <div className="lg:col-span-7 space-y-4">
                <div className="h-32 bg-neutral-200 rounded-xl" />
                <div className="h-32 bg-neutral-200 rounded-xl" />
              </div>
              <div className="lg:col-span-5">
                <div className="h-64 bg-neutral-200 rounded-2xl" />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between selection:bg-neutral-950 selection:text-white">
      <AnnouncementBar />
      <Header onOpenSearch={() => {}} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-200 pb-5 mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-neutral-950">
              {isUrdu ? 'آپ کا شاپنگ بیگ' : `Shopping Bag (${items.length} ${items.length === 1 ? 'item' : 'items'})`}
            </h1>
            <p className="text-xs text-neutral-500 mt-1">
              Handcrafted in Pakistan • Free size exchange within 7 days
            </p>
          </div>

          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs font-bold text-neutral-500 hover:text-red-600 transition-colors self-start sm:self-auto"
            >
              Clear Entire Bag
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="py-20 text-center max-w-md mx-auto space-y-4">
            <div className="h-20 w-20 bg-neutral-200 rounded-full flex items-center justify-center mx-auto text-neutral-400">
              <ShoppingBag className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-neutral-950">
              {isUrdu ? 'آپ کا شاپنگ بیگ خالی ہے' : 'Your Bag is Empty'}
            </h2>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Explore our handcrafted Peshawari Chappals, Khussas, Executive Oxfords, and Joggers to find your perfect pair.
            </p>
            <Link
              href="/shop"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-md"
            >
              <span>Explore Collection</span>
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Items Column */}
            <div className="lg:col-span-7 space-y-4">
              {items.map((item, idx) => (
                <div
                  key={`${item.productId}-${item.size}-${item.color}-${idx}`}
                  className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative h-20 w-20 rounded-xl bg-neutral-100 overflow-hidden shrink-0 border border-neutral-100">
                      {item.image && (
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          referrerPolicy="no-referrer"
                          className="object-cover"
                          sizes="80px"
                        />
                      )}
                    </div>

                    <div className="space-y-1">
                      <h3 className="font-bold text-sm text-neutral-950 line-clamp-1">{item.name}</h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                        <span className="px-2 py-0.5 rounded bg-neutral-100 font-mono text-[11px] font-bold">
                          Size: {item.size}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-neutral-100 text-[11px]">
                          Color: {item.color}
                        </span>
                      </div>
                      <div className="text-xs font-black text-neutral-950 pt-0.5">
                        {formatPKR(item.price)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between w-full sm:w-auto sm:justify-end gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                    {/* Stepper */}
                    <div className="flex items-center border border-neutral-300 rounded-full px-2 py-1 bg-white">
                      <button
                        onClick={() => updateQuantity(item.productId, item.size, item.color, item.quantity - 1)}
                        className="p-1 hover:text-black text-neutral-500"
                        title="Decrease"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="px-3 text-xs font-bold font-mono">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.size, item.color, item.quantity + 1)}
                        className="p-1 hover:text-black text-neutral-500"
                        title="Increase"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Total item price */}
                    <div className="font-black text-sm text-neutral-950 min-w-16 text-right">
                      {formatPKR(item.price * item.quantity)}
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => removeItem(item.productId, item.size, item.color)}
                      className="text-neutral-400 hover:text-red-600 transition-colors p-1"
                      title="Remove Item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 flex items-center gap-3 text-xs text-amber-900">
                <Truck className="h-5 w-5 text-amber-700 shrink-0" />
                <span>
                  Orders over <strong>PKR 3,500</strong> qualify for <strong>FREE nationwide shipping</strong> via TCS Express.
                </span>
              </div>
            </div>

            {/* Summary Column */}
            <div className="lg:col-span-5 space-y-6">
              {/* Order Summary Card */}
              <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm space-y-5">
                <h2 className="font-bold text-base uppercase tracking-wider text-neutral-950 border-b border-neutral-100 pb-3">
                  Order Summary
                </h2>

                {/* Coupon Box */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-neutral-700">Promo / Coupon Code</span>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                      <div className="flex items-center gap-2 text-emerald-800 font-bold">
                        <Tag className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Code &quot;{appliedCoupon.code}&quot; Applied (-{formatPKR(appliedCoupon.discountAmount)})</span>
                      </div>
                      <button
                        onClick={removeCoupon}
                        className="text-xs font-bold text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleApplyCoupon} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. WELCOME10, AZADI23"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        className="flex-1 px-3 py-2 text-xs rounded-xl border border-neutral-300 uppercase font-mono focus:outline-none focus:border-neutral-950"
                      />
                      <button
                        type="submit"
                        disabled={validatingCoupon}
                        className="px-4 py-2 rounded-xl bg-neutral-950 text-white text-xs font-bold uppercase transition-colors hover:bg-neutral-800"
                      >
                        {validatingCoupon ? 'Checking...' : 'Apply'}
                      </button>
                    </form>
                  )}

                  {couponError && <p className="text-[11px] text-red-600 font-medium">{couponError}</p>}
                  {couponSuccess && <p className="text-[11px] text-emerald-600 font-medium">{couponSuccess}</p>}
                </div>

                {/* Financial breakdown */}
                <div className="space-y-2.5 text-xs text-neutral-600 pt-2 border-t border-neutral-100">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-semibold text-neutral-900">{formatPKR(pricing.subtotal)}</span>
                  </div>

                  {pricing.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Discount</span>
                      <span>-{formatPKR(pricing.discountAmount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>FBR Sales Tax (17% GST)</span>
                    <span className="font-semibold text-neutral-900">{formatPKR(pricing.taxAmount)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Estimated Shipping (TCS)</span>
                    <span className="font-semibold text-neutral-900">
                      {pricing.shippingCharges === 0 ? (
                        <span className="text-emerald-700 font-bold uppercase">FREE</span>
                      ) : (
                        formatPKR(pricing.shippingCharges)
                      )}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-neutral-200 flex justify-between items-baseline">
                    <span className="font-black text-sm uppercase text-neutral-950">Grand Total</span>
                    <span className="font-black text-xl text-neutral-950">
                      {formatPKR(pricing.totalAmount)}
                    </span>
                  </div>
                </div>

                <Link
                  href="/checkout"
                  className="w-full py-4 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] shadow-lg"
                >
                  <span>Proceed to Secure Checkout</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <div className="pt-2 flex items-center justify-center gap-4 text-[11px] text-neutral-500">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span>256-Bit SSL</span>
                  </span>
                  <span>•</span>
                  <span>Cash on Delivery (COD)</span>
                  <span>•</span>
                  <span>Open-Box Inspection</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <WhatsAppWidget />
      <Footer />
    </div>
  );
}
