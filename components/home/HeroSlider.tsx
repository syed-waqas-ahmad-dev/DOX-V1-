'use client';

/**
 * @file components/home/HeroSlider.tsx
 * @description High-impact Nike-inspired full-bleed hero section.
 * Bold typography, dual CTA buttons, and Pakistani footwear highlights.
 * Strict TypeScript: ZERO `any`.
 */

import Link from 'next/link';
import { useLocale } from '@/lib/store/locale';
import { ArrowRight, Sparkles } from 'lucide-react';

export function HeroSlider() {
  const { isUrdu } = useLocale();

  return (
    <section className="relative bg-neutral-950 text-white overflow-hidden">
      {/* Background with gradient and ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.15),transparent_50%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-transparent z-10" />

      {/* Hero Image / Background Mock */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-luminosity scale-105 transition-transform duration-1000"
        style={{
          backgroundImage:
            'url("https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=2000&q=85")',
        }}
      />

      <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 sm:pt-36 sm:pb-32 flex flex-col items-start justify-center min-h-[640px]">
        {/* Top Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-amber-300 uppercase tracking-widest mb-6">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span>{isUrdu ? 'نئی عید ۲۰۲۶ کلیکشن' : 'EID 2026 HERITAGE DROP'}</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black uppercase tracking-tighter max-w-4xl leading-[0.95] text-white">
          {isUrdu ? (
            <span dir="rtl" className="block text-3xl sm:text-5xl font-extrabold font-serif">
              خالص چمڑے کی شاہی پشاوری چپل و ماڈرن اسنیکرز
            </span>
          ) : (
            <>
              CRAFTED FOR ROYALTY. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-white">
                ENGINEERED TO ENDURE.
              </span>
            </>
          )}
        </h1>

        <p className="mt-6 text-sm sm:text-lg text-neutral-300 max-w-xl font-normal leading-relaxed">
          {isUrdu
            ? 'ڈبل تلہ پشاوری چپل، روایتی ملتانی کھسے اور شاک ایبزاربنگ مارگلہ جاگرز۔ پورے پاکستان میں کیش آن ڈیلیوری دستیاب ہے۔'
            : 'Authentic double-sole Kaptaan Chappals, bridal embroidered Khussas, and shock-absorbing running sneakers. Handcrafted in Pakistan with pure full-grain leather.'}
        </p>

        {/* Action CTAs */}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/shop?subCategory=Peshawari+Chappal"
            className="px-8 py-4 rounded-full bg-white hover:bg-neutral-200 text-neutral-950 font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-white/10 flex items-center gap-2"
          >
            <span>{isUrdu ? 'پشاوری چپل خریدیں' : 'Shop Heritage Chappals'}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <Link
            href="/shop?category=Men"
            className="px-8 py-4 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-white border border-neutral-700 font-bold text-xs uppercase tracking-widest transition-all backdrop-blur-md"
          >
            <span>{isUrdu ? 'مردانہ جوتے' : 'Men Footwear'}</span>
          </Link>

          <Link
            href="/shop?subCategory=Khussa"
            className="px-8 py-4 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-white border border-neutral-700 font-bold text-xs uppercase tracking-widest transition-all backdrop-blur-md"
          >
            <span>{isUrdu ? 'کھسہ کلیکشن' : 'Women Khussa'}</span>
          </Link>
        </div>

        {/* Quick Micro Stats */}
        <div className="mt-12 pt-8 border-t border-white/10 w-full grid grid-cols-2 sm:grid-cols-4 gap-6 text-xs text-neutral-400 font-medium">
          <div>
            <span className="block text-white font-black text-xl">100%</span>
            <span>Genuine Cow Leather</span>
          </div>
          <div>
            <span className="block text-white font-black text-xl">COD</span>
            <span>Nationwide Cash on Delivery</span>
          </div>
          <div>
            <span className="block text-white font-black text-xl">2-4 Days</span>
            <span>Express TCS Delivery</span>
          </div>
          <div>
            <span className="block text-white font-black text-xl">7 Days</span>
            <span>Hassle-Free Size Exchange</span>
          </div>
        </div>
      </div>
    </section>
  );
}
