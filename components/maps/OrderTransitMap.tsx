'use client';

/**
 * @file components/maps/OrderTransitMap.tsx
 * @description SSR-safe OpenStreetMap shipment route & courier tracking visualizer.
 * 100% free with no API keys or billing required.
 */

import React from 'react';
import dynamic from 'next/dynamic';

interface OrderTransitMapProps {
  destinationCity: string;
  orderNumber: string;
  courierName?: string;
  trackingNumber?: string;
}

const OrderTransitMapComponent = dynamic(
  () => import('./OrderTransitMapInner'),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 sm:h-72 w-full rounded-xl bg-neutral-100 border border-neutral-200 flex flex-col items-center justify-center text-xs text-neutral-500 font-semibold space-y-2 animate-pulse">
        <div className="h-6 w-6 rounded-full border-2 border-neutral-400 border-t-neutral-900 animate-spin" />
        <span>Loading Transit Route Map...</span>
      </div>
    ),
  }
);

export function OrderTransitMap(props: OrderTransitMapProps) {
  return <OrderTransitMapComponent {...props} />;
}

export default OrderTransitMap;
