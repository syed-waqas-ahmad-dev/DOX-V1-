import type { MetadataRoute } from 'next';

/**
 * @file app/manifest.webmanifest/route.ts
 * @description Explicit Route Handler serving the Bajaur OX Shoes storefront Web App Manifest
 * at /manifest.webmanifest, isolated from the /delivery Rider Terminal PWA.
 */
export function GET(): Response {
  const manifest: MetadataRoute.Manifest = {
    id: '/',
    name: 'Bajaur OX Shoes',
    short_name: 'OX Shoes',
    description:
      'Premier Handcrafted Leather Shoes, Peshawari Chappals, Oxford Dress Shoes & Sneakers in Pakistan. Fast Nationwide Cash on Delivery (COD).',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#f59e0b',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    status: 200,
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, must-revalidate',
    },
  });
}
