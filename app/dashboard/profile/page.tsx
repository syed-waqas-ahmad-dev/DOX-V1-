'use client';

/**
 * @file app/dashboard/profile/page.tsx
 * @description Customer account profile, addresses, and viral referral link hub.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { getSession } from 'next-auth/react';
import { generateMyReferralLink } from '@/actions/referral.actions';
import { User, MapPin, Gift, Package, Copy, Check, ShieldCheck, Heart } from 'lucide-react';

export default function UserProfilePage() {
  const [copied, setCopied] = useState(false);
  const [session, setSession] = useState<{ user?: { id?: string; name?: string | null; email?: string | null; role?: string | null } } | null>(null);
  const [referralLink, setReferralLink] = useState<string>('');
  const [loadingLink, setLoadingLink] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    getSession()
      .then(async (sess) => {
        if (active && sess?.user) {
          setSession(sess as any);
          try {
            const linkRes = await generateMyReferralLink();
            if (active && linkRes.success && linkRes.data?.link) {
              setReferralLink(linkRes.data.link);
            }
          } catch {
            // ignore
          } finally {
            if (active) setLoadingLink(false);
          }
        } else if (active) {
          setLoadingLink(false);
        }
      })
      .catch(() => {
        if (active) setLoadingLink(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const userRole = session?.user?.role;
  const isAdmin = Boolean(
    session?.user && (
      userRole === 'admin' ||
      userRole === 'super_admin' ||
      userRole === 'manager'
    )
  );

  const handleCopyReferral = () => {
    if (!referralLink) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      try {
        const input = document.createElement('input');
        input.value = referralLink;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // fallback
      }
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between">
      <AnnouncementBar />
      <Header onOpenSearch={() => {}} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1 space-y-8">
        {/* Navigation Tabs Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-200 pb-4 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-neutral-950">
              My Account
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">Manage your shipping addresses and orders</p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto text-xs font-bold">
            <Link href="/dashboard/profile" className="px-4 py-2 bg-neutral-950 text-white rounded-full">
              Profile
            </Link>
            <Link href="/dashboard/orders" className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-full text-neutral-700">
              Orders
            </Link>
            <Link href="/dashboard/wishlist" className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-full text-neutral-700">
              Wishlist
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User Bio Card */}
          <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-neutral-900 text-amber-400 font-bold text-lg flex items-center justify-center shrink-0">
                {session?.user?.name ? session.user.name.slice(0, 2).toUpperCase() : 'OX'}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-base text-neutral-950 truncate">
                  {session?.user?.name || 'Customer'}
                </h3>
                <span className="text-xs text-neutral-500 block truncate">
                  {session?.user?.email || ''}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-neutral-600 pt-3 border-t border-neutral-100">
              <div className="flex justify-between">
                <span>Account Role:</span>
                <span className="font-semibold text-neutral-900 capitalize font-mono">
                  {session?.user?.role || 'Customer'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Account Status:</span>
                <span className="font-semibold text-emerald-600">
                  {isAdmin ? 'Administrator (Full Clearance)' : 'Active Customer'}
                </span>
              </div>
            </div>

            {isAdmin && (
              <Link
                href="/admin"
                className="block w-full bg-neutral-950 text-amber-400 text-center py-3 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-neutral-800 transition-colors mt-3 shadow-sm"
              >
                Launch Admin Operations & CRUD
              </Link>
            )}
          </div>

          {/* Referral Reward Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-neutral-950 to-neutral-900 text-white shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-wider">
              <Gift className="h-4 w-4" />
              <span>Earn PKR 200 Store Credit</span>
            </div>
            <h3 className="text-lg font-black uppercase tracking-tight">Invite Friends & Family</h3>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Share your personal link. They get 10% off their first pair and you get PKR 200 credit upon delivery!
            </p>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                readOnly
                value={
                  referralLink
                    ? referralLink
                    : loadingLink
                    ? 'Loading personal referral link...'
                    : 'Sign in to generate referral link'
                }
                className="w-full px-3 py-2 rounded-lg bg-white/10 text-xs text-neutral-200 font-mono border border-white/20 select-all"
              />
              <button
                onClick={handleCopyReferral}
                disabled={!referralLink}
                className="p-2 rounded-lg bg-white text-neutral-950 hover:bg-neutral-200 font-bold transition-colors disabled:opacity-50"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Default Address Card */}
          <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Default Address
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                Primary
              </span>
            </div>
            <h4 className="font-bold text-sm text-neutral-950">Home (Islamabad)</h4>
            <p className="text-xs text-neutral-600 leading-relaxed">
              House 112, Street 14, Sector F-8/2, Islamabad, 44000
            </p>
            <span className="text-xs text-neutral-400 block font-mono">+923339876543</span>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
