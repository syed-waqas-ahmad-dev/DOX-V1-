'use client';

/**
 * @file components/home/CategoryShowcase.tsx
 * @description Visual category tiles inspired by Nike.com collections.
 * Strict TypeScript: ZERO `any`.
 */

import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from '@/lib/store/locale';
import { ArrowUpRight } from 'lucide-react';

const CATEGORIES = [
  {
    title: 'Peshawari & Nowsheri Chappals',
    titleUr: 'پشاوری و نوشہری چپل',
    sub: 'Kaptaan & Charsadda Double Sole',
    href: '/shop?subCategory=Peshawari+Chappal',
    image: '/assets/aistudio/IMG-20261020-WA8532_639af429.jpg',
    tag: 'Heritage Bestseller',
  },
  {
    title: 'Multani & Bridal Khussa',
    titleUr: 'ملتانی و برائیڈل کھسہ',
    sub: 'Velvet, Silk & Gold Tilla Work',
    href: '/shop?subCategory=Khussa',
    image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80',
    tag: 'Wedding Collection',
  },
  {
    title: 'Executive Italian Oxfords & Brogues',
    titleUr: 'ایگزیکٹو فارمل جوتے',
    sub: 'Goodyear Welted Leather Sole',
    href: '/shop?category=Men&subCategory=Formal+Shoes',
    image: 'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=800&q=80',
    tag: 'Formal Luxury',
  },
  {
    title: 'Margalla Pro Trail Joggers',
    titleUr: 'مارگلہ رننگ جاگرز',
    sub: 'High-Rebound Hyper EVA Foam',
    href: '/shop?subCategory=Joggers',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
    tag: 'Performance Athletics',
  },
];

export function CategoryShowcase() {
  const { isUrdu } = useLocale();

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
        <div>
          <span className="text-xs font-black uppercase tracking-widest text-amber-600 block mb-1">
            {isUrdu ? 'کیٹیگریز' : 'Featured Collections'}
          </span>
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-neutral-950">
            {isUrdu ? 'مقبول ترین کلیکشنز دریافت کریں' : 'Shop by Specialty'}
          </h2>
        </div>
        <Link
          href="/shop"
          className="text-xs font-bold uppercase tracking-wider text-neutral-900 hover:text-amber-600 flex items-center gap-1 transition-colors"
        >
          <span>{isUrdu ? 'تمام جوتے دیکھیں' : 'View All Collections'}</span>
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {CATEGORIES.map((cat, i) => (
          <Link
            key={i}
            href={cat.href}
            className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-neutral-100 flex flex-col justify-end p-6 border border-neutral-200"
          >
            <Image
              src={cat.image}
              alt={cat.title}
              fill
              referrerPolicy="no-referrer"
              className="object-cover object-center group-hover:scale-105 transition-transform duration-700"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

            <div className="relative z-10 text-white">
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md mb-2 inline-block">
                {cat.tag}
              </span>
              <h3 className="text-lg font-black uppercase tracking-tight leading-snug">
                {isUrdu ? cat.titleUr : cat.title}
              </h3>
              <p className="text-xs text-neutral-300 mt-1 line-clamp-1">{cat.sub}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
