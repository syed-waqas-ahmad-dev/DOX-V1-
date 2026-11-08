'use client';

/**
 * @file components/maps/DeliveryPartnersMapInner.tsx
 * @description Leaflet + OpenStreetMap Live Fleet Radar for Admin.
 * Displays all active delivery partner locations with green status dots, bike badges, and COD summaries.
 * 100% Free - Zero Google Maps API keys or billing.
 * Strict TypeScript: ZERO `any`.
 */

import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Phone, Bike, ShieldCheck, MapPin, Wallet, PackageCheck } from 'lucide-react';
import { formatPKR } from '@/lib/formatters/currency';
import type { IDeliveryPartner } from '@/types';

interface DeliveryPartnersMapInnerProps {
  partners: IDeliveryPartner[];
  selectedCity?: string;
  onSelectPartner?: (partner: IDeliveryPartner) => void;
}

const CITY_COORDINATES: Record<string, [number, number]> = {
  Peshawar: [34.0151, 71.5249],
  Lahore: [31.5204, 74.3587],
  Islamabad: [33.6844, 73.0479],
  Rawalpindi: [33.5651, 73.0169],
  Karachi: [24.8607, 67.0011],
  Faisalabad: [31.4504, 73.135],
  Multan: [30.1575, 71.5249],
  Sialkot: [32.4945, 74.5229],
  Gujranwala: [32.1877, 74.1945],
  Quetta: [30.1798, 66.975],
};

function getGpsFreshnessInfo(partner: IDeliveryPartner): {
  isFallback: boolean;
  label: string;
  badgeClass: string;
  dotHtml: string;
} {
  const hasCoords = typeof partner.currentLat === 'number' && typeof partner.currentLng === 'number';
  if (!hasCoords) {
    return {
      isFallback: true,
      label: `Approx ${partner.city || 'City'} Location (No GPS)`,
      badgeClass: 'bg-neutral-200 text-neutral-800 border-neutral-300',
      dotHtml: '<div style="background-color: #6b7280; width: 12px; height: 12px; border-radius: 9999px; border: 2px solid #ffffff;"></div>',
    };
  }

  if (!partner.lastLocationUpdate) {
    return {
      isFallback: false,
      label: 'GPS Synced (Unknown Time)',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      dotHtml: '<div style="background-color: #f59e0b; width: 12px; height: 12px; border-radius: 9999px; border: 2px solid #ffffff;"></div>',
    };
  }

  const lastUpdateMs = new Date(partner.lastLocationUpdate).getTime();
  if (!Number.isFinite(lastUpdateMs)) {
    return {
      isFallback: false,
      label: 'GPS Time Unavailable',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      dotHtml: '<div style="background-color: #f59e0b; width: 12px; height: 12px; border-radius: 9999px; border: 2px solid #ffffff;"></div>',
    };
  }

  const nowMs = Date.now();
  const ageMs = Math.max(0, nowMs - lastUpdateMs);
  const ageMins = Math.floor(ageMs / 60000);

  if (ageMins < 5) {
    return {
      isFallback: false,
      label: `Fresh GPS (${ageMins === 0 ? 'Just now' : `${ageMins}m ago`})`,
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      dotHtml: '<div style="background-color: #10b981; width: 14px; height: 14px; border-radius: 9999px; border: 2.5px solid #ffffff; box-shadow: 0 0 10px rgba(16, 185, 129, 0.9); animation: pulse 1.5s infinite;"></div>',
    };
  } else if (ageMins <= 15) {
    return {
      isFallback: false,
      label: `Stale GPS (${ageMins}m ago)`,
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      dotHtml: '<div style="background-color: #f59e0b; width: 12px; height: 12px; border-radius: 9999px; border: 2px solid #ffffff;"></div>',
    };
  } else {
    const hours = Math.floor(ageMins / 60);
    return {
      isFallback: false,
      label: `Old GPS (${hours > 0 ? `${hours}h ago` : `${ageMins}m ago`})`,
      badgeClass: 'bg-neutral-200 text-neutral-800 border-neutral-300',
      dotHtml: '<div style="background-color: #6b7280; width: 12px; height: 12px; border-radius: 9999px; border: 2px solid #ffffff;"></div>',
    };
  }
}

