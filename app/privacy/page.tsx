'use client';

/**
 * @file app/privacy/page.tsx
 * @description Official Privacy Policy for OX Shoes Pakistan.
 * Outlines customer data protection, Pakistani digital privacy compliance, and payment security.
 * Strict TypeScript: ZERO `any`.
 */

import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { ShieldCheck, Lock, CheckCircle2 } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between selection:bg-neutral-950 selection:text-white">
      <AnnouncementBar />
      <Header onOpenSearch={() => {}} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full flex-1 space-y-8">
        <div className="border-b border-neutral-200 pb-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            <span>256-Bit SSL Encrypted & Privacy Protected</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-neutral-950">
            Privacy & Data Protection Policy
          </h1>
          <p className="text-xs text-neutral-500">Last updated: January 2026 • OX Shoes Atelier</p>
        </div>

        <div className="bg-white p-6 sm:p-10 rounded-3xl border border-neutral-200 shadow-sm space-y-6 text-xs text-neutral-700 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-neutral-950">1. Information We Collect</h2>
            <p>
              When you purchase handcrafted footwear or register an account at OX Shoes (oxshoes.pk), we collect your name, Pakistani mobile number (+923XXXXXXXXX), delivery street address, city, and email address solely for courier fulfillment and tax invoicing.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-neutral-950">2. Payment Security & Cash on Delivery</h2>
            <p>
              All customer orders are fulfilled via verified Cash on Delivery (COD). Payment is made directly to the courier rider upon package inspection at your doorstep. OX Shoes will never ask for bank PINs, OTP codes, or ATM passwords.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-neutral-950">3. Logistics & Courier Data Sharing</h2>
            <p>
              Your delivery address and mobile contact are securely transmitted to authorized Pakistani courier partners (TCS Express, Leopards Courier) strictly for order dispatch and SMS tracking updates.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-neutral-950">4. Official Tax Records (FBR Compliance)</h2>
            <p>
              In compliance with Federal Board of Revenue (FBR) Sales Tax Act requirements, electronic tax invoice records (NTN: 8241920-4) are maintained securely in our ERP accounting archive.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-neutral-950">5. Contact Our Data Protection Officer</h2>
            <p>
              For privacy inquiries or account deletion requests, email{' '}
              <strong className="text-neutral-950">privacy@oxshoes.pk</strong> or visit our Lahore atelier at 12-C/1, MM Alam Road, Gulberg III.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
