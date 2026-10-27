import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/**
 * Hook to safely detect client-side hydration without triggering hydration mismatch errors.
 * Server snapshot: false
 * Client snapshot: true
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
