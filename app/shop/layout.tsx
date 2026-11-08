import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shop All Footwear Catalog',
  description:
    'Browse the full catalog of Bajaur OX Shoes — handcrafted Peshawari Chappals, Khussa, Oxford Dress Shoes, Formal Footwear & Sneakers with Cash on Delivery across Pakistan.',
  alternates: {
    canonical: '/shop',
  },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
