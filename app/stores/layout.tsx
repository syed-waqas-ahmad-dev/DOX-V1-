import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Store Location & Nationwide Delivery',
  description:
    'Visit the Bajaur OX Shoes physical shop in Inayat Killi Bazar, Bypass Road, near Inam Plaza, District Bajaur, Pakistan. Handcrafted footwear with nationwide COD courier delivery.',
  alternates: {
    canonical: '/stores',
  },
};

export default function StoresLayout({ children }: { children: React.ReactNode }) {
  return children;
}
