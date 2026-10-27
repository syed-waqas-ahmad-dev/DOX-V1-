/**
 * @file lib/store/wishlist.ts
 * @description Persistent Zustand store for saved footwear items.
 * Strict TypeScript: ZERO `any`.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface WishlistStoreItem {
  productId: string;
  name: string;
  nameUr: string;
  image: string;
  price: number;
  originalPrice: number;
  slug: string;
  subCategory: string;
}

interface WishlistState {
  items: WishlistStoreItem[];
  toggleWishlist: (item: WishlistStoreItem) => void;
  isInWishlist: (productId: string) => boolean;
  removeItem: (productId: string) => void;
  clearWishlist: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],

      toggleWishlist: (item) => {
        const exists = get().items.some((i) => i.productId === item.productId);
        if (exists) {
          set({ items: get().items.filter((i) => i.productId !== item.productId) });
        } else {
          set({ items: [...get().items, item] });
        }
      },

      isInWishlist: (productId) => {
        return get().items.some((i) => i.productId === productId);
      },

      removeItem: (productId) => {
        set({ items: get().items.filter((i) => i.productId !== productId) });
      },

      clearWishlist: () => set({ items: [] }),
    }),
    {
      name: 'ox_wishlist',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
