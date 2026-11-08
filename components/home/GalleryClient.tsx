'use client';

/**
 * @file components/home/GalleryClient.tsx
 * @description Premium interactive Ox Shoes Collection client component.
 * Features responsive grid, filter chips (ALL, BROWN, BLACK, PESHAWARI),
 * price & rating sorting, breadcrumbs, safe back navigation, loading skeleton,
 * empty states, and store locator section. Reuses ProductCard component.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProductCard } from '@/components/product/ProductCard';
import { useLocale } from '@/lib/store/locale';
import type { IProduct } from '@/types';
import {
  ChevronLeft,
  ChevronDown,
  RotateCcw,
  Sparkles,
  Compass,
  MapPin,
  Phone,
  ArrowRight,
  ShieldCheck,
  PackageX,
  SlidersHorizontal,
} from 'lucide-react';

interface GalleryClientProps {
  products: IProduct[];
  isLoading?: boolean;
}

type FilterOption = 'ALL' | 'BROWN' | 'BLACK' | 'PESHAWARI';
type SortOption = 'newest' | 'price-asc' | 'price-desc' | 'rating';

export function GalleryClient({ products, isLoading = false }: GalleryClientProps) {
  const router = RouterHook();
  const { isUrdu } = useLocale();

  const [activeFilter, setActiveFilter] = useState<FilterOption>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Helper hook for safe router navigation
  function RouterHook() {
    try {
      return useRouter();
    } catch {
      return null;
    }
  }

  const handleBack = () => {
    if (router && typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else if (router) {
      router.push('/shop');
    }
  };

  // Compute filter counts
  const counts = useMemo(() => {
    let brown = 0;
    let black = 0;
    let peshawari = 0;

    products.forEach((p) => {
      const nameLower = p.name.toLowerCase();
      const subLower = (p.subCategory || '').toLowerCase();
      const colorLower = (p.colors || []).map((c) => c.name.toLowerCase()).join(' ');

      if (nameLower.includes('brown') || colorLower.includes('brown') || colorLower.includes('tan') || colorLower.includes('mustard')) {
        brown++;
      }
      if (nameLower.includes('black') || colorLower.includes('black') || colorLower.includes('dark')) {
        black++;
      }
      if (subLower.includes('peshawari') || nameLower.includes('peshawari') || nameLower.includes('chappal') || nameLower.includes('kaptaan')) {
        peshawari++;
      }
    });

    return {
      ALL: products.length,
      BROWN: brown,
      BLACK: black,
      PESHAWARI: peshawari,
    };
  }, [products]);

  // Filter products based on selected tab
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (activeFilter === 'ALL') return true;

      const nameLower = p.name.toLowerCase();
      const subLower = (p.subCategory || '').toLowerCase();
      const colorLower = (p.colors || []).map((c) => c.name.toLowerCase()).join(' ');

      if (activeFilter === 'BROWN') {
        return nameLower.includes('brown') || colorLower.includes('brown') || colorLower.includes('tan') || colorLower.includes('mustard');
      }
      if (activeFilter === 'BLACK') {
        return nameLower.includes('black') || colorLower.includes('black') || colorLower.includes('dark');
      }
      if (activeFilter === 'PESHAWARI') {
        return subLower.includes('peshawari') || nameLower.includes('peshawari') || nameLower.includes('chappal') || nameLower.includes('kaptaan');
      }
      return true;
    });
  }, [products, activeFilter]);

  // Sort filtered products
  const sortedProducts = useMemo(() => {
    const copy = [...filteredProducts];
    if (sortBy === 'price-asc') {
      return copy.sort((a, b) => a.price - b.price);
    }
    if (sortBy === 'price-desc') {
      return copy.sort((a, b) => b.price - a.price);
    }
    if (sortBy === 'rating') {
      return copy.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    // newest default
    return copy.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [filteredProducts, sortBy]);

  return (
    <div className="space-y-10">
      {/* Navigation Bar: Back Button & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-neutral-300 text-neutral-800 hover:bg-neutral-100 text-xs font-bold transition-all shadow-sm cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>{isUrdu ? 'واپس جائیں' : 'Back'}</span>
        </button>

        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="text-xs text-neutral-500 font-medium">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-neutral-950 transition-colors">
                {isUrdu ? 'ہوم' : 'Home'}
              </Link>
            </li>
            <li>/</li>
            <li>
              <Link href="/shop" className="hover:text-neutral-950 transition-colors">
                {isUrdu ? 'آکس شوز' : 'Ox Shoes'}
              </Link>
            </li>
            <li>/</li>
            <li className="font-bold text-neutral-950">
              {isUrdu ? 'کلیکشن' : 'Collection'}
            </li>
          </ol>
        </nav>
      </div>

      {/* Collection Hero Header */}
      <div className="space-y-4 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-neutral-950 text-amber-400 text-xs font-black uppercase tracking-wider">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span>{isUrdu ? 'خالص چمڑے کی دستکاری' : 'Original Artisan Leather'}</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight text-neutral-950">
          {isUrdu ? 'آکس شوز کی خصوصی کلیکشن' : 'OX SHOES COLLECTION'}
        </h1>

        <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
          {isUrdu
            ? 'باجوڑ آکس شوز کی روایتی پیشاوری چپلیں، اطالوی کٹ فارمل آکسفورڈ اور خالص چمڑے کے جوتے۔ ماہر کاریگروں کی دستکاری، باجوڑ اور خیبر پختونخوا کا دیرینہ معمیار۔'
            : 'Explore the master artisan footwear collection from Bajaur OX Shoes. Featuring 100% full-grain leather Peshawari Chappals, Italian-cut formal oxfords, and durable everyday footwear with nationwide Cash on Delivery.'}
        </p>

        {/* Value Badges */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-bold uppercase text-neutral-700">
          <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
            100% Pure Leather
          </span>
          <span className="px-3 py-1 bg-neutral-100 border border-neutral-200 text-neutral-800 rounded-lg">
            Handcrafted in Pakistan
          </span>
          <span className="px-3 py-1 bg-neutral-100 border border-neutral-200 text-neutral-800 rounded-lg">
            Nationwide COD Delivery
          </span>
        </div>
      </div>

      {/* Toolbar Controls: Filter Chips (Left) + Sort Dropdown & Count (Right) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-neutral-200 shadow-sm">
        {/* Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Filter:</span>
          </div>

          {(['ALL', 'BROWN', 'BLACK', 'PESHAWARI'] as FilterOption[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveFilter(tab)}
              className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                activeFilter === tab
                  ? 'bg-neutral-950 text-amber-400 shadow-md scale-105'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              {tab === 'ALL'
                ? isUrdu ? 'تمام شوز' : 'ALL'
                : tab === 'BROWN'
                ? isUrdu ? 'براؤن' : 'BROWN'
                : tab === 'BLACK'
                ? isUrdu ? 'بلیک' : 'BLACK'
                : isUrdu ? 'پیشاوری چپل' : 'PESHAWARI'}
              <span className="ml-1.5 opacity-75 font-normal">({counts[tab]})</span>
            </button>
          ))}
        </div>

        {/* Count & Sort Controls */}
        <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-neutral-100">
          <span className="text-xs font-semibold text-neutral-500">
            {sortedProducts.length} {sortedProducts.length === 1 ? 'Pair' : 'Pairs'} Available
          </span>

          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="appearance-none bg-neutral-100 border border-neutral-300 rounded-full px-4 py-2 pr-8 text-xs font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 cursor-pointer shadow-sm"
            >
              <option value="newest">Sort By: Newest Drops</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Top Rated</option>
            </select>
            <ChevronDown className="absolute right-3 top-2.5 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Main Product Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse space-y-3 bg-white p-3 rounded-2xl border border-neutral-200">
              <div className="aspect-square bg-neutral-200 rounded-xl" />
              <div className="h-4 bg-neutral-200 rounded w-3/4" />
              <div className="h-4 bg-neutral-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : sortedProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {sortedProducts.map((product) => (
            <ProductCard key={product._id.toString()} product={product} />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="py-16 px-6 text-center bg-white rounded-3xl border border-neutral-200 shadow-sm space-y-4 max-w-lg mx-auto">
          <div className="h-16 w-16 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
            <PackageX className="h-8 w-8" />
          </div>

          <h3 className="text-lg font-black uppercase tracking-tight text-neutral-950">
            {isUrdu ? 'کوئی جوتا نہیں ملا' : 'No Matching Ox Shoes Found'}
          </h3>

          <p className="text-xs text-neutral-600 leading-relaxed">
            {isUrdu
              ? 'منتخب کردہ فلٹر کے مطابق کوئی جوتا دستیاب نہیں ہے۔ تمام کلیکشن دیکھنے کے لیے فلٹر ریسیٹ کریں۔'
              : `We couldn't find any footwear matching the "${activeFilter}" filter. Try switching filter tabs or reset to see all pairs.`}
          </p>

          <button
            type="button"
            onClick={() => setActiveFilter('ALL')}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-neutral-950 text-white text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors shadow"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Filter</span>
          </button>
        </div>
      )}

      {/* PHYSICAL FLAGSHIP BOUTIQUES SECTION */}
      <section className="mt-16 p-6 sm:p-8 rounded-3xl bg-neutral-950 text-white space-y-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 border-b border-neutral-800 pb-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-wider">
              <Compass className="h-3.5 w-3.5" />
              <span>Physical Flagship Boutiques</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
              LOCATE AN OX SHOES STORE
            </h2>

            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              Experience authentic master craftsmanship in person. Visit our physical store in District Bajaur for custom foot sizing, size measurement, and handcrafted chappal fittings.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href="/stores"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-black uppercase tracking-wider shadow transition-all"
            >
              <span>View Store Locator</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <a
              href="https://wa.me/923000914546"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-white text-xs font-bold transition-all"
            >
              <Phone className="h-4 w-4 text-emerald-400" />
              <span>WhatsApp Store Concierge</span>
            </a>
          </div>
        </div>

        {/* Store Detail Address Badge */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs relative z-10">
          <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-1">
            <div className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Main Atelier Address
            </div>
            <p className="text-neutral-300">
              Inayat Killi Bazar, Bypass Road, near Inam Plaza, District Bajaur, Pakistan
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-1">
            <div className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              Customer Support & Orders
            </div>
            <p className="text-neutral-300">+92 300 0914546 (WhatsApp Available)</p>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-1">
            <div className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5" />
              Delivery Coverage
            </div>
            <p className="text-neutral-300">Nationwide Pakistan Cash on Delivery (COD)</p>
          </div>
        </div>
      </section>
    </div>
  );
}
