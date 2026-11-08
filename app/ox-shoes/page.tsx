'use client';

/**
 * @file app/ox-shoes/page.tsx
 * @description Premium Ox Shoes Collection Page with standard website shell
 * (AnnouncementBar, Header, CartDrawer, SearchModal, Footer), server action data fetching,
 * and responsive collection layout.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { CartDrawer } from '@/components/layout/CartDrawer';
import { SearchModal } from '@/components/layout/SearchModal';
import { GalleryClient } from '@/components/home/GalleryClient';
import { getProducts } from '@/actions/product.actions';
import type { IProduct } from '@/types';

export default function OxShoesCollectionPage() {
  const [products, setProducts] = useState<IProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);

  useEffect(() => {
    let active = true;

    async function loadOxShoesProducts() {
      setLoading(true);
      const res = await getProducts({ limit: 100 });

      if (active) {
        if (res.success && Array.isArray(res.data.products)) {
          const allProducts = res.data.products;

          // Filter for Ox Shoes collection items
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

          // Fallback to all products if specific string filter yields 0
          setProducts(filtered.length > 0 ? filtered : allProducts);
        } else {
          setProducts([]);
        }
        setLoading(false);
      }
    }

    loadOxShoesProducts();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between">
      <AnnouncementBar />
      <Header onOpenSearch={() => setSearchModalOpen(true)} />
      <CartDrawer />
      <SearchModal isOpen={searchModalOpen} onClose={() => setSearchModalOpen(false)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        <GalleryClient products={products} isLoading={loading} />
      </main>

      <Footer />
    </div>
  );
}
