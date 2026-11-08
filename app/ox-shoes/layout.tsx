import React from 'react';
import type { Metadata } from 'next';

/**
 * @file app/ox-shoes/layout.tsx
 * @description Server-side layout for the Ox Shoes collection page.
 * Exports optimized metadata for the premium Ox Shoes category.
 */

export const metadata: Metadata = {
  title: 'Premium Ox Shoes Collection | Bajaur OX Shoes Pakistan',
  description:
    'Explore the exclusive Ox Shoes collection at Bajaur OX Shoes. Discover handcrafted leather Peshawari Chappals, formal Oxfords, and premium footwear with nationwide cash on delivery.',
  alternates: {
    canonical: '/ox-shoes',
  },
  openGraph: {
    title: 'Ox Shoes Collection | Bajaur OX Shoes',
    description:
      'Handcrafted premium leather footwear collection. Nationwide COD available across Pakistan.',
    url: '/ox-shoes',
    type: 'website',
  },
};

export default function OxShoesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
