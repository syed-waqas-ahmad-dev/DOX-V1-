'use client';

/**
 * @file components/Map.tsx
 * @description Universal Leaflet & OpenStreetMap component for OX Shoes Pakistan.
 * Accepts markers with position [lat, lng] and popupContent.
 * Strict TypeScript: ZERO `any`.
 */

import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapMarker {
  position: [number, number];
  popupContent: string;
}

export interface MapComponentProps {
  markers?: MapMarker[];
  center?: [number, number];
  zoom?: number;
  style?: React.CSSProperties;
  className?: string;
}

const defaultMarkerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function MapComponent({
  markers = [],
  center,
  zoom = 7,
  style = { height: '400px', width: '100%' },
  className = '',
}: MapComponentProps) {
  const mapCenter: [number, number] = useMemo(() => {
    if (center) return center;
    if (markers.length > 0 && markers[0]?.position) {
      return markers[0].position;
    }
    return [34.0151, 71.5249]; // Peshawar default
  }, [center, markers]);

  return (
    <div
      style={style}
      className={`relative z-0 isolate overflow-hidden rounded-2xl border border-neutral-800 shadow-xl bg-neutral-950 ${className}`}
    >
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        scrollWheelZoom={false}
        className="z-0"
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          minZoom={5}
        />
        {markers.map((marker, idx) => (
          <Marker key={idx} position={marker.position} icon={defaultMarkerIcon}>
            <Popup>
              <div className="p-1 text-xs font-semibold text-neutral-900 leading-snug">
                {marker.popupContent}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
