import type { MetadataRoute } from 'next';

/**
 * @file app/robots.ts
 * @description Dynamic robots.txt configuration for Next.js 15 App Router.
 * Configures indexable public storefront routes and blocks private/sensitive endpoints.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://oxshoes.pk';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/delivery',
          '/cart',
          '/checkout',
          '/login',
          '/signup',
          '/forgot-password',
          '/my-account',
          '/dashboard/',
          '/api/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
