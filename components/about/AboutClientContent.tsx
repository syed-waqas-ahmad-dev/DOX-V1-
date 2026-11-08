'use client';

/**
 * @file components/about/AboutClientContent.tsx
 * @description Premium Dark-Themed About Page for OX Shoes Pakistan.
 * Features Shopfront Hero with tilted interior snapshots, Master Craftsman Manager Profile,
 * 2x2 Team Stat Cards, 3-Column Media Gallery, and Visit Our Store Location Map.
 * Strict TypeScript: ZERO `any`.
 */

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { SearchModal } from '@/components/layout/SearchModal';
import { Phone, Play, ShieldCheck, Sparkles, MapPin, ExternalLink } from 'lucide-react';
import type { IAboutPage } from '@/models/AboutPage';
import type { IGalleryItem } from '@/models/GalleryItem';

const MapComponent = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="h-[350px] w-full rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col items-center justify-center text-xs text-neutral-400 font-semibold space-y-2 animate-pulse">
      <div className="h-7 w-7 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
      <span>Loading Store Location Map...</span>
    </div>
  ),
});

interface AboutClientContentProps {
  initialAbout: IAboutPage;
  initialGallery: IGalleryItem[];
}

export function AboutClientContent({ initialAbout, initialGallery }: AboutClientContentProps) {
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const about = initialAbout;
  const gallery = initialGallery;

  const heroShopFront =
    about.heroImages?.[0]?.url ||
    'https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=1400&auto=format&fit=crop';
  const heroInterior1 =
    about.heroImages?.[1]?.url ||
    'https://images.unsplash.com/photo-1449505278894-297fdb3edbc1?q=80&w=600&auto=format&fit=crop';
  const heroInterior2 =
    about.heroImages?.[2]?.url ||
    'https://images.unsplash.com/photo-1560769629-975ec94e6a86?q=80&w=600&auto=format&fit=crop';

  const manager = about.manager || {
    name: 'Dawood Khan',
    description:
      'Master craftsman with over 20 years of bespoke handmade footwear excellence. Leading OX Shoes with dedication to pure Pakistani cobbler heritage.',
    phone: '+92 300 0914546',
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
  };

  const teamStats =
    about.teamCategories && about.teamCategories.length > 0
      ? about.teamCategories
      : [
          { role: 'Super Admin', count: 1 },
          { role: 'Managers', count: 1 },
          { role: 'Master Craftsmen', count: 12 },
          { role: 'Delivery Partners', count: 5 },
        ];

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-between selection:bg-amber-500 selection:text-neutral-950">
      <AnnouncementBar />
      <Header onOpenSearch={() => setSearchModalOpen(true)} />
      <SearchModal isOpen={searchModalOpen} onClose={() => setSearchModalOpen(false)} />

      <main className="w-full flex-1 pb-16">
        {/* SECTION 1: HERO */}
        <section className="relative w-full overflow-hidden min-h-[640px] flex items-center justify-center border-b border-neutral-900">
          {/* Full-width background shopfront with dark overlay */}
          <div className="absolute inset-0 z-0">
            <Image
              src={heroShopFront}
              alt={about.heroImages?.[0]?.alt || 'OX Shoes Flagship Front'}
              fill
              priority
              className="object-cover object-center scale-105"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-[2px]" />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-neutral-950/60" />
          </div>

          {/* Hero Content */}
          <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-widest mb-6">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Est. 2018 • Pakistani Cobbler Legacy</span>
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black uppercase tracking-tight text-white mb-6 drop-shadow-md">
              Welcome to <span className="text-amber-500">OX Shoes</span>
            </h1>

            <p className="max-w-2xl text-base sm:text-lg text-neutral-300 font-light leading-relaxed mb-10">
              Where time-honored Pakistani leathercraft converges with contemporary sartorial elegance.
              Every stitch tells the story of unyielding dedication, hand-welted soles, and full-grain bovine perfection.
            </p>

            {/* 2 Small Overlapping Interior Images */}
            <div className="relative flex items-center justify-center mt-4">
              {/* Image 1: Rotated -6 deg */}
              <div className="w-48 h-32 sm:w-56 sm:h-36 rounded-xl border-4 border-neutral-800 shadow-2xl transform -rotate-6 hover:rotate-0 transition-all duration-300 relative overflow-hidden bg-neutral-900 z-10">
                <Image
                  src={heroInterior1}
                  alt={about.heroImages?.[1]?.alt || 'Atelier Workshop Interior'}
                  fill
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Image 2: Rotated +6 deg overlapping */}
              <div className="w-48 h-32 sm:w-56 sm:h-36 rounded-xl border-4 border-neutral-800 shadow-2xl transform rotate-6 hover:rotate-0 transition-all duration-300 relative overflow-hidden bg-neutral-900 -ml-12 sm:-ml-16 mt-6 z-20">
                <Image
                  src={heroInterior2}
                  alt={about.heroImages?.[2]?.alt || 'Handcrafted Bovine Stitching'}
                  fill
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: MANAGER & TEAM STATS */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-2">
              Leadership & Artisans
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-white">
              The Guild Behind the Footwear
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left: Manager Card */}
            <div className="lg:col-span-5 bg-neutral-900 p-8 rounded-3xl border border-neutral-800 flex flex-col justify-between shadow-xl">
              <div>
                <div className="flex items-center gap-5">
                  <div className="w-32 h-32 rounded-2xl border-2 border-amber-500 relative overflow-hidden flex-shrink-0 bg-neutral-800 shadow-lg">
                    <Image
                      src={manager.imageUrl || 'https://res.cloudinary.com/demo/image/upload/sample.jpg'}
                      alt={manager.name}
                      fill
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-md inline-block mb-1">
                      Store Manager
                    </span>
                    <h3 className="text-2xl font-black text-white">{manager.name}</h3>
                    <p className="text-xs text-neutral-400 mt-1">Master of Leather Atelier</p>
                  </div>
                </div>

                <p className="text-sm text-neutral-300 leading-relaxed mt-6">
                  {manager.description}
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3 text-neutral-300">
                  <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-emerald-400">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-400 uppercase tracking-wider">Official Store WhatsApp</p>
                    <a
                      href="https://wa.me/923000914546"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-bold text-emerald-400 hover:text-emerald-300 transition"
                    >
                      +92 300 0914546
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-neutral-400 bg-neutral-800/60 px-3 py-1.5 rounded-lg border border-neutral-700/50">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Verified</span>
                </div>
              </div>
            </div>

            {/* Right: 2x2 Grid of Team Stat Cards */}
            <div className="lg:col-span-7 grid grid-cols-2 gap-4">
              {teamStats.map((stat, idx) => (
                <div
                  key={`${stat.role}-${idx}`}
                  className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 flex flex-col justify-center space-y-2 hover:border-amber-500/50 transition duration-300 shadow-md group"
                >
                  <div className="text-4xl font-black text-amber-500 group-hover:scale-105 transition-transform duration-300">
                    {stat.count}
                  </div>
                  <div className="text-sm font-semibold uppercase tracking-wider text-neutral-300">
                    {stat.role}
                  </div>
                  <div className="w-8 h-1 bg-neutral-800 group-hover:bg-amber-500 transition-colors duration-300 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3: GALLERY */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-neutral-900">
          <div className="text-center mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-2">
              Atelier Showcase
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-white">
              Visual Craftsmanship & Moments
            </p>
            <p className="text-sm text-neutral-400 mt-2 max-w-xl mx-auto">
              Inspect our workshop tools, full-grain hides, and handcrafted shoemaking moments in Pakistan.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {gallery.map((item) => (
              <div
                key={String(item._id)}
                className="group relative aspect-[4/3] rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-900 shadow-lg"
              >
                {item.type === 'video' ? (
                  <div className="relative w-full h-full bg-black">
                    <video
                      src={item.url}
                      controls
                      preload="metadata"
                      className="w-full h-full object-cover rounded-2xl"
                    />
                    <div className="absolute top-3 right-3 bg-amber-500 text-neutral-950 p-1.5 rounded-full shadow-lg pointer-events-none z-10">
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full h-full overflow-hidden">
                    <Image
                      src={item.url}
                      alt={item.title || 'OX Shoes Craftsmanship'}
                      fill
                      className="object-cover group-hover:scale-110 transition duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent opacity-0 group-hover:opacity-100 transition duration-300 flex flex-col justify-end p-5">
                      {item.title && (
                        <h4 className="text-base font-bold text-white mb-1 drop-shadow">
                          {item.title}
                        </h4>
                      )}
                      {item.description && (
                        <p className="text-xs text-neutral-300 drop-shadow line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {gallery.length === 0 && (
            <div className="text-center py-12 text-neutral-500 text-sm">
              No gallery items available at this time.
            </div>
          )}
        </section>

        {/* SECTION 4: VISIT OUR STORE (MAP) */}
        <section className="py-16 bg-neutral-900 border-t border-neutral-800">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-white mb-8 text-center">
              Visit Our <span className="text-amber-500">Store</span>
            </h2>
            <div className="grid md:grid-cols-2 gap-8 items-center max-w-5xl mx-auto">
              <div className="space-y-4 bg-neutral-950/60 p-6 sm:p-8 rounded-2xl border border-neutral-800">
                <div className="flex items-start gap-3">
                  <MapPin className="w-6 h-6 text-amber-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Bajaur OX Shoes Shop</h3>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      Inayat Killi Bazar, Bypass Road, near Inam Plaza, District Bajaur
                    </p>
                    <p className="text-gray-400 text-xs font-mono mt-1">
                      Plus Code: QF33+Q6F, Inayat Killi
                    </p>
                  </div>
                </div>
                <div className="pl-9 space-y-2">
                  <p className="text-gray-400 text-xs font-mono">
                    Lat: 34.7544498, Lng: 71.4530333
                  </p>
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=34.7544498%2C71.4530333"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-amber-500 hover:text-amber-400 underline font-semibold text-sm transition-colors"
                  >
                    <span>Get Directions on Google Maps</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="h-[350px] w-full rounded-xl overflow-hidden border border-neutral-800 shadow-2xl">
                <MapComponent
                  center={[34.7544498, 71.4530333]}
                  zoom={15}
                  markers={[
                    {
                      position: [34.7544498, 71.4530333],
                      popupContent: 'OX Shoes Shop',
                    },
                  ]}
                  style={{ height: '350px', width: '100%' }}
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

