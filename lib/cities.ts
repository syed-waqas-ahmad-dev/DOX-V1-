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
};
