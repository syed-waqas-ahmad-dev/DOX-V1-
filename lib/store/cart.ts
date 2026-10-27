/**
 * @file lib/store/cart.ts
 * @description Persistent Zustand store for client shopping cart, item counters,
 * coupon applications, and slide-over drawer visibility.
 * Strict TypeScript: ZERO `any`.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface CartStoreItem {
  productId: string;
  name: string;
  nameUr: string;
  image: string;
  size: string;
  color: string;
  price: number;
  originalPrice: number;
  quantity: number;
  sku: string;
  weight: number;
}

interface CartState {
  items: CartStoreItem[];
  isOpen: boolean;
  appliedCoupon: {
    code: string;
    discountAmount: number;
    type: string;
  } | null;

  // Actions
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (item: Omit<CartStoreItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (productId: string, size: string, color: string) => void;
  updateQuantity: (productId: string, size: string, color: string, quantity: number) => void;
  applyCoupon: (coupon: { code: string; discountAmount: number; type: string }) => void;
  removeCoupon: () => void;
  clearCart: () => void;

  // Computed
  getTotalItems: () => number;
  getSubtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      appliedCoupon: null,

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

      addItem: (item) => {
        const currentItems = get().items;
        const qtyToAdd = item.quantity || 1;
        const existingIndex = currentItems.findIndex(
          (i) => i.productId === item.productId && i.size === item.size && i.color === item.color
        );

        if (existingIndex > -1) {
          const updated = [...currentItems];
          updated[existingIndex].quantity += qtyToAdd;
          set({ items: updated, isOpen: true });
        } else {
          set({
            items: [...currentItems, { ...item, quantity: qtyToAdd }],
            isOpen: true,
          });
        }
      },

      removeItem: (productId, size, color) => {
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.productId === productId && i.size === size && i.color === color)
          ),
        }));
      },

      updateQuantity: (productId, size, color, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId, size, color);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId && i.size === size && i.color === color
              ? { ...i, quantity }
              : i
          ),
        }));
      },

      applyCoupon: (coupon) => set({ appliedCoupon: coupon }),
      removeCoupon: () => set({ appliedCoupon: null }),
      clearCart: () => set({ items: [], appliedCoupon: null }),

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getSubtotal: () => {
        return get().items.reduce((total, item) => total + item.price * item.quantity, 0);
      },
    }),
    {
      name: 'ox_cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items, appliedCoupon: state.appliedCoupon }),
    }
  )
);
