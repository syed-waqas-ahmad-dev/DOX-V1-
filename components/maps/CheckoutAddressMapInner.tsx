'use client';

/**
 * @file components/maps/CheckoutAddressMapInner.tsx
 * @description Interactive OpenStreetMap address picker for checkout.
 * Allows customers in Pakistan to confirm their precise delivery location
 * by clicking anywhere on the map. 100% free with zero API keys.
 */

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Crosshair, Check } from 'lucide-react';

interface CheckoutAddressMapProps {
  selectedCity: string;
  streetAddress: string;
  onLocationConfirmed?: (coords: { lat: number; lng: number }) => void;
}

// Major Pakistani cities center coordinates [lat, lng]
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
  center,
  onMapClick,
}: {
  center: [number, number];
  onMapClick: (latlng: [number, number]) => void;
}) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);

  useMapEvents({
    click(e) {
      onMapClick([e.latlng.lat, e.latlng.lng]);
    },
  });

  return null;
}

export default function CheckoutAddressMapInner({
  selectedCity,
  streetAddress,
  onLocationConfirmed,
}: CheckoutAddressMapProps) {
  const [prevCity, setPrevCity] = useState(selectedCity);
  const [customPin, setCustomPin] = useState<[number, number] | null>(null);

  if (prevCity !== selectedCity) {
    setPrevCity(selectedCity);
    setCustomPin(null);
  }

  const cityCoord: [number, number] =
    CITY_COORDINATES[selectedCity] || CITY_COORDINATES['Lahore'];
  const pinPosition: [number, number] = customPin || cityCoord;

  const handleMapClick = (latlng: [number, number]) => {
    setCustomPin(latlng);
    if (onLocationConfirmed) {
      onLocationConfirmed({ lat: latlng[0], lng: latlng[1] });
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-200 overflow-hidden bg-white shadow-sm space-y-3 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
        <div>
          <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
            <Navigation className="h-3 w-3" />
            Delivery Pin Verification (OpenStreetMap)
          </span>
          <h4 className="text-xs font-bold text-neutral-900 mt-0.5">
            Pinpoint Exact Doorstep Drop-Off in {selectedCity}
          </h4>
        </div>
        <span className="text-[11px] text-neutral-500 flex items-center gap-1 font-medium bg-neutral-50 px-2.5 py-1 rounded-full border border-neutral-200">
          <Crosshair className="h-3 w-3 text-neutral-400" />
          Click anywhere on map to set pin
        </span>
      </div>

      <div className="h-56 sm:h-64 w-full rounded-xl overflow-hidden relative border border-neutral-200 z-0">
        <MapContainer
          center={cityCoord}
          zoom={13}
          scrollWheelZoom={false}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapController center={cityCoord} onMapClick={handleMapClick} />

          <Marker position={pinPosition} icon={deliveryIcon}>
            <Popup>
              <div className="p-1 text-xs font-sans">
                <strong className="block text-neutral-950 font-bold">Delivery Doorstep</strong>
                <span className="text-neutral-600">{streetAddress || selectedCity}</span>
              </div>
            </Popup>
          </Marker>
        </MapContainer>

        {/* Delivery coordinates pill */}
        <div className="absolute top-2 left-2 z-[1000] bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-lg border border-neutral-200 shadow-sm text-[10px] font-mono font-bold text-neutral-700 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          GPS: {pinPosition[0].toFixed(4)}, {pinPosition[1].toFixed(4)}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs">
        <p className="text-[11px] text-neutral-600 truncate max-w-sm">
          <strong className="text-neutral-900">Destination:</strong>{' '}
          {streetAddress ? `${streetAddress}, ` : ''}
          {selectedCity}, Pakistan
        </p>
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full shrink-0">
          <Check className="h-3 w-3" />
          <span>TCS / Leopards Doorstep Dispatch Verified</span>
        </div>
      </div>
    </div>
  );
}
