/**
 * @file lib/store/recently-viewed.ts
 * @description Persistent store tracking customer recently viewed shoes.
 * Strict TypeScript: ZERO `any`.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface RecentProduct {
  productId: string;
  name: string;
  nameUr: string;
  image: string;
  price: number;
  originalPrice: number;
  slug: string;
  subCategory: string;
}

interface RecentlyViewedState {
  products: RecentProduct[];
  addProduct: (product: RecentProduct) => void;
  clearAll: () => void;
}

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      products: [],

      addProduct: (product) => {
        const filtered = get().products.filter((p) => p.productId !== product.productId);
        set({ products: [product, ...filtered].slice(0, 8) }); // Keep last 8
      },

      clearAll: () => set({ products: [] }),
    }),
    {
      name: 'ox-recently-viewed',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
