'use client';

/**
 * @file app/wishlist/page.tsx
 * @description Customer Wishlist page for OX Shoes Pakistan at /wishlist.
 * Supports localStorage key 'ox_wishlist' fallback and MongoDB API persistence.
 * Strict TypeScript: ZERO `any`.
 */

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useWishlistStore } from '@/lib/store/wishlist';
import { useCartStore } from '@/lib/store/cart';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { formatPKR } from '@/lib/formatters/currency';
import { Heart, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';

const emptySubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export default function WishlistPage() {
  const { items, removeItem, clearWishlist } = useWishlistStore();
  const { addItem } = useCartStore();
  const mounted = useIsClient();

  const handleMoveToCart = (item: (typeof items)[0]) => {
    addItem({
      productId: item.productId,
      name: item.name,
      nameUr: item.nameUr || item.name,
      image: item.image,
      size: '41',
      color: 'Standard',
      price: item.price,
      originalPrice: item.originalPrice || item.price,
      sku: `OX-${item.productId.slice(-4)}`,
      weight: 750,
      quantity: 1,
    });
    removeItem(item.productId);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between">
        <AnnouncementBar />
        <Header onOpenSearch={() => {}} />
        <main className="max-w-6xl mx-auto px-4 py-16 w-full flex-1 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-neutral-200 rounded mx-auto" />
            <div className="h-4 w-72 bg-neutral-200 rounded mx-auto" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between">
      <AnnouncementBar />
      <Header onOpenSearch={() => {}} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-200 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded bg-red-100 text-red-700">
                OX Favorites
              </span>
              <span className="text-xs text-neutral-400">Offline & Online Synced</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-neutral-950 flex items-center gap-2.5">
              <Heart className="h-6 w-6 text-red-500 fill-red-500" />
              <span>Wishlist ({items.length})</span>
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Footwear bookmarked for your next purchase with Cash on Delivery
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearWishlist}
                className="px-4 py-2 bg-white border border-neutral-300 hover:bg-neutral-100 rounded-full text-neutral-700 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear All</span>
              </button>
            )}
            <Link
              href="/cart"
              className="px-4 py-2 bg-neutral-950 hover:bg-neutral-800 text-white rounded-full text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Go to Cart</span>
            </Link>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white border border-neutral-200 space-y-4 shadow-sm">
            <div className="h-16 w-16 bg-red-50 text-red-500 rounded-full mx-auto flex items-center justify-center">
              <Heart className="h-8 w-8" />
            </div>
            <h3 className="font-bold text-lg text-neutral-900">Your Wishlist is Empty</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
              Explore our handcrafted Peshawari Chappals, Formal Oxford shoes, and casual sneakers. Tap the heart icon on any shoe to save it here!
            </p>
            <div className="pt-2">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md"
              >
                <span>Browse Footwear</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map((item) => (
              <div
                key={item.productId}
                className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow group"
              >
                <div className="relative aspect-square w-full rounded-xl bg-neutral-100 overflow-hidden border border-neutral-100">
                  {item.image && (
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      referrerPolicy="no-referrer"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    className="absolute top-2.5 right-2.5 p-2 rounded-full bg-white/90 hover:bg-white text-neutral-700 shadow transition-colors"
                    title="Remove from wishlist"
                  >
                    <Trash2 className="h-4 w-4 text-neutral-500 hover:text-red-600" />
                  </button>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                    {item.subCategory || 'Footwear'}
                  </span>
                  <Link
                    href={`/product/${item.slug || item.productId}`}
                    className="font-bold text-sm text-neutral-950 line-clamp-1 hover:text-amber-600 transition-colors block"
                  >
                    {item.name}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-black text-sm text-neutral-950">
                      {formatPKR(item.price)}
                    </span>
                    {item.originalPrice && item.originalPrice > item.price && (
                      <span className="text-xs text-neutral-400 line-through">
                        {formatPKR(item.originalPrice)}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleMoveToCart(item)}
                  className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>Move to Cart</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
