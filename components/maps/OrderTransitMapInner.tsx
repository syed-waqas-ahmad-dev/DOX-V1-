'use client';

/**
 * @file components/maps/OrderTransitMapInner.tsx
 * @description OpenStreetMap shipment route & courier tracking visualizer using Leaflet.
 * Shows fulfillment transit from OX Shoes Lahore Atelier to
 * customer delivery city in Pakistan with route polyline and waypoint markers.
 * 100% free with zero API keys or billing required.
 */

import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Truck, MapPin, PackageCheck, AlertTriangle } from 'lucide-react';
import { STORE_ADDRESS } from '@/lib/constants';
import { resolveCityCoordinates, isValidCoordinatePair } from '@/lib/cities';
import type { IDeliveryCoordinates } from '@/types';

interface OrderTransitMapProps {
  destinationCity?: string;
  destinationCoordinates?: IDeliveryCoordinates | null;
  orderNumber: string;
  courierName?: string;
  trackingNumber?: string;
}

const BAJAUR_ORIGIN: [number, number] = [STORE_ADDRESS.latitude, STORE_ADDRESS.longitude];

const transitIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function OrderTransitMapInner({
  destinationCity,
  destinationCoordinates,
  orderNumber,
  courierName = 'TCS Express',
  trackingNumber,
}: OrderTransitMapProps) {
  const hasSavedCoords = Boolean(
    destinationCoordinates &&
      isValidCoordinatePair(destinationCoordinates.lat, destinationCoordinates.lng)
  );

  const savedDestCoords: [number, number] | null = hasSavedCoords && destinationCoordinates
    ? [destinationCoordinates.lat, destinationCoordinates.lng]
    : null;

  const cityCentroidCoords: [number, number] | null =
    savedDestCoords === null ? resolveCityCoordinates(destinationCity) : null;

  const destCoords: [number, number] | null = savedDestCoords || cityCentroidCoords;
  const isApproximateDest = !savedDestCoords && cityCentroidCoords !== null;

  const mapCenter: [number, number] = destCoords
    ? [(BAJAUR_ORIGIN[0] + destCoords[0]) / 2, (BAJAUR_ORIGIN[1] + destCoords[1]) / 2]
    : BAJAUR_ORIGIN;

  const mapZoom = destCoords ? 6 : 11;
  const routePolyline: [number, number][] | null = destCoords
    ? [BAJAUR_ORIGIN, destCoords]
    : null;

  const displayCity = destinationCity?.trim() || 'Destination Unspecified';

  return (
    <div className="rounded-2xl border border-neutral-200 overflow-hidden bg-white shadow-sm space-y-3 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
        <div>
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5" />
            Dispatch Origin & Destination Map (OpenStreetMap)
          </span>
          <h3 className="text-sm font-bold text-neutral-950 mt-0.5">
            Dispatch Journey: Bajaur Shop → {displayCity}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-neutral-700 bg-neutral-100 px-3 py-1 rounded-full border border-neutral-200">
            {courierName}: {trackingNumber || 'Pending Consignment'}
          </span>
        </div>
      </div>

      {/* Map Container */}
      <div className="h-64 sm:h-72 w-full rounded-xl overflow-hidden relative border border-neutral-200 bg-neutral-100 z-0">
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

          {routePolyline && (
            <Polyline
              positions={routePolyline}
              pathOptions={{ color: '#d97706', weight: 4, dashArray: '8, 8', opacity: 0.85 }}
            />
          )}

          {/* Bajaur Dispatch Origin */}
          <Marker position={BAJAUR_ORIGIN} icon={transitIcon}>
            <Popup>
              <div className="p-1 text-xs">
                <strong className="block text-neutral-950 font-bold">{STORE_ADDRESS.name}</strong>
                <span className="text-neutral-600">
                  {STORE_ADDRESS.street}, {STORE_ADDRESS.district} (Dispatch Origin)
                </span>
              </div>
            </Popup>
          </Marker>

          {/* Customer Destination */}
          {destCoords && (
            <Marker position={destCoords} icon={transitIcon}>
              <Popup>
                <div className="p-1 text-xs">
                  <strong className="block text-neutral-950 font-bold">
                    {hasSavedCoords
                      ? `Delivery Destination (${displayCity})`
                      : `Approximate Destination Center (${displayCity})`}
                  </strong>
                  <span className="text-neutral-600">Order {orderNumber}</span>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Overlay Status Pill */}
        <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-neutral-200 shadow-md flex items-center gap-2 text-xs font-bold text-neutral-900">
          {destCoords ? (
            <>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  hasSavedCoords ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span>
                {hasSavedCoords
                  ? `Saved Customer Pin (${destCoords[0].toFixed(4)}, ${destCoords[1].toFixed(4)})`
                  : `Approximate City Center: ${displayCity}`}
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              <span>Destination coordinates unresolved for {displayCity}</span>
            </>
          )}
        </div>
      </div>

      {/* Milestone Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
        <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1">
          <span className="text-[10px] uppercase font-bold text-neutral-500 block">Origin Hub</span>
          <div className="font-bold text-neutral-900 flex items-center gap-1.5">
            <PackageCheck className="h-3.5 w-3.5 text-emerald-600" />
            Bajaur OX Shoes Shop
          </div>
          <span className="text-[11px] text-neutral-500">
            Inayat Killi Bazar, District Bajaur
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-1">
          <span className="text-[10px] uppercase font-bold text-amber-700 block">Courier Assignment</span>
          <div className="font-bold text-amber-900 flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5 text-amber-600" />
            {courierName}
          </div>
          <span className="text-[11px] text-amber-700">
            {trackingNumber ? `Consignment #${trackingNumber}` : 'Consignment assigned at dispatch'}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1">
          <span className="text-[10px] uppercase font-bold text-neutral-500 block">Delivery Destination</span>
          <div className="font-bold text-neutral-900 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-emerald-600" />
            {displayCity}, Pakistan
          </div>
          <span className="text-[11px] text-neutral-500">
            {hasSavedCoords
              ? 'Customer-pinned destination coordinates'
              : isApproximateDest
              ? 'Approximate city/district centroid'
              : 'Destination coordinates unavailable'}
          </span>
        </div>
      </div>
    </div>
  );
}
