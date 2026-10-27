'use client';

/**
 * @file app/stores/page.tsx
 * @description Official physical store locator for OX Shoes boutiques across Pakistan.
 * Embedded OpenStreetMap with interactive pins, address lookup, and direct turn-by-turn directions.
 * Strict TypeScript: ZERO `any`.
 */

import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { StoreLocatorMap } from '@/components/maps/StoreLocatorMap';
import { useLocale } from '@/lib/store/locale';
import {
  MapPin,
  Compass,
  Phone,
  ShieldCheck,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  Clock,
} from 'lucide-react';

export default function StoresPage() {
  const { isUrdu } = useLocale();

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between">
      <AnnouncementBar />
      <Header onOpenSearch={() => {}} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1 space-y-10">
        {/* Hero Section */}
        <div className="border-b border-neutral-200 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900 text-amber-400 text-xs font-black uppercase tracking-wider">
              <Compass className="h-3.5 w-3.5" />
              <span>{isUrdu ? 'برانڈ آؤٹ لیٹس' : 'Physical Flagship Boutiques'}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight text-neutral-950">
              {isUrdu ? 'ہمارے اسٹورز کا پتہ لگائیں' : 'Locate an OX Shoes Store'}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
              {isUrdu
                ? 'لاہور، کراچی، اسلام آباد، راولپنڈی اور فیصل آباد میں ہمارے دستکاری اسٹوڈیوز تشریف لائیں اور اصلی چمڑے کے جوتے خود آزمائیں۔'
                : 'Experience traditional master craftsmanship in person. Visit our bespoke ateliers in Lahore, Karachi, Islamabad, Rawalpindi, and Faisalabad for custom fitting, size measurement, and instant pickup.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-all"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Shop Online</span>
            </Link>
            <a
              href="https://wa.me/923001234567"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 text-xs font-bold transition-all"
            >
              <Phone className="h-3.5 w-3.5 text-emerald-600" />
              <span>WhatsApp Store Concierge</span>
            </a>
          </div>
        </div>

        {/* OpenStreetMap Store Locator Component */}
        <section className="space-y-4">
          <StoreLocatorMap />
        </section>

        {/* In-Store VIP Services Grid */}
        <section className="pt-6 border-t border-neutral-200">
          <h2 className="text-xl font-black uppercase tracking-tight text-neutral-950 mb-6 text-center">
            Complimentary Services at Every OX Shoes Boutique
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-neutral-200 space-y-2 shadow-sm">
              <div className="h-10 w-10 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-xs uppercase text-neutral-950">Artisan Foot Sizing</h3>
              <p className="text-[11px] text-neutral-600 leading-relaxed">
                Precision caliper foot measuring to find your exact Peshawari, Oxford, or sneaker size.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-neutral-200 space-y-2 shadow-sm">
              <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-xs uppercase text-neutral-950">Free Leather Conditioning</h3>
              <p className="text-[11px] text-neutral-600 leading-relaxed">
                Bring any pair of OX Shoes for lifetime wax conditioning and edge polishing at no charge.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-neutral-200 space-y-2 shadow-sm">
              <div className="h-10 w-10 rounded-full bg-sky-50 text-sky-700 flex items-center justify-center">
                <Clock className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-xs uppercase text-neutral-950">1-Hour Click & Collect</h3>
              <p className="text-[11px] text-neutral-600 leading-relaxed">
                Order online and collect your packaged shoes from your nearest boutique within 60 minutes.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-neutral-200 space-y-2 shadow-sm">
              <div className="h-10 w-10 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center">
                <MapPin className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-xs uppercase text-neutral-950">Hassle-Free In-Store Returns</h3>
              <p className="text-[11px] text-neutral-600 leading-relaxed">
                Exchange any website purchase directly at the counter with your invoice QR code.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
