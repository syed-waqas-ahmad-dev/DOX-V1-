import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Track Your Order',
  description:
    'Track your Bajaur OX Shoes order live with TCS, Leopards, or private fleet consignment tracking numbers in Pakistan.',
  alternates: {
    canonical: '/track',
  },
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
