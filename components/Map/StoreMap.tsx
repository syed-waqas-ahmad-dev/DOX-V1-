'use client';

/**
 * @file components/Map/StoreMap.tsx
 * @description SSR-safe wrapper for Leaflet and OpenStreetMap.
 * Free, no-API-key, no-billing interactive map for store locations.
 */

import React from 'react';
import dynamic from 'next/dynamic';
import type { StoreMapProps, StoreMarker } from './StoreMapInner';

export type { StoreMapProps, StoreMarker };

const StoreMapComponent = dynamic(() => import('./StoreMapInner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] rounded-2xl bg-neutral-100 border border-neutral-300 flex flex-col items-center justify-center text-neutral-500 text-xs font-semibold space-y-2 animate-pulse">
      <div className="h-6 w-6 rounded-full border-2 border-neutral-400 border-t-neutral-900 animate-spin" />
      <span>Loading OpenStreetMap...</span>
    </div>
  ),
});

export function StoreMap(props: StoreMapProps) {
  return <StoreMapComponent {...props} />;
}

export default StoreMap;
