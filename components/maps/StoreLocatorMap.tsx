'use client';

/**
 * @file components/maps/StoreLocatorMap.tsx
 * @description Interactive OpenStreetMap store locator for OX Shoes Pakistan flagship boutiques.
 * 100% free, no-API-key, no-billing solution powered by Leaflet and OpenStreetMap.
 */

import React, { useState } from 'react';
import { StoreMap, type StoreMarker } from '@/components/Map/StoreMap';
import { MapPin, Phone, Clock, Navigation, CheckCircle2, Store } from 'lucide-react';

export interface StoreLocation {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  hours: string;
  features: string[];
  position: [number, number];
}

export const OX_STORES: StoreLocation[] = [
  {
    id: 'store-bjr',
    name: 'Bajaur OX Shoes Physical Shop',
    city: 'Bajaur',
    address: 'Inayat Killi Bazar, Bypass Road, near Inam Plaza, District Bajaur',
    phone: '+92 300 0914546',
    hours: 'Official Retail Store & Workshop',
    features: ['Handcrafted Peshawari Chappal Atelier', 'Custom Fitting', 'WhatsApp Concierge & Support'],
    position: [34.7544498, 71.4530333],
  },
];

export function StoreLocatorMap() {
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [activeStore, setActiveStore] = useState<StoreLocation>(OX_STORES[0]);

  const filteredStores =
    selectedCity === 'All'
      ? OX_STORES
      : OX_STORES.filter((s) => s.city.toLowerCase() === selectedCity.toLowerCase());

  const cities = ['All', 'Bajaur'];

  const markers: StoreMarker[] = filteredStores.map((store) => ({
    id: store.id,
    position: store.position,
    title: store.name,
    address: store.address,
    phone: store.phone,
    hours: store.hours,
  }));

  const handleSelectStore = (store: StoreLocation) => {
    setActiveStore(store);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Side: Store Listing & City Filter */}
      <div className="lg:col-span-5 space-y-4">
        {/* City Filter Pills */}
        <div className="flex flex-wrap gap-1.5 p-1.5 bg-neutral-100 rounded-xl border border-neutral-200">
          {cities.map((city) => (
            <button
              key={city}
              onClick={() => {
                setSelectedCity(city);
                const firstInCity =
                  city === 'All'
                    ? OX_STORES[0]
                    : OX_STORES.find((s) => s.city.toLowerCase() === city.toLowerCase());
                if (firstInCity) setActiveStore(firstInCity);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedCity === city
                  ? 'bg-neutral-950 text-white shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-200/60'
              }`}
            >
              {city}
            </button>
          ))}
        </div>

        {/* Store Cards List */}
        <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
          {filteredStores.map((store) => {
            const isSelected = activeStore.id === store.id;
            return (
              <div
                key={store.id}
                onClick={() => handleSelectStore(store)}
                className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                  isSelected
                    ? 'border-neutral-950 bg-white shadow-md ring-2 ring-neutral-950/10'
                    : 'border-neutral-200 bg-white/70 hover:bg-white hover:border-neutral-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h3 className="font-bold text-sm text-neutral-950 flex items-center gap-1.5">
                    <Store className="h-4 w-4 text-amber-600 shrink-0" />
                    {store.name}
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 shrink-0">
                    {store.city}
                  </span>
                </div>

                <p className="text-xs text-neutral-600 flex items-start gap-1.5 mb-2">
                  <MapPin className="h-3.5 w-3.5 text-neutral-400 shrink-0 mt-0.5" />
                  <span>{store.address}</span>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-neutral-500 mb-3">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3 text-neutral-400" />
                    {store.phone}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-neutral-400" />
                    {store.hours}
                  </span>
                </div>

                {/* Highlights */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {store.features.map((feat, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded font-medium flex items-center gap-1"
                    >
                      <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                      {feat}
                    </span>
                  ))}
                </div>

                {/* Coordinates & Navigation Link */}
                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                  <span className="text-[11px] text-neutral-400 font-mono">
                    {store.position[0].toFixed(4)}, {store.position[1].toFixed(4)}
                  </span>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${store.position[0]}&mlon=${store.position[1]}#map=16/${store.position[0]}/${store.position[1]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700 underline"
                  >
                    <Navigation className="h-3 w-3" />
                    View on OpenStreetMap
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Side: OpenStreetMap Display */}
      <div className="lg:col-span-7 space-y-2">
        <StoreMap
          center={activeStore.position}
          zoom={14}
          markers={markers}
          height="540px"
          scrollWheelZoom={true}
        />
        <div className="bg-white/90 border border-neutral-200 px-3.5 py-2 rounded-xl shadow-sm text-xs font-semibold text-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-amber-600" />
            <span>Official Physical Shop in Bajaur (OpenStreetMap)</span>
          </div>
          <span className="text-[10px] text-neutral-500 font-mono">100% Free & Open-Source</span>
        </div>
      </div>
    </div>
  );
}
