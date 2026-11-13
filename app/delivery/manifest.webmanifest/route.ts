import type { MetadataRoute } from 'next';

/**
 * @file app/delivery/manifest.webmanifest/route.ts
 * @description Explicit Route Handler serving the OX Shoes Rider Terminal Web App Manifest
 * at /delivery/manifest.webmanifest, preserving isolated /delivery scope and identity.
 */
export function GET(): Response {
  const manifest: MetadataRoute.Manifest = {
    id: '/delivery',
    name: 'Bajaur OX Shoes Rider Terminal',
    short_name: 'Bajaur OX',
    description: 'Dedicated Mobile Terminal for Bajaur OX Shoes Private Delivery Fleet',
    start_url: '/delivery',
    scope: '/delivery',
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
