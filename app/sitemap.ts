import type { MetadataRoute } from 'next';

/**
 * @file app/sitemap.ts
 * @description Dynamic XML Sitemap generator for Next.js 15 App Router.
 * Automatically generates URLs for static public pages and dynamic product detail pages.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://oxshoes.pk';

  // Static Indexable Pages
  const staticRoutes = [
    '',
    '/shop',
    '/ox-shoes',
    '/about',
    '/contact',
    '/stores',
    '/faq',
    '/returns',
    '/terms',
    '/privacy',
    '/track',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: (route === '' || route === '/shop' ? 'daily' : 'weekly') as 'daily' | 'weekly',
    priority: route === '' ? 1.0 : route === '/shop' ? 0.9 : 0.7,
  }));

  // Dynamic Product Pages fetched from actual MongoDB
  let productRoutes: MetadataRoute.Sitemap = [];
  try {
    const { connectToDatabase, isDatabaseConnected } = await import('@/lib/db/connect');
    const { Product } = await import('@/models/Product');
    
    await connectToDatabase();
    
    if (isDatabaseConnected()) {
      const products = await Product.find({ 
        isActive: true, 
        isDeleted: { $ne: true },
        slug: { $exists: true, $ne: '' }
      })
      .select('slug updatedAt createdAt')
      .lean();

      productRoutes = products
        .filter((product) => product.slug && typeof product.slug === 'string' && product.slug.trim().length > 0)
        .map((product) => {
          const rawDate = product.updatedAt || product.createdAt;
          const validDate = rawDate && !isNaN(new Date(rawDate).getTime()) ? new Date(rawDate) : new Date();
          return {
            url: `${baseUrl}/product/${encodeURIComponent(product.slug.trim())}`,
            lastModified: validDate,
            changeFrequency: 'weekly' as const,
            priority: 0.8,
          };
        });
    } else if (process.env.NODE_ENV !== 'production') {
      // In local development / offline test mode ONLY, permit MockDb fallback for developer inspection
      const { MockDb } = await import('@/lib/db/mock-store');
      const { products } = MockDb.getProducts({ limit: 100 });
      productRoutes = products
        .filter((p) => p.slug && p.slug.trim().length > 0)
        .map((product) => ({
          url: `${baseUrl}/product/${encodeURIComponent(product.slug.trim())}`,
          lastModified: new Date(product.updatedAt || product.createdAt || Date.now()),
          changeFrequency: 'weekly' as const,
          priority: 0.8,
        }));
    } else {
      // Production with DB unavailable: log warning and return only static routes; NEVER publish mock data
      console.warn('[Sitemap] Database connection unavailable in production; omitting dynamic products to prevent stale/fake indexing.');
    }
  } catch (error) {
    console.error('[Sitemap] Failed to fetch dynamic products:', error);
    // Silent fallback to avoid breaking static routes
  }

  // Deduplicate routes by URL to guarantee valid XML sitemap specification
  const seenUrls = new Set<string>();
  const combined = [...staticRoutes, ...productRoutes].filter((entry) => {
    if (seenUrls.has(entry.url)) return false;
    seenUrls.add(entry.url);
    return true;
  });

  return combined;
}
