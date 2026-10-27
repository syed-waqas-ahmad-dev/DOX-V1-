'use client';

/**
 * @file components/home/FlashSaleBanner.tsx
 * @description Promotional flash sale callout with time-sensitive discount codes.
 * Strict TypeScript: ZERO `any`.
 */

import Link from 'next/link';
import { useLocale } from '@/lib/store/locale';
import { Zap, ArrowRight } from 'lucide-react';

export function FlashSaleBanner() {
  const { isUrdu } = useLocale();

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="relative rounded-3xl bg-gradient-to-r from-neutral-950 via-neutral-900 to-amber-950 text-white p-8 sm:p-12 overflow-hidden border border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="relative z-10 space-y-3 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/30 border border-red-500/50 text-red-300 text-xs font-black uppercase tracking-wider">
            <Zap className="h-3.5 w-3.5 fill-red-400 text-red-400" />
            <span>{isUrdu ? 'محدود مدت کی سیل' : 'Limited Time Offer'}</span>
          </div>

          <h3 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter">
            {isUrdu ? 'عید اسپیشل: فلیٹ روپے ۱,۰۰۰ کی بچت' : 'EID SPECIAL: SAVE FLAT PKR 1,000'}
          </h3>

          <p className="text-xs sm:text-sm text-neutral-300 max-w-lg">
            {isUrdu
              ? 'چیک آؤٹ پر کوپن کوڈ EIDVIBES استعمال کریں اور روپے ۶,۰۰۰ سے زائد کی خریداری پر فوری رعایت پائیں۔'
              : 'Use promo code EIDVIBES at checkout to claim instant flat PKR 1,000 off on orders over PKR 6,000. Nationwide Cash on Delivery applicable.'}
          </p>
        </div>

        <div className="relative z-10 flex flex-col items-center sm:items-end gap-3 shrink-0">
          <div className="px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 font-mono text-sm tracking-widest text-amber-300 font-bold">
            CODE: EIDVIBES
          </div>
          <Link
            href="/shop"
            className="px-6 py-3 rounded-full bg-white hover:bg-neutral-200 text-neutral-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-colors"
          >
            <span>{isUrdu ? 'سیل جوتے دیکھیں' : 'Shop the Sale'}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
