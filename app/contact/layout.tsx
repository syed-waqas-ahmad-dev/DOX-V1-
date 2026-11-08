import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Contact Bajaur OX Shoes — Inayat Killi Bazar, Bypass Road, near Inam Plaza, District Bajaur. Official WhatsApp customer support (+92 300 0914546).',
  alternates: {
    canonical: '/contact',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
