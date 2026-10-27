/**
 * @file lib/store/locale.ts
 * @description Persistent locale store managing English / Urdu toggle and RTL layout shifts.
 * Strict TypeScript: ZERO `any`.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useHydrated } from '@/lib/hooks/useHydrated';

export type Locale = 'en' | 'ur';

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  isUrdu: boolean;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set, get) => ({
      locale: 'en',
      isUrdu: false,

      setLocale: (locale) => {
        set({ locale, isUrdu: locale === 'ur' });
        if (typeof document !== 'undefined') {
          document.documentElement.dir = locale === 'ur' ? 'rtl' : 'ltr';
          document.documentElement.lang = locale;
        }
      },

      toggleLocale: () => {
        const next = get().locale === 'en' ? 'ur' : 'en';
        get().setLocale(next);
      },
    }),
    {
      name: 'ox-locale-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

/**
 * Hydration-safe locale hook that returns fallback 'en' / isUrdu: false during SSR
 * and initial client hydration, eliminating hydration mismatches.
 */
export function useLocale() {
  const isHydrated = useHydrated();
  const store = useLocaleStore();

  return {
    ...store,
    locale: isHydrated ? store.locale : 'en',
    isUrdu: isHydrated ? store.isUrdu : false,
    isHydrated,
  };
}

