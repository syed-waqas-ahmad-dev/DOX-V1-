/**
 * @file lib/store/cart.ts
 * @description Persistent Zustand store for client shopping cart, item counters,
 * coupon applications, and slide-over drawer visibility.
 * Strict TypeScript: ZERO `any`.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CreateOrderPayload } from '@/types';

export interface CartStoreItem {
  productId: string;
  variantId?: string;
  variantSku?: string;
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

/**
 * Builds the authoritative checkout order items payload from persisted cart items.
 * Preserves optional variantId and variantSku when present, supports legacy carts
 * lacking variant identifiers, and strips client price/stock/generic sku fields.
 */
export function buildCheckoutOrderItems(
  items: CartStoreItem[]
): CreateOrderPayload['items'] {
  return items.map((i) => {
    const cleanVariantId = i.variantId?.trim();
    const cleanVariantSku = i.variantSku?.trim();
    return {
      productId: i.productId,
      ...(cleanVariantId ? { variantId: cleanVariantId } : {}),
      ...(cleanVariantSku ? { variantSku: cleanVariantSku } : {}),
      size: i.size,
      color: i.color,
      quantity: i.quantity,
    };
  });
}

const normCartAttr = (val?: string) => (val || '').trim().toLowerCase();

function isSameCartLine(
  existing: CartStoreItem,
  target: { productId: string; size: string; color: string; variantId?: string }
): boolean {
  if (existing.productId !== target.productId) return false;
  if (existing.variantId && target.variantId) {
    return existing.variantId === target.variantId;
  }
  return (
    normCartAttr(existing.size) === normCartAttr(target.size) &&
    normCartAttr(existing.color) === normCartAttr(target.color)
  );
}

interface CartState {
  items: CartStoreItem[];
  isOpen: boolean;
  appliedCoupon: {
    code: string;
    discountAmount: number;
    value?: number;
    minOrderAmount?: number;
    maxDiscountAmount?: number | null;
    type: string;
  } | null;

  // Actions
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (item: Omit<CartStoreItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (productId: string, size: string, color: string, variantId?: string) => void;
  updateQuantity: (productId: string, size: string, color: string, quantity: number, variantId?: string) => void;
  applyCoupon: (coupon: {
    code: string;
    discountAmount: number;
    value?: number;
    minOrderAmount?: number;
    maxDiscountAmount?: number | null;
    type: string;
  }) => void;
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
        const existingIndex = currentItems.findIndex((i) =>
          isSameCartLine(i, {
            productId: item.productId,
            size: item.size,
            color: item.color,
            variantId: item.variantId,
          })
        );

        if (existingIndex > -1) {
          const updated = [...currentItems];
          const prev = updated[existingIndex];
          updated[existingIndex] = {
            ...prev,
            quantity: prev.quantity + qtyToAdd,
            variantId: item.variantId || prev.variantId,
            variantSku: item.variantSku || prev.variantSku,
            sku: item.variantSku || item.sku || prev.sku,
          };
          set({ items: updated, isOpen: true });
        } else {
          set({
            items: [...currentItems, { ...item, quantity: qtyToAdd }],
            isOpen: true,
          });
        }
      },

      removeItem: (productId, size, color, variantId) => {
        set((state) => ({
          items: state.items.filter(
            (i) => !isSameCartLine(i, { productId, size, color, variantId })
          ),
        }));
      },

      updateQuantity: (productId, size, color, quantity, variantId) => {
        if (quantity <= 0) {
          get().removeItem(productId, size, color, variantId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            isSameCartLine(i, { productId, size, color, variantId })
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
