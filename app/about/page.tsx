/**
 * @file app/about/page.tsx
 * @description Public About Page for OX Shoes Pakistan.
 * Fetches dynamic store details, manager profile, team categories, and media gallery.
 * Public page - NO authentication check.
 * Strict TypeScript: ZERO `any`.
 */

import type { Metadata } from 'next';
import { getAboutPageData, getGalleryItems } from '@/app/admin/about/actions';
import { AboutClientContent } from '@/components/about/AboutClientContent';
import type { IAboutPage } from '@/models/AboutPage';
import type { IGalleryItem } from '@/models/GalleryItem';

export const revalidate = 60; // ISR cache revalidation every 60s

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'Discover the legacy of Bajaur OX Shoes — master Pakistani leather craftsmanship, bespoke Peshawari Chappal artisans, and flagship stores across Pakistan.',
  alternates: {
    canonical: '/about',
  },
};

export default async function AboutPage() {
  const [aboutRes, galleryRes] = await Promise.all([
    getAboutPageData(),
    getGalleryItems(),
  ]);

  const fallbackAbout: IAboutPage = {
    _id: 'default-about',
    heroImages: [
      {
        url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=1400&auto=format&fit=crop',
        alt: 'OX Shoes Flagship Front',
      },
      {
        url: 'https://images.unsplash.com/photo-1449505278894-297fdb3edbc1?q=80&w=600&auto=format&fit=crop',
        alt: 'Atelier Workshop Interior',
      },
      {
        url: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?q=80&w=600&auto=format&fit=crop',
        alt: 'Handcrafted Bovine Stitching',
      },
    ],
    manager: {
      name: 'Dawood Khan',
      description:
        'Master craftsman with over 20 years of bespoke handmade footwear excellence. Leading OX Shoes with dedication to pure Pakistani cobbler heritage.',
      phone: '+92 300 0914546',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    },
    teamCategories: [
      { role: 'Super Admin', count: 1 },
      { role: 'Managers', count: 1 },
      { role: 'Master Craftsmen', count: 12 },
      { role: 'Delivery Partners', count: 5 },
    ],
  };

  const aboutData = aboutRes.success && aboutRes.data ? aboutRes.data : fallbackAbout;
  const galleryData = galleryRes.success && galleryRes.data ? galleryRes.data : [];

  return <AboutClientContent initialAbout={aboutData} initialGallery={galleryData} />;
}
