'use client';

/**
 * @file components/layout/CartDrawer.tsx
 * @description Slide-over cart drawer with free shipping progress bar,
 * live line-item updates, quantity controls, and one-click checkout.
 * Strict TypeScript: ZERO `any`.
 */

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCartStore } from '@/lib/store/cart';
import { useLocale } from '@/lib/store/locale';
import { formatPKR } from '@/lib/formatters/currency';
import { FREE_SHIPPING_THRESHOLD } from '@/lib/constants';
import { validateCouponAction } from '@/actions/coupon.actions';
import {
  X,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  ArrowRight,
  Truck,
  Tag,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    updateQuantity,
    removeItem,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    getSubtotal,
  } = useCartStore();
  const { isUrdu } = useLocale();

  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  if (!isOpen) return null;

  const subtotal = getSubtotal();
  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const freeShippingProgress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  const discountAmount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const estimatedTotal = Math.max(0, subtotal - discountAmount);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;

    setCouponLoading(true);
    setCouponError(null);

    const res = await validateCouponAction(couponCode, subtotal);
    setCouponLoading(false);

    if (res.success) {
      applyCoupon({
        code: res.data.code,
        discountAmount: res.data.discountAmount,
        type: res.data.type,
      });
      setCouponCode('');
    } else {
      setCouponError(res.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={closeCart}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between text-neutral-900">
          {/* Top Header */}
          <div className="px-6 py-5 border-b border-neutral-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-neutral-900" />
              <h2 className="font-bold text-lg tracking-tight">
                {isUrdu ? 'آپ کا شاپنگ کارٹ' : 'Your Bag'} ({items.length})
              </h2>
            </div>
            <button
              onClick={closeCart}
              className="p-2 rounded-full hover:bg-neutral-100 text-neutral-500 transition-colors"
              aria-label="Close cart"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Free Shipping Progress Indicator */}
          <div className="px-6 py-3 bg-neutral-50 border-b border-neutral-100 text-xs">
            <div className="flex items-center justify-between mb-1.5 font-medium">
              <span className="flex items-center gap-1.5 text-neutral-700">
                <Truck className="h-3.5 w-3.5 text-amber-600" />
                {remainingForFreeShipping > 0
                  ? isUrdu
                    ? `مفت ڈیلیوری کیلئے مزید ${formatPKR(remainingForFreeShipping)} کی خریداری کریں`
                    : `Add ${formatPKR(remainingForFreeShipping)} more for FREE Express Shipping`
                  : isUrdu
                  ? 'مبارک ہو! آپ کو مفت ایکسپریس ڈیلیوری مل گئی ہے'
                  : 'You have unlocked FREE Express Delivery!'}
              </span>
              <span className="font-bold text-neutral-900">
                {Math.round(freeShippingProgress)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-neutral-950 transition-all duration-300"
                style={{ width: `${freeShippingProgress}%` }}
              />
            </div>
          </div>

          {/* Cart Line Items Scroll Area */}
          <div className="flex-1 overflow-y-auto px-6 py-4 divide-y divide-neutral-100">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-16 space-y-4">
                <div className="h-16 w-16 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400">
                  <ShoppingBag className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 text-base">
                    {isUrdu ? 'آپ کا کارٹ خالی ہے' : 'Your bag is empty'}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1 max-w-xs">
                    {isUrdu
                      ? 'ہمارے نئے پشاوری چپل، کھسے اور اسنیکرز کلیکشن کو دریافت کریں'
                      : 'Explore our handcrafted Peshawari Chappals, Khussas, and modern sneakers.'}
                  </p>
                </div>
                <button
                  onClick={closeCart}
                  className="px-6 py-2.5 rounded-full bg-neutral-950 text-white text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors"
                >
                  {isUrdu ? 'خریداری شروع کریں' : 'Start Shopping'}
                </button>
              </div>
            ) : (
              items.map((item) => (
                <div key={`${item.productId}-${item.size}-${item.color}`} className="py-4 flex gap-4">
                  <div className="relative h-20 w-20 bg-neutral-100 rounded-lg overflow-hidden shrink-0 border border-neutral-200">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        referrerPolicy="no-referrer"
                        className="object-cover"
                        sizes="80px"
                      />
                    ) : (
                      <div className="h-full w-full bg-neutral-200" />
                    )}
                  </div>

                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-sm text-neutral-950 line-clamp-1">
                          {isUrdu ? item.nameUr || item.name : item.name}
                        </h4>
                        <button
                          onClick={() => removeItem(item.productId, item.size, item.color)}
                          className="text-neutral-400 hover:text-red-600 transition-colors"
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="text-xs text-neutral-500 mt-0.5 space-x-2">
                        <span>Size: <strong className="text-neutral-800">{item.size}</strong></span>
                        <span>•</span>
                        <span>Color: <strong className="text-neutral-800">{item.color}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      {/* Quantity Stepper */}
                      <div className="flex items-center border border-neutral-300 rounded-full overflow-hidden text-xs">
                        <button
                          onClick={() =>
                            updateQuantity(item.productId, item.size, item.color, item.quantity - 1)
                          }
                          className="p-1.5 hover:bg-neutral-100 text-neutral-600 transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="px-3 font-semibold text-neutral-900">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.productId, item.size, item.color, item.quantity + 1)
                          }
                          className="p-1.5 hover:bg-neutral-100 text-neutral-600 transition-colors"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <div className="font-bold text-sm text-neutral-950">
                          {formatPKR(item.price * item.quantity)}
                        </div>
                        {item.originalPrice > item.price && (
                          <div className="text-[11px] text-neutral-400 line-through">
                            {formatPKR(item.originalPrice * item.quantity)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Controls & Checkout CTA */}
          {items.length > 0 && (
            <div className="border-t border-neutral-200 px-6 py-5 bg-neutral-50/50 space-y-4">
              {/* Promo Coupon Form */}
              {appliedCoupon ? (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-800">
                  <div className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Coupon <strong>{appliedCoupon.code}</strong> (-{formatPKR(appliedCoupon.discountAmount)})</span>
                  </div>
                  <button
                    onClick={removeCoupon}
                    className="text-emerald-700 hover:text-red-600 font-bold ml-2 underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Promo Code (e.g. WELCOME10)"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs uppercase bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={couponLoading || !couponCode.trim()}
                    className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {couponLoading ? '...' : 'Apply'}
                  </button>
                </form>
              )}

              {couponError && (
                <div className="text-[11px] text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {couponError}
                </div>
              )}

              {/* Cost Breakdown */}
              <div className="space-y-1.5 text-xs text-neutral-600 pt-2 border-t border-neutral-200">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-neutral-950">{formatPKR(subtotal)}</span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Discount</span>
                    <span>-{formatPKR(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-neutral-500">
                  <span>Est. GST (17%) & Shipping</span>
                  <span>Calculated at checkout</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-neutral-950 pt-2 border-t border-neutral-200">
                  <span>Estimated Total</span>
                  <span>{formatPKR(estimatedTotal)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <Link
                href="/checkout"
                onClick={closeCart}
                className="w-full py-3.5 px-4 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-neutral-950/20"
              >
                <span>{isUrdu ? 'آرڈر مکمل کریں (چیک آؤٹ)' : 'Proceed to Checkout'}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
