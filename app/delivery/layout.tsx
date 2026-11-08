import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rider Terminal',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
