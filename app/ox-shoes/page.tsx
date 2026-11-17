'use client';

/**
 * @file app/ox-shoes/page.tsx
 * @description Premium Ox Shoes Collection Page with standard website shell
 * (AnnouncementBar, Header, CartDrawer, SearchModal, Footer), server action data fetching,
 * and responsive collection layout.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { SearchModal } from '@/components/layout/SearchModal';
import { GalleryClient } from '@/components/home/GalleryClient';
import { getProducts } from '@/actions/product.actions';
import type { IProduct } from '@/types';

function filterOxCollection(allProducts: IProduct[]): IProduct[] {
  const filtered = allProducts.filter((p) => {
    const nameLower = (p.name || '').toLowerCase();
    const subLower = (p.subCategory || '').toLowerCase();
    const tagsLower = (p.tags || []).map((t) => t.toLowerCase());

    return (
      nameLower.includes('ox') ||
      nameLower.includes('peshawari') ||
      nameLower.includes('chappal') ||
      subLower.includes('ox') ||
      subLower.includes('peshawari') ||
      subLower.includes('formal') ||
      tagsLower.some((t) => t.includes('ox') || t.includes('peshawari'))
    );
  });

  return filtered.length > 0 ? filtered : allProducts;
}

export default function OxShoesCollectionPage() {
  const [products, setProducts] = useState<IProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);

  const reloadCollection = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await getProducts({ limit: 100 });
      if (res.success && Array.isArray(res.data.products)) {
        setProducts(filterOxCollection(res.data.products));
      } else if (!res.success) {
        setProducts([]);
        setFetchError(res.error || 'Unable to load collection catalog.');
      }
    } catch {
      setProducts([]);
      setFetchError('Unable to load collection catalog.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    getProducts({ limit: 100 })
      .then((res) => {
        if (!active) return;
        if (res.success && Array.isArray(res.data.products)) {
          setProducts(filterOxCollection(res.data.products));
          setFetchError(null);
        } else if (!res.success) {
          setProducts([]);
          setFetchError(res.error || 'Unable to load collection catalog.');
        }
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setProducts([]);
        setFetchError('Unable to load collection catalog.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between">
      <AnnouncementBar />
      <Header onOpenSearch={() => setSearchModalOpen(true)} />
      <SearchModal isOpen={searchModalOpen} onClose={() => setSearchModalOpen(false)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        {fetchError && !loading ? (
          <div className="py-20 text-center rounded-2xl bg-amber-50 border border-amber-200 p-8 space-y-4">
            <h2 className="font-black text-lg text-neutral-950 uppercase tracking-tight">
              Catalog Temporarily Unavailable
            </h2>
            <p className="text-xs text-neutral-600 max-w-md mx-auto">
              {fetchError}
            </p>
            <button
              type="button"
              onClick={reloadCollection}
              className="px-6 py-2.5 rounded-full bg-neutral-950 text-white text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <GalleryClient products={products} isLoading={loading} />
        )}
      </main>

      <Footer />
    </div>
  );
}
