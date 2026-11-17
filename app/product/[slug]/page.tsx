import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProductBySlug } from '@/actions/product.actions';
import { getProductReviews } from '@/actions/review.actions';
import { ProductDetailClient } from './ProductDetailClient';
import type { IProduct, IReview } from '@/types';

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

const NOT_FOUND_ERROR = 'Product not found or is no longer available.';

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  const res = await getProductBySlug(decodedSlug);
  const product: IProduct | null = res.success && res.data ? res.data : null;

  if (!product) {
    if (!res.success && res.error === NOT_FOUND_ERROR) {
      return {
        title: 'Product Not Found',
        description: 'The requested footwear item is no longer available at Bajaur OX Shoes.',
      };
    }
    return {
      title: 'Store Temporarily Unavailable | Bajaur OX Shoes',
      description: 'Our footwear catalog is temporarily unavailable. Please try again shortly.',
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://oxshoes.pk';
  const pageTitle = product.seoTitle || `${product.name}`;
  const description =
    product.seoDescription ||
    product.shortDescription ||
    product.description?.slice(0, 160) ||
    `Handcrafted ${product.name} by Bajaur OX Shoes. 100% genuine bovine leather footwear with cash on delivery across Pakistan.`;
  const mainImage = product.images?.[0] || '/images/ox-shoes-logo.jpg';

  return {
    title: pageTitle,
    description,
    keywords: [
      product.name,
      'Bajaur OX Shoes',
      product.category,
      product.subCategory,
      'Pakistani Footwear',
      'Handcrafted Leather Shoes',
    ],
    alternates: {
      canonical: `${baseUrl}/product/${product.slug}`,
    },
    openGraph: {
      title: `${product.name} | Bajaur OX Shoes`,
      description,
      url: `${baseUrl}/product/${product.slug}`,
      siteName: 'Bajaur OX Shoes',
      locale: 'en_PK',
      type: 'article',
      images: [
        {
          url: mainImage,
          width: 800,
          height: 800,
          alt: product.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.name} | Bajaur OX Shoes`,
      description,
      images: [mainImage],
    },
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  const res = await getProductBySlug(decodedSlug);

  if (!res.success) {
    if (res.error === NOT_FOUND_ERROR) {
      return notFound();
    }

    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between">
        <header className="border-b border-neutral-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="font-black text-lg tracking-tight uppercase text-neutral-950">
              Bajaur OX Shoes
            </Link>
            <Link
              href="/shop"
              className="text-xs font-bold uppercase tracking-wider text-neutral-700 hover:text-neutral-950"
            >
              Shop All
            </Link>
          </div>
        </header>

        <main className="max-w-xl mx-auto px-6 py-20 text-center space-y-4">
          <h1 className="text-2xl font-black uppercase tracking-tight text-neutral-950">
            Store Temporarily Unavailable
          </h1>
          <p className="text-sm text-neutral-600">
            {res.error || 'We could not load live product inventory right now. Please refresh or return to the shop.'}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href={`/product/${encodeURIComponent(decodedSlug)}`}
              className="px-6 py-3 rounded-full bg-neutral-950 text-white text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors"
            >
              Retry
            </Link>
            <Link
              href="/shop"
              className="px-6 py-3 rounded-full border border-neutral-300 bg-white text-neutral-900 text-xs font-bold uppercase tracking-wider hover:bg-neutral-100 transition-colors"
            >
              Browse Shop
            </Link>
          </div>
        </main>

        <footer className="border-t border-neutral-200 bg-white py-6 text-center text-xs text-neutral-500">
          Bajaur OX Shoes • Nationwide Cash on Delivery
        </footer>
      </div>
    );
  }

  const product: IProduct | null = res.data;

  if (!product) {
    return notFound();
  }

  // Fetch reviews on server
  let reviews: IReview[] = [];
  try {
    const revRes = await getProductReviews(product._id.toString());
    if (revRes.success && revRes.data) {
      reviews = revRes.data;
    }
  } catch {
    reviews = [];
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://oxshoes.pk';

  // Product + Offer JSON-LD
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.images,
    description: product.description || product.shortDescription,
    sku: product.sku,
    brand: {
      '@type': 'Brand',
      name: product.brand || 'Bajaur OX Shoes',
    },
    offers: {
      '@type': 'Offer',
      url: `${baseUrl}/product/${product.slug}`,
      priceCurrency: 'PKR',
      price: product.price,
      priceValidUntil: '2027-12-31',
      itemCondition: 'https://schema.org/NewCondition',
      availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: 'Bajaur OX Shoes',
      },
    },
    ...(product.numReviews > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.rating,
            reviewCount: product.numReviews,
          },
        }
      : {}),
  };

  // BreadcrumbList JSON-LD
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: baseUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: product.category,
        item: `${baseUrl}/shop?category=${encodeURIComponent(product.category)}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: product.subCategory,
        item: `${baseUrl}/shop?subCategory=${encodeURIComponent(product.subCategory)}`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: product.name,
        item: `${baseUrl}/product/${product.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ProductDetailClient initialProduct={product} initialReviews={reviews} />
    </>
  );
}
