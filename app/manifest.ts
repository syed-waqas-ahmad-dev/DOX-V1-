import type { MetadataRoute } from 'next';

/**
 * @file app/manifest.ts
 * @description Native Next.js 15 App Router Web App Manifest for OX Shoes Rider Terminal.
 * Configures Android Chrome "Add to Home Screen" shortcut to launch directly into /delivery
 * in standalone app-like mode without browser address bars.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
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
        src: '/icon.jpg',
        sizes: '192x192 512x512',
        type: 'image/jpeg',
        purpose: 'any',
      },
      {
        src: '/images/ox-shoes-logo.jpg',
        sizes: '192x192 512x512',
        type: 'image/jpeg',
        purpose: 'any',
      },
    ],
  };
}