function createRiderIcon(name: string, dotHtml: string) {
  return L.divIcon({
    className: 'custom-rider-marker',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        ${dotHtml}
        <div style="margin-top: 3px; background-color: #000000; color: #fbbf24; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 6px; white-space: nowrap; border: 1px solid #374151; box-shadow: 0 2px 6px rgba(0,0,0,0.4);">
          🛵 ${name.split(' ')[0]}
        </div>
      </div>
    `,
    iconSize: [60, 40],
    iconAnchor: [30, 7],
  });
}

export default function DeliveryPartnersMapInner({
  partners,
  selectedCity,
  onSelectPartner,
}: DeliveryPartnersMapInnerProps) {
  const centerCoord = useMemo<[number, number]>(() => {
    if (selectedCity && CITY_COORDINATES[selectedCity]) {
      return CITY_COORDINATES[selectedCity];
    }
    // Default to Peshawar or Lahore
    return [32.5, 72.8];
  }, [selectedCity]);

  const zoomLevel = selectedCity && selectedCity !== 'all' ? 12 : 6;

  return (
    <div className="relative w-full h-[460px] rounded-2xl overflow-hidden border border-neutral-800 shadow-xl bg-neutral-950">
      <MapContainer
        center={centerCoord}
        zoom={zoomLevel}
        scrollWheelZoom={false}
        className="w-full h-full z-10"
        style={{ minHeight: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {partners.map((partner) => {
          const lat = partner.currentLat || CITY_COORDINATES[partner.city]?.[0] || 34.0151;
          const lng = partner.currentLng || CITY_COORDINATES[partner.city]?.[1] || 71.5249;
          const freshness = getGpsFreshnessInfo(partner);
          const icon = createRiderIcon(partner.name, freshness.dotHtml);

          return (
            <Marker key={partner._id.toString()} position={[lat, lng]} icon={icon}>
              <Popup className="custom-rider-popup">
                <div className="p-2 space-y-2 text-xs min-w-[220px] text-neutral-900 font-sans">
                  <div className="flex items-center justify-between border-b pb-1.5 gap-2">
                    <span className="font-bold text-sm text-neutral-950 flex items-center gap-1">
                      🛵 {partner.name}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${freshness.badgeClass}`}>
                      {freshness.label}
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px] text-neutral-600">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Bike No:</span>
                      <span className="font-mono font-bold text-neutral-900">{partner.bikeNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Operating City:</span>
                      <span className="font-bold text-neutral-900">{partner.city}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Area:</span>
                      <span className="font-medium text-neutral-800">{partner.area}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Location Status:</span>
                      <span className="font-bold text-neutral-900">{freshness.isFallback ? 'Approx City Centroid' : 'Live Coordinates'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Total Deliveries:</span>
                      <span className="font-bold text-neutral-900">{partner.totalDeliveries}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1">
                      <span className="text-neutral-500 font-bold">COD in Hand:</span>
                      <span className="font-bold text-amber-700 font-mono">
                        {formatPKR(partner.codCollectedBalance || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <a
                      href={`tel:${partner.phone}`}
                      className="flex-1 py-1.5 px-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-center text-[10px] font-bold"
                    >
                      Call Rider
                    </a>
                    {onSelectPartner && (
                      <button
                        type="button"
                        onClick={() => onSelectPartner(partner)}
                        className="py-1.5 px-2 bg-amber-400 hover:bg-amber-300 text-black rounded-lg text-[10px] font-bold"
                      >
                        Manage
                      </button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Map Legend Overlay */}
      <div className="absolute top-3 right-3 z-20 bg-neutral-950/90 backdrop-blur-md border border-neutral-800 p-2.5 rounded-xl text-[11px] text-neutral-300 shadow-lg space-y-1.5 pointer-events-auto">
        <div className="text-[10px] uppercase font-bold tracking-wider text-amber-400 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Live Fleet Radar</span>
        </div>
        <div className="text-[10px] text-neutral-400 font-medium">
          {partners.length} Active Riders • OpenStreetMap
        </div>
      </div>
    </div>
  );
}
