'use client';

/**
 * @file app/page.tsx
 * @description Master Storefront Homepage for OX Shoes Pakistan (Nike-inspired).
 * Seamlessly integrates HeroSlider, CategoryShowcase, Featured Footwear Grid,
 * FlashSaleBanner, ValueProps, Cart Drawer, and Architecture Inspector Toggle.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { CartDrawer } from '@/components/layout/CartDrawer';
import { SearchModal } from '@/components/layout/SearchModal';
import { HeroSlider } from '@/components/home/HeroSlider';
import { CategoryShowcase } from '@/components/home/CategoryShowcase';
import { FlashSaleBanner } from '@/components/home/FlashSaleBanner';
import { CustomerReviewsSection } from '@/components/home/CustomerReviewsSection';
import { ProductCard } from '@/components/product/ProductCard';
import { getFeaturedProducts } from '@/actions/product.actions';
import { useLocale } from '@/lib/store/locale';
import type { IProduct } from '@/types';
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Truck,
  RotateCcw,
  Headphones,
  Database,
} from 'lucide-react';

import { useHydrated } from '@/lib/hooks/useHydrated';

export default function HomePage() {
  const [featuredShoes, setFeaturedShoes] = useState<IProduct[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const { isUrdu } = useLocale();
  const isHydrated = useHydrated();

  useEffect(() => {
    async function loadFeatured() {
      setLoadingFeatured(true);
      const res = await getFeaturedProducts(8);
      if (res.success && res.data) {
        setFeaturedShoes(res.data);
      }
      setLoadingFeatured(false);
    }
    loadFeatured();
  }, []);

  const currentIsUrdu = isHydrated && isUrdu;

  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col justify-between selection:bg-neutral-950 selection:text-white">
      {/* Top Banner & Navigation */}
      <AnnouncementBar />
      <Header onOpenSearch={() => setSearchModalOpen(true)} />
      <CartDrawer />
      <SearchModal isOpen={searchModalOpen} onClose={() => setSearchModalOpen(false)} />

      <main className="flex-1">
        {/* Full-bleed Nike-style Hero */}
        <HeroSlider />

        {/* Featured Category Tiles */}
        <CategoryShowcase />

        {/* Trending & Featured Footwear Showcase */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-neutral-100">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-amber-600 mb-1">
                <Sparkles className="h-3.5 w-3.5" />
                <span>{currentIsUrdu ? 'خاص کلیکشن' : 'Curated Footwear'}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-neutral-950">
                {currentIsUrdu ? 'مقبول ترین پشاوری چپل و جوتے' : 'Trending Now in Pakistan'}
              </h2>
            </div>
            <Link
              href="/shop"
              className="text-xs font-bold uppercase tracking-wider text-neutral-900 hover:text-amber-600 flex items-center gap-1 transition-colors"
            >
              <span>{currentIsUrdu ? 'مکمل کلیکشن دیکھیں' : 'Explore All Footwear'}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {loadingFeatured ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse space-y-3">
                  <div className="aspect-square bg-neutral-200 rounded-xl" />
                  <div className="h-4 bg-neutral-200 rounded w-3/4" />
                  <div className="h-4 bg-neutral-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {featuredShoes.map((shoe) => (
                <ProductCard key={shoe._id.toString()} product={shoe} />
              ))}
            </div>
          )}
        </section>

        {/* Eid Flash Sale Callout */}
        <FlashSaleBanner />

        {/* Value Proposition Grid (COD, 7-Day Returns, Craftsmanship) */}
        <section className="bg-neutral-50 border-y border-neutral-200 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h3 className="text-2xl font-black uppercase tracking-tight text-neutral-950">
                {currentIsUrdu ? 'او ایکس شوز پر اعتماد کی وجوہات' : 'Why Pakistan Chooses OX Shoes'}
              </h3>
              <p className="text-xs sm:text-sm text-neutral-500 mt-2">
                {currentIsUrdu
                  ? 'خالص چمڑا، پائیدار تلہ اور پورے ملک میں گھر کی دہلیز پر کیش آن ڈیلیوری کی سہولت۔'
                  : 'Zero compromises on craftsmanship. Every pair is cut from select full-grain Pakistani cowhide with reinforced soles.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm space-y-3">
                <div className="h-12 w-12 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-950">
                  <Truck className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-sm text-neutral-950 uppercase tracking-wider">
                  Cash on Delivery
                </h4>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Pay cash at your doorstep via TCS & Leopards. Available in 200+ cities and tehsils.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm space-y-3">
                <div className="h-12 w-12 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-950">
                  <RotateCcw className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-sm text-neutral-950 uppercase tracking-wider">
                  7-Day Size Exchange
                </h4>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Shoe fit not perfect? Exchange sizes smoothly within 7 days with doorstep pickup.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm space-y-3">
                <div className="h-12 w-12 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-950">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-sm text-neutral-950 uppercase tracking-wider">
                  100% Full-Grain Leather
                </h4>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Hand-selected bovine hides that age beautifully and mold to your exact foot curvature.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm space-y-3">
                <div className="h-12 w-12 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-950">
                  <Headphones className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-sm text-neutral-950 uppercase tracking-wider">
                  Direct WhatsApp Support
                </h4>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Need sizing advice or tracking update? Chat live with our shoe stylists on WhatsApp.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Customer Reviews Section */}
        <CustomerReviewsSection />
      </main>

      <Footer />
    </div>
  );
}
