/**
 * @file app/admin/about/page.tsx
 * @description Super Admin About Us & Gallery Management Dashboard.
 * Strictly protected: only authenticated users with role === 'super_admin' can access.
 * Strict TypeScript: ZERO `any`.
 */

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getAboutPageData, getGalleryItems } from '@/app/admin/about/actions';
import { AboutAdminManager } from '@/components/admin/about/AboutAdminManager';
import type { IAboutPage } from '@/models/AboutPage';

export const dynamic = 'force-dynamic';

export default async function AdminAboutPage() {
  const session = await getServerSession(authOptions);

  // Strict Super Admin RBAC Check
  if (!session || !session.user || session.user.role !== 'super_admin') {
    console.log('DEBUG SERVER SESSION:', session?.user);
    redirect('/admin');
  }

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
      phone: '+92-300-1234567',
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

  return <AboutAdminManager initialAbout={aboutData} initialGallery={galleryData} />;
}
