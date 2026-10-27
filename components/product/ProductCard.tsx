'use client';

/**
 * @file components/product/ProductCard.tsx
 * @description Nike-style minimal footwear card.
 * High-impact imagery, quick-add, PKR pricing, discount badges, and Urdu title support.
 * Valid HTML5 nesting without button-inside-a and hydration guards.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCartStore } from '@/lib/store/cart';
import { useWishlistStore } from '@/lib/store/wishlist';
import { useLocale } from '@/lib/store/locale';
import { useHydrated } from '@/lib/hooks/useHydrated';
import { formatPKR } from '@/lib/formatters/currency';
import { Heart, ShoppingBag, Star } from 'lucide-react';
import type { IProduct } from '@/types';

interface ProductCardProps {
  product: IProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCartStore();
  const { isInWishlist, toggleWishlist } = useWishlistStore();
  const { isUrdu } = useLocale();
  const isHydrated = useHydrated();

  const isSaved = isHydrated && isInWishlist(product._id.toString());
  const currentIsUrdu = isUrdu;

  const primaryImage =
    product.images?.[0] ||
    'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=80';
  const defaultSize = product.sizes?.[0] || '41';
  const defaultColor = product.colors?.[0]?.name || 'Standard';

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    addItem({
      productId: product._id.toString(),
      name: product.name,
      nameUr: product.nameUr,
      image: primaryImage,
      size: defaultSize,
      color: defaultColor,
      price: product.price,
      originalPrice: product.originalPrice,
      sku: product.sku,
      weight: product.weight || 750,
      quantity: 1,
    });
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    toggleWishlist({
      productId: product._id.toString(),
      name: product.name,
      nameUr: product.nameUr,
      image: primaryImage,
      price: product.price,
      originalPrice: product.originalPrice,
      slug: product.slug,
      subCategory: product.subCategory,
    });
  };

  return (
    <div className="group relative flex flex-col justify-between rounded-xl bg-white transition-all">
      {/* Image & Action Overlay Container (Pure div, no button inside Link) */}
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-100 border border-neutral-100">
        <Link
          href={`/product/${product.slug}`}
          className="absolute inset-0 z-0 block"
          aria-label={product.name}
        >
          <Image
            src={primaryImage}
            alt={product.name}
            fill
            referrerPolicy="no-referrer"
            className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        </Link>

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10 pointer-events-none">
          {product.discount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-neutral-950 text-white text-[10px] font-black uppercase tracking-wider shadow">
              {product.discount}% OFF
            </span>
          )}
          {product.isFeatured && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-neutral-950 text-[10px] font-black uppercase tracking-wider shadow">
              Featured
            </span>
          )}
        </div>

        {/* Wishlist Button */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 z-10">
          <button
            type="button"
            onClick={handleToggleWishlist}
            className={`p-2 rounded-full backdrop-blur-md transition-all ${
              isSaved
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-white/80 hover:bg-white text-neutral-700 shadow'
            }`}
            aria-label="Save to Wishlist"
            title="Save to Wishlist"
          >
            <Heart className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Quick Add Overlay on Hover */}
        <div className="absolute inset-x-2 bottom-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            type="button"
            onClick={handleQuickAdd}
            className="w-full py-2.5 px-4 rounded-full bg-white/95 hover:bg-neutral-950 hover:text-white text-neutral-950 text-xs font-bold uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 transition-all"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>{currentIsUrdu ? 'کارٹ میں شامل کریں' : 'Quick Add'}</span>
          </button>
        </div>
      </div>

      {/* Product Details */}
      <div className="pt-3.5 pb-2 flex flex-col justify-between flex-1">
        <div>
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
            <span className="font-semibold text-neutral-600 uppercase tracking-wider text-[11px]">
              {product.subCategory}
            </span>
            {product.rating > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-neutral-800">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {product.rating.toFixed(1)}
              </span>
            )}
          </div>

          <Link
            href={`/product/${product.slug}`}
            className="block group-hover:text-neutral-700 transition-colors"
          >
            <h3 className="font-bold text-sm text-neutral-950 line-clamp-1 tracking-tight">
              {product.name}
            </h3>
            {product.nameUr && (
              <p className="text-xs text-neutral-500 font-medium line-clamp-1 mt-0.5" dir="rtl">
                {product.nameUr}
              </p>
            )}
          </Link>
        </div>

        {/* Price & Colors Count */}
        <div className="mt-2.5 pt-2 border-t border-neutral-100 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-black text-sm text-neutral-950">
              {formatPKR(product.price)}
            </span>
            {product.originalPrice > product.price && (
              <span className="text-xs text-neutral-400 line-through">
                {formatPKR(product.originalPrice)}
              </span>
            )}
          </div>

          <span className="text-[11px] text-neutral-400 font-medium">
            {product.colors?.length || 1} {product.colors?.length === 1 ? 'Color' : 'Colors'}
          </span>
        </div>
      </div>
    </div>
  );
}
