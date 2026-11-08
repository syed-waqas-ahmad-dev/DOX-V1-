import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '7-Day Exchange & Returns Policy',
  description:
    'Hassle-free 7-day exchange and returns policy for Bajaur OX Shoes. Easy size replacement and doorstep pickup across Pakistan.',
  alternates: {
    canonical: '/returns',
  },
};

export default function ReturnsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
