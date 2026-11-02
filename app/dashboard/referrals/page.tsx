'use client';

/**
 * @file app/dashboard/referrals/page.tsx
 * @description Dynamic customer viral referral hub & store credit wallet for OX Shoes Pakistan.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getSession } from 'next-auth/react';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { getMyWallet } from '@/actions/referral.actions';
import { formatPKR } from '@/lib/formatters/currency';
import { ReferralStatus, type IReferral, type IWalletTransaction } from '@/types';
import {
  Gift,
  Copy,
  Check,
  Users,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  History,
  Lock,
} from 'lucide-react';

interface WalletData {
  walletBalance: number;
  totalEarned: number;
  referrals: IReferral[];
  transactions: IWalletTransaction[];
  referralCode: string;
  referralLink: string;
}

export default function ReferralsPage() {
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchWallet = async () => {
    try {
      const sess = await getSession();
      if (!sess?.user) {
        setUnauthenticated(true);
        setLoading(false);
        return;
      }

      const res = await getMyWallet();
      if (res.success) {
        setWalletData(res.data);
      } else {
        setErrorMsg(res.error || 'Unable to retrieve referral wallet data.');
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred while loading your referral wallet.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const sess = await getSession();
      if (!isMounted) return;
      if (!sess?.user) {
        setUnauthenticated(true);
        setLoading(false);
        return;
      }

      try {
        const res = await getMyWallet();
        if (!isMounted) return;
        if (res.success) {
          setWalletData(res.data);
        } else {
          setErrorMsg(res.error || 'Unable to retrieve referral wallet data.');
        }
      } catch {
        if (isMounted) {
          setErrorMsg('An unexpected error occurred while loading your referral wallet.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopy = () => {
    if (!walletData?.referralLink) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(walletData.referralLink)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {
          fallbackCopyText(walletData.referralLink);
        });
    } else {
      fallbackCopyText(walletData.referralLink);
    }
  };

  const fallbackCopyText = (text: string) => {
    try {
      const input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMsg('Could not copy automatically. Please select and copy the link manually.');
    }
  };

  const approvedReferrals =
    walletData?.referrals?.filter(
      (r) => r.status === ReferralStatus.APPROVED || (r.status as string) === 'Completed'
    ) || [];

  const pendingReferrals =
    walletData?.referrals?.filter((r) => r.status === ReferralStatus.PENDING) || [];

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between selection:bg-neutral-950 selection:text-white">
      <AnnouncementBar />
      <Header onOpenSearch={() => {}} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1 space-y-8">
        {/* Navigation Tabs Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-200 pb-4 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-neutral-950">
              Referral Rewards & Wallet
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Earn store credit for every friend who orders handcrafted footwear
            </p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto text-xs font-bold">
            <Link
              href="/dashboard/profile"
              className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-full text-neutral-700"
            >
              Profile
            </Link>
            <Link
              href="/dashboard/orders"
              className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-full text-neutral-700"
            >
              Orders
            </Link>
            <Link href="/dashboard/referrals" className="px-4 py-2 bg-neutral-950 text-white rounded-full">
              Referrals
            </Link>
            <Link
              href="/dashboard/wishlist"
              className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-full text-neutral-700"
            >
              Wishlist
            </Link>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="p-12 rounded-3xl bg-white border border-neutral-200 text-center space-y-3">
            <Loader2 className="h-8 w-8 text-neutral-950 animate-spin mx-auto" />
            <p className="text-xs text-neutral-500 font-semibold">
              Loading your referral rewards & wallet data...
            </p>
          </div>
        )}

        {/* Unauthenticated State */}
        {!loading && unauthenticated && (
          <div className="p-8 sm:p-12 rounded-3xl bg-white border border-neutral-200 shadow-sm text-center space-y-4 max-w-lg mx-auto">
            <div className="h-12 w-12 rounded-full bg-amber-50 text-amber-700 mx-auto flex items-center justify-center">
              <Lock className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-black uppercase tracking-tight text-neutral-950">
                Authentication Required
              </h2>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Please sign in to your OX Shoes account to view your unique shareable referral link, available store credit, and reward history.
              </p>
            </div>
            <Link
              href="/login?callbackUrl=/dashboard/referrals"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-neutral-950 text-white text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors"
            >
              <span>Sign In Now</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* Error State */}
        {!loading && !unauthenticated && errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={fetchWallet}
              className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-900 rounded-lg text-xs font-bold transition-colors shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Main Dashboard View */}
        {!loading && !unauthenticated && walletData && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Hero Card */}
              <div className="lg:col-span-2 p-8 rounded-3xl bg-neutral-950 text-white space-y-6 shadow-xl flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400 text-neutral-950 text-xs font-black uppercase tracking-wider">
                    <Gift className="h-3.5 w-3.5" />
                    <span>Double Reward Program</span>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
                      Give 10% Off, Get PKR 200 Credit
                    </h2>
                    <p className="text-xs sm:text-sm text-neutral-300 max-w-xl leading-relaxed">
                      When your friend clicks your personal invite link and completes their first footwear purchase, they instantly receive 10% off and you receive PKR 200 wallet credit directly to your OX Shoes account!
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-400">Your Shareable Invite Link:</span>
                    {walletData.referralCode && (
                      <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                        Code: {walletData.referralCode}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 max-w-md">
                    <input
                      type="text"
                      readOnly
                      value={walletData.referralLink}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-xs font-mono text-white select-all focus:outline-none"
                    />
                    <button
                      onClick={handleCopy}
                      className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 text-emerald-950" />
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
                  <div className="text-3xl font-black text-neutral-950">
                    {formatPKR(walletData.walletBalance)}
                  </div>

                  <div className="pt-2 space-y-1 text-xs">
                    <p className="text-emerald-700 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {approvedReferrals.length} Friend{approvedReferrals.length === 1 ? '' : 's'} successfully ordered
                      </span>
                    </p>
                    {pendingReferrals.length > 0 && (
                      <p className="text-amber-700 font-medium flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span>{pendingReferrals.length} pending delivery</span>
                      </p>
                    )}
                  </div>
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

            {/* Referrals & Transactions Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Referred Friends History */}
              <div className="p-6 rounded-3xl bg-white border border-neutral-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-neutral-700" />
                    <h3 className="font-bold text-sm text-neutral-950 uppercase tracking-wider">
                      Referred Friends ({walletData.referrals.length})
                    </h3>
                  </div>
                  <span className="text-xs text-neutral-500">
                    Earned: <strong className="text-neutral-950">{formatPKR(walletData.totalEarned)}</strong>
                  </span>
                </div>

                {walletData.referrals.length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <Sparkles className="h-8 w-8 text-neutral-300 mx-auto" />
                    <p className="text-xs font-medium text-neutral-500">
                      No referrals recorded yet. Share your invite link with friends to earn store credit!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {walletData.referrals.map((ref, idx) => {
                      const isApproved =
                        ref.status === ReferralStatus.APPROVED || (ref.status as string) === 'Completed';
                      const isPending = ref.status === ReferralStatus.PENDING;

                      return (
                        <div
                          key={ref._id?.toString() || `ref-${idx}`}
                          className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50 border border-neutral-100 text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-bold text-neutral-950 block truncate">
                              {ref.referredEmail || ref.referredName || 'Friend Invitation'}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              {ref.createdAt
                                ? new Date(ref.createdAt).toLocaleDateString('en-PK', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : 'Recent'}
                            </span>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-bold text-neutral-950 block">
                              +{formatPKR(ref.rewardAmount || 200)}
                            </span>
                            {isApproved && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Approved</span>
                              </span>
                            )}
                            {isPending && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700">
                                <Clock className="h-3 w-3" />
                                <span>Pending Order</span>
                              </span>
                            )}
                            {!isApproved && !isPending && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-neutral-500">
                                <XCircle className="h-3 w-3" />
                                <span>{ref.status}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Wallet Ledger Transactions */}
              <div className="p-6 rounded-3xl bg-white border border-neutral-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-neutral-700" />
                    <h3 className="font-bold text-sm text-neutral-950 uppercase tracking-wider">
                      Wallet Ledger History ({walletData.transactions.length})
                    </h3>
                  </div>
                </div>

                {walletData.transactions.length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <ShieldCheck className="h-8 w-8 text-neutral-300 mx-auto" />
                    <p className="text-xs font-medium text-neutral-500">
                      No wallet transactions recorded yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {walletData.transactions.map((tx, idx) => {
                      const isCredit = tx.type === 'credit';

                      return (
                        <div
                          key={tx._id?.toString() || `tx-${idx}`}
                          className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50 border border-neutral-100 text-xs"
                        >
                          <div className="min-w-0 pr-2 space-y-0.5">
                            <span className="font-medium text-neutral-900 block truncate">
                              {tx.description || 'Wallet transaction'}
                            </span>
                            <span className="text-[10px] text-neutral-400 block font-mono">
                              {tx.createdAt
                                ? new Date(tx.createdAt).toLocaleDateString('en-PK', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : 'Recent'}
                            </span>
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className={`font-black block ${
                                isCredit ? 'text-emerald-700' : 'text-neutral-900'
                              }`}
                            >
                              {isCredit ? '+' : '-'}{formatPKR(tx.amount)}
                            </span>
                            <span className="text-[10px] text-neutral-500 font-mono">
                              Bal: {formatPKR(tx.balanceAfter)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
