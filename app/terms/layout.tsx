import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description:
    'Terms and conditions governing orders, Cash on Delivery, shipping SLAs, and customer rights at Bajaur OX Shoes Pakistan.',
  alternates: {
    canonical: '/terms',
  },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
