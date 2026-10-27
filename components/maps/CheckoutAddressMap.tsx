'use client';

/**
 * @file components/maps/CheckoutAddressMap.tsx
 * @description SSR-safe OpenStreetMap address picker for checkout.
 * 100% free with no API keys or billing required.
 */

import React from 'react';
import dynamic from 'next/dynamic';

interface CheckoutAddressMapProps {
  selectedCity: string;
  streetAddress: string;
  onLocationConfirmed?: (coords: { lat: number; lng: number }) => void;
}

const CheckoutAddressMapComponent = dynamic(
  () => import('./CheckoutAddressMapInner'),
  {
    ssr: false,
    loading: () => (
      <div className="h-56 sm:h-64 w-full rounded-xl bg-neutral-100 border border-neutral-200 flex flex-col items-center justify-center text-xs text-neutral-500 font-semibold space-y-2 animate-pulse">
        <div className="h-6 w-6 rounded-full border-2 border-neutral-400 border-t-neutral-900 animate-spin" />
        <span>Loading Delivery Address Map...</span>
      </div>
    ),
  }
);

export function CheckoutAddressMap(props: CheckoutAddressMapProps) {
  return <CheckoutAddressMapComponent {...props} />;
}

export default CheckoutAddressMap;
