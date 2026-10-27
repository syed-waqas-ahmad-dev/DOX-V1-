'use client';

/**
 * @file app/terms/page.tsx
 * @description Official Terms of Service and Sale Conditions for OX Shoes Pakistan.
 * Outlines 7-day exchange conditions, COD rules, FBR tax invoicing, and artisan warranty.
 * Strict TypeScript: ZERO `any`.
 */

import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { Scale, CheckCircle2 } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between selection:bg-neutral-950 selection:text-white">
      <AnnouncementBar />
      <Header onOpenSearch={() => {}} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full flex-1 space-y-8">
        <div className="border-b border-neutral-200 pb-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-neutral-600">
            <Scale className="h-4 w-4" />
            <span>Commercial & Artisan Service Agreement</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-neutral-950">
            Terms & Conditions of Sale
          </h1>
          <p className="text-xs text-neutral-500">Effective: 2026 • OX Shoes Atelier Pakistan</p>
        </div>

        <div className="bg-white p-6 sm:p-10 rounded-3xl border border-neutral-200 shadow-sm space-y-6 text-xs text-neutral-700 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-neutral-950">1. Acceptance of Terms</h2>
            <p>
              By accessing oxshoes.pk or placing an order via Cash on Delivery (COD), you agree to be bound by these Terms of Sale under Pakistani law.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-neutral-950">2. Pricing, Currencies & FBR Taxes</h2>
            <p>
              All prices displayed on oxshoes.pk are in Pakistani Rupees (PKR) and include the mandatory 17% Federal Sales Tax in accordance with FBR documentation. Each purchase generates an official Tax Invoice referencing NTN: 8241920-4.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-neutral-950">3. 7-Day Size Exchange Policy</h2>
            <p>
              Customers are entitled to exchange shoe sizes within 7 calendar days of courier delivery, provided the footwear is in unsoiled, unworn condition inside the original OX Shoes box with packaging inserts intact.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-neutral-950">4. Cash on Delivery (COD) Obligations</h2>
            <p>
              For Cash on Delivery orders, exact cash payment must be tendered to the courier rider upon handover. Orders exceeding PKR 10,000 may require SMS OTP verification prior to courier dispatch.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-neutral-950">5. Artisan Craftsmanship Variance</h2>
            <p>
              Because our shoes are handcrafted using genuine bovine hides, slight natural variations in leather grain and hand-stitching are hallmarks of authentic master craftsmanship.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
