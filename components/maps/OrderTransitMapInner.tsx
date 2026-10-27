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
import { Truck, MapPin, Building, PackageCheck, Navigation } from 'lucide-react';

interface OrderTransitMapProps {
  destinationCity: string;
  orderNumber: string;
  courierName?: string;
  trackingNumber?: string;
}

const CITY_COORDINATES: Record<string, [number, number]> = {
  Lahore: [31.5204, 74.3587],
  Karachi: [24.8607, 67.0011],
  Islamabad: [33.6844, 73.0479],
  Rawalpindi: [33.5651, 73.0169],
  Peshawar: [34.0151, 71.5249],
  Quetta: [30.1798, 66.975],
  Multan: [30.1575, 71.5249],
  Faisalabad: [31.4504, 73.135],
  Sialkot: [32.4945, 74.5229],
  Gujranwala: [32.1877, 74.1945],
  Hyderabad: [25.396, 68.3578],
  Bahawalpur: [29.3544, 71.6911],
  Sargodha: [32.0836, 72.6711],
  Abbottabad: [34.1688, 73.2215],
  Sukkur: [27.7052, 68.8574],
  Mardan: [34.1989, 72.0404],
  Kasur: [31.1179, 74.4461],
  Sheikhupura: [31.7131, 73.9783],
  Gujrat: [32.5742, 74.0754],
  Sahiwal: [30.6682, 73.1114],
};

const LAHORE_ORIGIN: [number, number] = [31.5126, 74.3541]; // OX Shoes MM Alam Hub

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
  orderNumber,
  courierName = 'TCS Express',
  trackingNumber,
}: OrderTransitMapProps) {
  const destCoords: [number, number] =
    CITY_COORDINATES[destinationCity] ||
    CITY_COORDINATES['Lahore'] || [31.5204, 74.3587];

  const centerLat = (LAHORE_ORIGIN[0] + destCoords[0]) / 2;
  const centerLng = (LAHORE_ORIGIN[1] + destCoords[1]) / 2;
  const mapCenter: [number, number] = [centerLat, centerLng];

  const waypoint: [number, number] = [
    LAHORE_ORIGIN[0] * 0.45 + destCoords[0] * 0.55,
    LAHORE_ORIGIN[1] * 0.45 + destCoords[1] * 0.55,
  ];

  const routePolyline: [number, number][] = [LAHORE_ORIGIN, waypoint, destCoords];

  return (
    <div className="rounded-2xl border border-neutral-200 overflow-hidden bg-white shadow-sm space-y-3 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
        <div>
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5" />
            Live Courier Transit Route (OpenStreetMap)
          </span>
          <h3 className="text-sm font-bold text-neutral-950 mt-0.5">
            Dispatch Journey: Lahore Artisan Atelier → {destinationCity}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-neutral-700 bg-neutral-100 px-3 py-1 rounded-full border border-neutral-200">
            {courierName}: {trackingNumber || 'TCS-89218204'}
          </span>
        </div>
      </div>

      {/* Map Container */}
      <div className="h-64 sm:h-72 w-full rounded-xl overflow-hidden relative border border-neutral-200 bg-neutral-100 z-0">
        <MapContainer
          center={mapCenter}
          zoom={6}
          scrollWheelZoom={false}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <Polyline
            positions={routePolyline}
            pathOptions={{ color: '#d97706', weight: 4, dashArray: '8, 8', opacity: 0.85 }}
          />

          {/* Lahore Origin */}
          <Marker position={LAHORE_ORIGIN} icon={transitIcon}>
            <Popup>
              <div className="p-1 text-xs">
                <strong className="block text-neutral-950 font-bold">OX Shoes Atelier (Lahore)</strong>
                <span className="text-neutral-600">Origin Fulfillment Center</span>
              </div>
            </Popup>
          </Marker>

          {/* Waypoint Sorting Facility */}
          <Marker position={waypoint} icon={transitIcon}>
            <Popup>
              <div className="p-1 text-xs">
                <strong className="block text-neutral-950 font-bold">{courierName} Sorting Hub</strong>
                <span className="text-neutral-600">In Transit — Parcel Scanned</span>
              </div>
            </Popup>
          </Marker>

          {/* Destination */}
          <Marker position={destCoords} icon={transitIcon}>
            <Popup>
              <div className="p-1 text-xs">
                <strong className="block text-neutral-950 font-bold">Delivery Hub: {destinationCity}</strong>
                <span className="text-neutral-600">Expected in 2-3 Working Days</span>
              </div>
            </Popup>
          </Marker>
        </MapContainer>

        {/* Overlay Status Pill */}
        <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-neutral-200 shadow-md flex items-center gap-2 text-xs font-bold text-neutral-900">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span>In Transit: Expected in 2-3 Working Days</span>
        </div>
      </div>

      {/* Milestone Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
        <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1">
          <span className="text-[10px] uppercase font-bold text-neutral-500 block">Origin Hub</span>
          <div className="font-bold text-neutral-900 flex items-center gap-1.5">
            <PackageCheck className="h-3.5 w-3.5 text-emerald-600" />
            Lahore Central Atelier
          </div>
          <span className="text-[11px] text-neutral-500">Handcrafted & Quality Inspected</span>
        </div>

        <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-1">
          <span className="text-[10px] uppercase font-bold text-amber-700 block">Current Status</span>
          <div className="font-bold text-amber-900 flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5 text-amber-600" />
            Dispatched with {courierName}
          </div>
          <span className="text-[11px] text-amber-700">En route to regional hub</span>
        </div>

        <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1">
          <span className="text-[10px] uppercase font-bold text-neutral-500 block">Delivery Destination</span>
          <div className="font-bold text-neutral-900 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-emerald-600" />
            {destinationCity}, Pakistan
          </div>
          <span className="text-[11px] text-neutral-500">Doorstep Handover & Receipt</span>
        </div>
      </div>
    </div>
  );
}
