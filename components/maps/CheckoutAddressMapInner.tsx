'use client';

/**
 * @file components/maps/CheckoutAddressMapInner.tsx
 * @description Interactive OpenStreetMap address picker for checkout.
 * Allows customers in Pakistan to confirm their precise delivery location
 * by clicking anywhere on the map. 100% free with zero API keys.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Crosshair, Check, AlertTriangle } from 'lucide-react';
import { resolveCityCoordinates, isValidCoordinatePair } from '@/lib/cities';
import type { IDeliveryCoordinates } from '@/types';

interface CheckoutAddressMapProps {
  selectedCity: string;
  villageAddress?: string;
  streetAddress: string;
  postalCode?: string;
  confirmedLocation?: IDeliveryCoordinates | null;
  onLocationConfirmed?: (coords: IDeliveryCoordinates | null) => void;
}

const PAKISTAN_OVERVIEW_CENTER: [number, number] = [30.3753, 69.3451];

const deliveryIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function MapController({
  centerLat,
  centerLng,
  zoom,
  onMapClick,
}: {
  centerLat: number;
  centerLng: number;
  zoom: number;
  onMapClick: (latlng: [number, number]) => void;
}) {
  const map = useMap();

  useEffect(() => {
    map.setView([centerLat, centerLng], zoom);
  }, [centerLat, centerLng, zoom, map]);

  useMapEvents({
    click(e) {
      onMapClick([e.latlng.lat, e.latlng.lng]);
    },
  });

  return null;
}

export default function CheckoutAddressMapInner({
  selectedCity,
  villageAddress,
  streetAddress,
  postalCode,
  confirmedLocation,
  onLocationConfirmed,
}: CheckoutAddressMapProps) {
  const [prevCity, setPrevCity] = useState(selectedCity);
  const [localPin, setLocalPin] = useState<[number, number] | null>(null);

  if (prevCity !== selectedCity) {
    setPrevCity(selectedCity);
    if (localPin !== null) {
      setLocalPin(null);
    }
  }

  const controlledPin: [number, number] | null =
    confirmedLocation && isValidCoordinatePair(confirmedLocation.lat, confirmedLocation.lng)
      ? [confirmedLocation.lat, confirmedLocation.lng]
      : null;

  const activeManualPin: [number, number] | null =
    confirmedLocation !== undefined ? controlledPin : localPin;

  const cityCoord = useMemo(
    () => resolveCityCoordinates(selectedCity),
    [selectedCity]
  );

  const isExactManualPin = activeManualPin !== null;
  const pinPosition: [number, number] | null = activeManualPin || cityCoord;

  // Keep viewport centered on the manual pin if placed, otherwise city centroid or Pakistan overview
  const mapCenter: [number, number] = pinPosition || PAKISTAN_OVERVIEW_CENTER;
  const mapZoom = pinPosition ? 13 : 5;

  const handleMapClick = (latlng: [number, number]) => {
    setLocalPin(latlng);
    if (onLocationConfirmed) {
      onLocationConfirmed({
        lat: latlng[0],
        lng: latlng[1],
        source: 'manual_pin',
      });
    }
  };

  const formattedDestination = [
    streetAddress?.trim(),
    villageAddress?.trim(),
    selectedCity?.trim(),
    postalCode?.trim(),
    'Pakistan',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="rounded-2xl border border-neutral-200 overflow-hidden bg-white shadow-sm space-y-3 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
        <div>
          <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
            <Navigation className="h-3 w-3" />
            Delivery Pin Verification (OpenStreetMap)
          </span>
          <h4 className="text-xs font-bold text-neutral-900 mt-0.5">
            {selectedCity
              ? `Pinpoint Delivery Location in ${selectedCity}`
              : 'Select Your City or Drop Delivery Pin'}
          </h4>
        </div>
        <span className="text-[11px] text-neutral-500 flex items-center gap-1 font-medium bg-neutral-50 px-2.5 py-1 rounded-full border border-neutral-200">
          <Crosshair className="h-3 w-3 text-neutral-400" />
          Click anywhere on map to set pin
        </span>
      </div>

      <div className="h-56 sm:h-64 w-full rounded-xl overflow-hidden relative border border-neutral-200 z-0">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          scrollWheelZoom={false}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapController
            centerLat={mapCenter[0]}
            centerLng={mapCenter[1]}
            zoom={mapZoom}
            onMapClick={handleMapClick}
          />

          {pinPosition && (
            <Marker position={pinPosition} icon={deliveryIcon}>
              <Popup>
                <div className="p-1 text-xs font-sans">
                  <strong className="block text-neutral-950 font-bold">
                    {isExactManualPin
                      ? 'Selected Delivery Pin'
                      : `Approximate ${selectedCity} Center`}
                  </strong>
                  <span className="text-neutral-600">
                    {formattedDestination || selectedCity}
                  </span>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Delivery coordinates pill */}
        <div className="absolute top-2 left-2 z-[1000] bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-lg border border-neutral-200 shadow-sm text-[10px] font-mono font-bold text-neutral-700 flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${
              isExactManualPin
                ? 'bg-emerald-500 animate-pulse'
                : pinPosition
                ? 'bg-amber-500'
                : 'bg-neutral-400'
            }`}
          />
          {pinPosition
            ? `${isExactManualPin ? 'Pin' : 'Approx City Center'}: ${pinPosition[0].toFixed(4)}, ${pinPosition[1].toFixed(4)}`
            : 'Location unresolved — click map to drop pin'}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs">
        <p className="text-[11px] text-neutral-600 truncate max-w-sm" title={formattedDestination}>
          <strong className="text-neutral-900">Destination:</strong>{' '}
          {formattedDestination}
        </p>
        {isExactManualPin ? (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full shrink-0">
            <Check className="h-3 w-3" />
            <span>Exact Delivery Pin Confirmed</span>
          </div>
        ) : pinPosition ? (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full shrink-0">
            <AlertTriangle className="h-3 w-3" />
            <span>Approximate City Center (Click Map to Pin Exact Location)</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-700 bg-neutral-100 border border-neutral-300 px-3 py-1 rounded-full shrink-0">
            <AlertTriangle className="h-3 w-3" />
            <span>City Coordinates Unresolved — Optional Map Pin</span>
          </div>
        )}
      </div>
    </div>
  );
}
