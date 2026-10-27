'use client';

/**
 * @file components/Map/StoreMapInner.tsx
 * @description Leaflet and OpenStreetMap rendering component with custom markers,
 * popup information, and dynamic viewport controls.
 */

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface StoreMarker {
  id?: string;
  position: [number, number];
  title: string;
  address?: string;
  phone?: string;
  hours?: string;
}

export interface StoreMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: StoreMarker[];
  className?: string;
  height?: string;
  scrollWheelZoom?: boolean;
}

// Leaflet default marker icon fix for Next.js
const defaultMarkerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Viewport recentering controller
function MapViewController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function StoreMapInner({
  center = [33.6844, 73.0479], // Default: Rawalpindi / Islamabad, Pakistan
  zoom = 13,
  markers = [],
  className = '',
  height = '400px',
  scrollWheelZoom = false,
}: StoreMapProps) {
  // If no markers provided, default to a store marker at center
  const displayMarkers: StoreMarker[] =
    markers.length > 0
      ? markers
      : [
          {
            id: 'default-store',
            position: center,
            title: 'OX Shoes Flagship Boutique',
            address: 'Rawalpindi / Islamabad Atelier, Pakistan',
            phone: '+92 51 2651122',
            hours: 'Mon - Sun: 11:00 AM - 10:30 PM',
          },
        ];

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-neutral-300 shadow-md ${className}`}
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={scrollWheelZoom}
        style={{ width: '100%', height: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapViewController center={center} zoom={zoom} />

        {displayMarkers.map((marker, idx) => (
          <Marker
            key={marker.id || idx}
            position={marker.position}
            icon={defaultMarkerIcon}
          >
            <Popup>
              <div className="p-1 min-w-[200px] text-neutral-900 font-sans">
                <h4 className="font-bold text-sm text-neutral-950 mb-1">
                  {marker.title}
                </h4>
                {marker.address && (
                  <p className="text-xs text-neutral-600 mb-1 leading-snug">
                    {marker.address}
                  </p>
                )}
                {marker.phone && (
                  <p className="text-[11px] font-medium text-neutral-800 mb-0.5">
                    <strong>Phone:</strong> {marker.phone}
                  </p>
                )}
                {marker.hours && (
                  <p className="text-[11px] text-neutral-500">
                    <strong>Hours:</strong> {marker.hours}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
