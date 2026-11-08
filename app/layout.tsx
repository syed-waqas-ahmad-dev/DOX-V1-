import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';

export const viewport: Viewport = {
  themeColor: '#f59e0b',
  width: 'device-width',
  initialScale: 1,
};

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://oxshoes.pk';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'Bajaur OX Shoes',
    template: '%s | Bajaur OX Shoes',
  },
  description:
    'Bajaur OX Shoes — Premier Handcrafted Leather Shoes, Peshawari Chappals, Oxford Dress Shoes, Formal Footwear & Sneakers in Pakistan. Fast Nationwide Cash on Delivery (COD).',
  keywords: [
    'Bajaur OX Shoes',
    'OX Shoes Pakistan',
    'Peshawari Chappal',
    'Leather Shoes Pakistan',
    'Handcrafted Footwear',
    'Formal Shoes Lahore',
    'Khussa',
    'Cash on Delivery Shoes Pakistan',
  ],
  authors: [{ name: 'Bajaur OX Shoes Atelier' }],
  creator: 'Bajaur OX Shoes',
  publisher: 'Bajaur OX Shoes Pakistan',
  alternates: {
    canonical: './',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Bajaur OX',
  },
  icons: {
    icon: [
      { url: '/icon.jpg', type: 'image/jpeg' },
      { url: '/images/ox-shoes-logo.jpg', type: 'image/jpeg' },
    ],
    apple: '/icon.jpg',
  },
  openGraph: {
    title: 'Bajaur OX Shoes',
    description:
      'Bajaur OX Shoes — Premier Handcrafted Leather Shoes, Peshawari Chappals, Oxford Dress Shoes & Sneakers in Pakistan.',
    url: baseUrl,
    siteName: 'Bajaur OX Shoes',
    locale: 'en_PK',
    type: 'website',
    images: [
      {
        url: '/images/ox-shoes-logo.jpg',
        width: 1200,
        height: 630,
        alt: 'Bajaur OX Shoes Pakistan Brand Emblem',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bajaur OX Shoes',
    description:
      'Premier Handcrafted Leather Shoes, Peshawari Chappals & Sneakers in Pakistan.',
    images: ['/images/ox-shoes-logo.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ShoeStore',
    name: 'Bajaur OX Shoes',
    alternateName: 'OX Shoes Pakistan',
    url: baseUrl,
    logo: `${baseUrl}/images/ox-shoes-logo.jpg`,
    description:
      'Bajaur OX Shoes Shop is located in District Bajaur, Inayat Killi Bazar, Bypass Road, near Inam Plaza.',
    telephone: '+923000914546',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Inayat Killi Bazar, Bypass Road, near Inam Plaza',
      addressLocality: 'Inayat Killi',
      addressRegion: 'Bajaur',
      addressCountry: 'PK',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 34.7544498,
      longitude: 71.4530333,
    },
    hasMap: 'https://www.google.com/maps/search/?api=1&query=34.7544498%2C71.4530333',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+923000914546',
      contactType: 'customer support',
      url: 'https://wa.me/923000914546',
      areaServed: 'PK',
      availableLanguage: ['English', 'Urdu'],
    },
  };

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Bajaur OX Shoes',
    url: baseUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/shop?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
