import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions (FAQ)',
  description:
    'Answers to common questions about Bajaur OX Shoes — Cash on Delivery policies, shoe size guides, leather care, shipping times, and exchanges.',
  alternates: {
    canonical: '/faq',
  },
};

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return children;
}
