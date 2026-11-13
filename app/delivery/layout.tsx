import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rider Terminal',
  manifest: '/delivery/manifest.webmanifest',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
