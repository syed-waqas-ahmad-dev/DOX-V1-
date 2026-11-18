/**
 * @file lib/cities.ts
 * @description Geographic coordinates for Pakistani cities and administrative territories.
 * Includes Bajaur [34.7314, 71.5244] and major hubs.
 */

export const CITY_COORDINATES: Record<string, [number, number]> = {
  Peshawar: [34.0151, 71.5249],
  Lahore: [31.5204, 74.3587],
  Islamabad: [33.6844, 73.0479],
  Rawalpindi: [33.5651, 73.0169],
  Karachi: [24.8607, 67.0011],
  Faisalabad: [31.4504, 73.135],
  Multan: [30.1575, 71.5249],
  Sialkot: [32.4945, 74.5229],
  Gujranwala: [32.1877, 74.1945],
  Hyderabad: [25.396, 68.3578],
  Quetta: [30.1798, 66.975],
  Mardan: [34.1989, 72.0404],
  Abbottabad: [34.1688, 73.2215],
  Bajaur: [34.7314, 71.5244],
  Bahawalpur: [29.3544, 71.6911],
  Sargodha: [32.0836, 72.6711],
  Sukkur: [27.7052, 68.8574],
  Kasur: [31.1179, 74.4461],
  Sheikhupura: [31.7131, 73.9783],
  Gujrat: [32.5742, 74.0754],
  Sahiwal: [30.6682, 73.1114],
  // Malakand Division districts (verified district-level coordinates; Bajaur already defined above)
  Buner: [34.5114, 72.4839],
  'Lower Dir': [34.8519, 71.8534],
  'Upper Dir': [35.2067, 71.8767],
  Malakand: [34.5, 71.75],
  Shangla: [34.8873, 72.5991],
  Swat: [35.2, 72.4833],
  // Checkout cityOptions ('Swat (Mingora)') stores 'Mingora'; include city coordinates for map/Haversine resolution
  Mingora: [34.7717, 72.36],
};

const NORMALIZED_CITY_INDEX: Record<string, [number, number]> = Object.fromEntries(
  Object.entries(CITY_COORDINATES).map(([name, coords]) => [name.trim().toLowerCase(), coords])
);

/**
 * Resolves approximate city/district centroid coordinates.
 * Returns null for unsupported/unresolved cities rather than falling back to Lahore or Peshawar.
 */
export function resolveCityCoordinates(city?: string | null): [number, number] | null {
  if (!city || typeof city !== 'string') return null;
  const trimmed = city.trim();
  if (!trimmed) return null;

  if (CITY_COORDINATES[trimmed]) {
    return CITY_COORDINATES[trimmed];
  }

  const normalized = trimmed.toLowerCase();
  if (NORMALIZED_CITY_INDEX[normalized]) {
    return NORMALIZED_CITY_INDEX[normalized];
  }

  return null;
}

/**
 * Validates finite WGS-84 coordinates.
 */
export function isValidCoordinatePair(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

