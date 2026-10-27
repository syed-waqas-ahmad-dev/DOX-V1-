'use client';

/**
 * @file app/dashboard/wishlist/page.tsx
 * @description Customer saved items page with instant move-to-bag actions.
 * Strict TypeScript: ZERO `any`.
 */

import Link from 'next/link';
import Image from 'next/image';
import { useWishlistStore } from '@/lib/store/wishlist';
import { useCartStore } from '@/lib/store/cart';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { formatPKR } from '@/lib/formatters/currency';
import { Heart, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';

export default function WishlistPage() {
  const { items, removeItem, clearWishlist } = useWishlistStore();
  const { addItem } = useCartStore();

  const handleMoveToCart = (item: (typeof items)[0]) => {
    addItem({
      productId: item.productId,
      name: item.name,
      nameUr: item.nameUr,
      image: item.image,
      size: '41',
      color: 'Standard',
      price: item.price,
      originalPrice: item.originalPrice,
      sku: `OX-${item.productId.slice(-4)}`,
      weight: 750,
      quantity: 1,
    });
    removeItem(item.productId);
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between">
      <AnnouncementBar />
      <Header onOpenSearch={() => {}} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-200 pb-4 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-neutral-950">
              My Saved Shoes ({items.length})
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">Footwear bookmarked for future purchases</p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto text-xs font-bold">
            <Link href="/dashboard/profile" className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-full text-neutral-700">
              Profile
            </Link>
            <Link href="/dashboard/orders" className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-full text-neutral-700">
              Orders
            </Link>
            <Link href="/dashboard/wishlist" className="px-4 py-2 bg-neutral-950 text-white rounded-full">
              Wishlist
            </Link>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white border border-neutral-200 space-y-4">
            <div className="h-16 w-16 bg-neutral-100 rounded-full mx-auto flex items-center justify-center text-neutral-400">
              <Heart className="h-8 w-8" />
            </div>
            <h3 className="font-bold text-lg text-neutral-900">Your Wishlist is Empty</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Save your favorite Peshawari Chappals, Khussas, or sneakers to track stock and prices.
            </p>
            <Link href="/shop" className="inline-block px-6 py-2.5 rounded-full bg-neutral-950 text-white text-xs font-bold uppercase tracking-wider">
              Explore Footwear
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <div key={item.productId} className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-sm flex flex-col justify-between space-y-4">
                <div className="relative aspect-square w-full rounded-xl bg-neutral-100 overflow-hidden border border-neutral-100">
                  {item.image && <Image src={item.image} alt={item.name} fill referrerPolicy="no-referrer" className="object-cover" sizes="200px" />}
                  <button
                    onClick={() => removeItem(item.productId)}
                    className="absolute top-2.5 right-2.5 p-2 rounded-full bg-white/90 hover:bg-white text-neutral-700 shadow"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    {item.subCategory}
                  </span>
                  <h4 className="font-bold text-sm text-neutral-950 line-clamp-1">{item.name}</h4>
                  <div className="mt-1 font-black text-sm text-neutral-950">{formatPKR(item.price)}</div>
                </div>

                <button
                  onClick={() => handleMoveToCart(item)}
                  className="w-full py-2.5 px-4 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span>Move to Bag</span>
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
