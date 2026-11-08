import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Privacy Policy for Bajaur OX Shoes. Learn how we protect your personal information, order data, and payment security.',
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
