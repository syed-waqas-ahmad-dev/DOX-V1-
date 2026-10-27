'use client';

/**
 * @file app/admin/fleet/FleetMapClient.tsx
 * @description Dynamic client wrapper for Leaflet MapComponent with ssr: false.
 */

import dynamic from 'next/dynamic';
import type { MapComponentProps } from '@/components/Map';

export const MapComponent = dynamic<MapComponentProps>(
  () => import('@/components/Map'),
  {
    ssr: false,
    loading: () => (
      <div
        style={{ height: '400px', width: '100%' }}
        className="rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col items-center justify-center text-xs text-neutral-400 font-semibold space-y-2 animate-pulse"
      >
        <div className="h-7 w-7 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
        <span>Loading Live Fleet GPS Map...</span>
      </div>
    ),
  }
);

export default MapComponent;
