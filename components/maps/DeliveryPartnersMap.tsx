'use client';

/**
 * @file components/maps/DeliveryPartnersMap.tsx
 * @description SSR-safe wrapper for OpenStreetMap Delivery Partner Fleet Live Radar.
 * Strict TypeScript: ZERO `any`.
 */

import React from 'react';
import dynamic from 'next/dynamic';
import type { IDeliveryPartner } from '@/types';

interface DeliveryPartnersMapProps {
  partners: IDeliveryPartner[];
  selectedCity?: string;
  onSelectPartner?: (partner: IDeliveryPartner) => void;
}

const DeliveryPartnersMapComponent = dynamic(
  () => import('./DeliveryPartnersMapInner'),
  {
    ssr: false,
    loading: () => (
      <div className="h-96 w-full rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col items-center justify-center text-xs text-neutral-400 font-semibold space-y-2 animate-pulse">
        <div className="h-7 w-7 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
        <span>Loading Fleet Live GPS Map...</span>
      </div>
    ),
  }
);

export function DeliveryPartnersMap(props: DeliveryPartnersMapProps) {
  return <DeliveryPartnersMapComponent {...props} />;
}

export default DeliveryPartnersMap;
