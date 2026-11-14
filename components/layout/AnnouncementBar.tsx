'use client';

/**
 * @file components/layout/AnnouncementBar.tsx
 * @description Top promotional ticker for free shipping & COD announcements.
 * Strict TypeScript: ZERO `any`.
 */

import { useLocaleStore } from '@/lib/store/locale';
import { useHydrated } from '@/lib/hooks/useHydrated';
import { Truck, ShieldCheck, Zap } from 'lucide-react';

export function AnnouncementBar() {
  const { isUrdu } = useLocaleStore();
  const isHydrated = useHydrated();
  const currentIsUrdu = isHydrated && isUrdu;

  return (
    <div className="hidden lg:block bg-neutral-900 text-neutral-200 text-xs py-2 px-4 border-b border-neutral-800 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between text-[11px] sm:text-xs">
        <div className="flex items-center gap-2 font-medium tracking-wide mx-auto sm:mx-0">
          <Truck className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span>
            {currentIsUrdu
              ? 'پورے پاکستان میں روپے ۵,۰۰۰ سے زیادہ کے آرڈرز پر مفت ایکسپریس ڈیلیوری | کیش آن ڈیلیوری دستیاب ہے'
              : 'FREE EXPRESS SHIPPING ON ORDERS OVER PKR 5,000 ACROSS PAKISTAN | CASH ON DELIVERY (COD) AVAILABLE'}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-4 text-neutral-400 text-[11px]">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            {currentIsUrdu ? '۷ دن کی آسان واپسی' : '7-Day Easy Returns'}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            {currentIsUrdu ? 'ٹی سی ایس اور لیپرڈز کورئیر' : 'TCS & Leopards Courier'}
          </span>
        </div>
      </div>
    </div>
  );
}
