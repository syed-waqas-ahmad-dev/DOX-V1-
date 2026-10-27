'use client';

/**
 * @file components/layout/Footer.tsx
 * @description Comprehensive Nike-inspired e-commerce footer for OX Shoes Pakistan.
 * Includes COD assurances, Pakistani gateway logos, courier SLAs, and newsletter capture.
 * Strict TypeScript: ZERO `any`.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useLocaleStore } from '@/lib/store/locale';
import { useHydrated } from '@/lib/hooks/useHydrated';
import { APP_NAME } from '@/lib/constants';
import { Logo } from '@/components/layout/Logo';
import { Truck, ShieldCheck, Phone, Mail, MapPin, Send, CheckCircle2 } from 'lucide-react';

export function Footer() {
  const { isUrdu } = useLocaleStore();
  const isHydrated = useHydrated();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentIsUrdu = isHydrated && isUrdu;

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setSubscribed(true);
        setEmail('');
      }
    } catch (err: unknown) {
      console.error('Newsletter error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer className="bg-neutral-950 text-neutral-300 border-t border-neutral-900 transition-colors">
      {/* Top Value Propositions */}
      <div className="border-b border-neutral-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-full bg-neutral-900 flex items-center justify-center text-amber-400 shrink-0">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                {currentIsUrdu ? 'پورے پاکستان میں کیش آن ڈیلیوری' : 'Nationwide COD Delivery'}
              </h4>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                {currentIsUrdu ? 'ٹی سی ایس اور لیپرڈز کے ذریعے' : 'TCS & Leopards Express (2-4 Days)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-full bg-neutral-900 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                {currentIsUrdu ? '۷ دن کی مفت تبدیلی' : '7-Day Easy Exchange'}
              </h4>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                {currentIsUrdu ? 'سائز کی آسان تبدیلی' : 'Hassle-free size replacement'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-full bg-neutral-900 flex items-center justify-center text-sky-400 shrink-0">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                {currentIsUrdu ? 'واٹس ایپ ہیلپ لائن' : 'WhatsApp Support'}
              </h4>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                +92 300 0914546 (10am - 8pm)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-full bg-neutral-900 flex items-center justify-center text-purple-400 shrink-0">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                {currentIsUrdu ? 'لاہور میں تیار کردہ' : 'Handcrafted in Pakistan'}
              </h4>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                {currentIsUrdu ? '۱۰۰٪ خالص لیدر دستکاری' : '100% Genuine Artisan Leather'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
        {/* Brand Column */}
        <div className="lg:col-span-2 space-y-4">
          <Logo theme="dark" size="lg" />
          <p className="text-xs text-neutral-400 max-w-sm leading-relaxed">
            {currentIsUrdu
              ? 'او ایکس شوز پاکستان کا معروف پریمیم فٹ ویئر برانڈ ہے۔ ہم روایتی پشاوری چپل، ملتانی کھسے اور جدید جوگرز پیش کرتے ہیں۔'
              : 'Pakistan’s premier footwear brand blending heritage Peshawari craftsmanship, wedding khussas, and modern athletic sneakers. Engineered for supreme durability across all Pakistani terrain.'}
          </p>

          {/* Newsletter Box */}
          <div className="pt-2">
            <h5 className="font-bold text-xs uppercase text-white tracking-wider mb-2">
              {currentIsUrdu ? 'عید آفرز اور رعایت حاصل کریں' : 'Be First to Know: Eid Drops & Offers'}
            </h5>
            {subscribed ? (
              <div className="p-3 bg-neutral-900 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Subscribed! Check your inbox for PKR 500 voucher.</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex max-w-sm">
                <input
                  type="email"
                  placeholder="Enter email (e.g. name@oxshoes.pk)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-800 rounded-l-lg focus:outline-none focus:border-white text-white placeholder:text-neutral-500"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-white hover:bg-neutral-200 text-neutral-950 font-bold text-xs rounded-r-lg transition-colors flex items-center gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Shop Navigation */}
        <div className="space-y-3">
          <h5 className="font-bold text-xs uppercase text-white tracking-wider">
            {currentIsUrdu ? 'شاپ کلیکشن' : 'Footwear Collections'}
          </h5>
          <ul className="space-y-2 text-xs text-neutral-400 font-medium">
            <li>
              <Link href="/shop?subCategory=Peshawari+Chappal" className="hover:text-white transition-colors">
                Peshawari Chappal (Double Sole)
              </Link>
            </li>
            <li>
              <Link href="/shop?subCategory=Khussa" className="hover:text-white transition-colors">
                Multani & Bridal Khussa
              </Link>
            </li>
            <li>
              <Link href="/shop?category=Men&subCategory=Formal+Shoes" className="hover:text-white transition-colors">
                Men Executive Oxfords
              </Link>
            </li>
            <li>
              <Link href="/shop?subCategory=Joggers" className="hover:text-white transition-colors">
                Margalla Trail Joggers
              </Link>
            </li>
            <li>
              <Link href="/shop?subCategory=School+Shoes" className="hover:text-white transition-colors">
                Kids Durable School Shoes
              </Link>
            </li>
          </ul>
        </div>

        {/* Customer Help */}
        <div className="space-y-3">
          <h5 className="font-bold text-xs uppercase text-white tracking-wider">
            {currentIsUrdu ? 'کسٹمر کیئر' : 'Customer Care'}
          </h5>
          <ul className="space-y-2 text-xs text-neutral-400 font-medium">
            <li>
              <Link href="/track" className="hover:text-white transition-colors">
                Track TCS / Leopards Order
              </Link>
            </li>
            <li>
              <Link href="/stores" className="hover:text-white transition-colors">
                Physical Store Locator (Google Maps)
              </Link>
            </li>
            <li>
              <Link href="/returns" className="hover:text-white transition-colors">
                7-Day Returns & Size Exchange
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-white transition-colors">
                Contact & Headquarters (Lahore)
              </Link>
            </li>
            <li>
              <Link href="/faq" className="hover:text-white transition-colors">
                {currentIsUrdu ? 'عام سوالات و جوابات' : 'Help & FAQs'}
              </Link>
            </li>
          </ul>
        </div>

        {/* Payment Methods & Security */}
        <div className="space-y-3">
          <h5 className="font-bold text-xs uppercase text-white tracking-wider">
            {currentIsUrdu ? 'ادائیگی اور ترسیل' : 'Payment & Delivery'}
          </h5>
          <div className="space-y-2 text-xs text-neutral-400">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] font-bold text-amber-400">
                COD
              </span>
              <span>Cash on Delivery Nationwide</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-[11px] font-bold text-emerald-400">
                TCS
              </span>
              <span>Express Courier Delivery</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-[11px] font-bold text-amber-400">
                Leopards
              </span>
              <span>Tracked Consignments</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-[11px] font-bold text-sky-400">
                Inspection
              </span>
              <span>Open-Box Checking Allowed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-neutral-900 bg-black/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 gap-4">
          <p>© {new Date().getFullYear()} OX Shoes Pakistan. All rights reserved | Developed by Syed Waqas Ahmad</p>
          <div className="flex items-center gap-6">
            <Link href="/about" className="hover:text-neutral-300 transition-colors">
              About Atelier
            </Link>
            <Link href="/faq" className="hover:text-neutral-300 transition-colors">
              FAQ
            </Link>
            <Link href="/privacy" className="hover:text-neutral-300 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-neutral-300 transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
