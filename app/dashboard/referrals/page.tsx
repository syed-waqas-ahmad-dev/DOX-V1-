'use client';

/**
 * @file app/dashboard/referrals/page.tsx
 * @description Customer viral referral hub & PKR 500 store credit wallet.
 * Strict TypeScript: ZERO `any`.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { Gift, Copy, Check, Users, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { formatPKR } from '@/lib/formatters/currency';

export default function ReferralsPage() {
  const [copied, setCopied] = useState(false);
  const referralCode = 'OX-HAMZA8';

  const handleCopy = () => {
    navigator.clipboard.writeText(`https://oxshoes.pk?ref=${referralCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between selection:bg-neutral-950 selection:text-white">
      <AnnouncementBar />
      <Header onOpenSearch={() => {}} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-200 pb-4 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-neutral-950">
              Referral Rewards & Wallet
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Earn PKR 500 store credit for every friend who orders handcrafted footwear
            </p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto text-xs font-bold">
            <Link href="/dashboard/profile" className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-full text-neutral-700">
              Profile
            </Link>
            <Link href="/dashboard/orders" className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-full text-neutral-700">
              Orders
            </Link>
            <Link href="/dashboard/referrals" className="px-4 py-2 bg-neutral-950 text-white rounded-full">
              Referrals
            </Link>
            <Link href="/dashboard/wishlist" className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-full text-neutral-700">
              Wishlist
            </Link>
          </div>
        </div>

        {/* Hero Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-8 rounded-3xl bg-neutral-950 text-white space-y-6 shadow-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400 text-neutral-950 text-xs font-black uppercase tracking-wider">
              <Gift className="h-3.5 w-3.5" />
              <span>Double Reward Program</span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
                Give 10% Off, Get PKR 500 Credit
              </h2>
              <p className="text-xs sm:text-sm text-neutral-300 max-w-xl leading-relaxed">
                When your friend clicks your personal invite link and completes their first footwear purchase, they instantly receive 10% off and you receive PKR 500 wallet credit directly to your OX Shoes account!
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-neutral-400">Your Shareable Invite Link:</span>
              <div className="flex items-center gap-2 max-w-md">
                <input
                  type="text"
                  readOnly
                  value={`https://oxshoes.pk?ref=${referralCode}`}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-xs font-mono text-white select-all focus:outline-none"
                />
                <button
                  onClick={handleCopy}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-800" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Wallet Balance Card */}
          <div className="p-8 rounded-3xl bg-white border border-neutral-200 shadow-sm flex flex-col justify-between space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Available Store Credit
              </span>
              <div className="text-3xl font-black text-neutral-950">{formatPKR(1500)}</div>
              <p className="text-xs text-emerald-700 font-semibold">
                ✓ 3 Friends successfully ordered
              </p>
            </div>

            <div className="space-y-2 pt-4 border-t border-neutral-100">
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Automatically applied at checkout as a flat discount off your next shoe order.
              </p>
              <Link
                href="/shop"
                className="w-full py-2.5 rounded-full bg-neutral-950 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors"
              >
                <span>Redeem Credit</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
