'use client';

/**
 * @file app/verify-invoice/[token]/page.tsx
 * @description Public, non-authenticated invoice verification portal for Bajaur OX Shoes.
 * Validates cryptographically secure invoice tokens and displays public authenticity status
 * without exposing any customer PII or sensitive financial data.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { verifyInvoiceToken, type PublicInvoiceVerificationDTO } from '@/actions/order.actions';
import { Logo } from '@/components/layout/Logo';
import {
  ShieldCheck,
  XCircle,
  ArrowLeft,
  CheckCircle2,
  Building2,
  Calendar,
  PackageCheck,
  Lock,
} from 'lucide-react';

interface VerifyInvoicePageProps {
  params: Promise<{ token: string }>;
}

export default function VerifyInvoicePage({ params }: VerifyInvoicePageProps) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [verification, setVerification] = useState<PublicInvoiceVerificationDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function performVerification() {
      setLoading(true);
      setError(null);

      const res = await verifyInvoiceToken(token);
      if (!res.success) {
        setError(res.error || 'Invoice verification failed. Invalid or expired token.');
      } else if (res.data) {
        setVerification(res.data);
      } else {
        setError('Invoice verification failed. Invalid response.');
      }
      setLoading(false);
    }

    performVerification();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-neutral-900 mb-4" />
        <p className="text-xs font-bold text-neutral-600 uppercase tracking-widest">
          Verifying Official Invoice Authenticity...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100/90 text-neutral-900 py-12 px-4 sm:px-6">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Top Header Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-600 hover:text-neutral-950 transition-colors bg-white px-3.5 py-2 rounded-xl border border-neutral-300 shadow-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Home
          </Link>
          <Logo size="sm" />
        </div>

        {/* Verification Card */}
        <div className="bg-white rounded-2xl border border-neutral-300 shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
          {verification && !error ? (
            <>
              {/* Status Header */}
              <div className="text-center space-y-3 pb-6 border-b border-neutral-200">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mb-1">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase tracking-wider border border-emerald-300">
                  Official Authentic Invoice
                </div>
                <h1 className="text-2xl font-black text-neutral-950 tracking-tight">
                  Invoice Verified
                </h1>
                <p className="text-xs text-neutral-500 max-w-md mx-auto">
                  This digital record confirms that the invoice was legitimately issued by Bajaur OX Shoes.
                </p>
              </div>

              {/* Public Verification Details */}
              <div className="space-y-4 text-xs">
                <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500 font-medium">Invoice Masked Ref:</span>
                    <span className="font-mono font-bold text-neutral-950">{verification.maskedInvoiceRef}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-neutral-200 pt-2">
                    <span className="text-neutral-500 font-medium">Issuer / Merchant:</span>
                    <span className="font-bold text-neutral-900">{verification.sellerName}</span>
                  </div>
                </div>

                {/* Seller Store Details */}
                <div className="flex items-start gap-3 p-4 bg-amber-50/60 rounded-xl border border-amber-200/80">
                  <Building2 className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-amber-950 text-xs">{verification.sellerName}</p>
                    <p className="text-[11px] text-amber-900/80">{verification.sellerLocation}</p>
                  </div>
                </div>

                {/* Privacy Safeguard Notice */}
                <div className="flex items-start gap-3 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-600">
                  <Lock className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>Privacy Protected:</strong> Customer personal information (name, address, contact details) and individual item pricing are excluded from this public verification view to protect customer confidentiality.
                  </p>
                </div>
              </div>

              {/* Timestamp */}
              <div className="text-center pt-2 text-[10px] text-neutral-400 font-mono">
                Verified at: {new Date(verification.verificationTimestamp).toLocaleString('en-GB')}
              </div>
            </>
          ) : (
            /* Error / Invalid Token View */
            <div className="text-center space-y-4 py-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600">
                <XCircle className="w-10 h-10" />
              </div>
              <div className="inline-block px-3 py-1 rounded-full bg-red-100 text-red-800 text-[11px] font-black uppercase tracking-wider border border-red-300">
                Verification Failed
              </div>
              <h1 className="text-xl font-bold text-neutral-950">Invalid or Expired Token</h1>
              <p className="text-xs text-neutral-500 max-w-md mx-auto">
                {error || 'The requested verification token could not be found or validated.'}
              </p>
              <div className="pt-4">
                <Link
                  href="/"
                  className="inline-block px-6 py-2.5 rounded-full bg-neutral-950 text-white text-xs font-bold hover:bg-neutral-800 transition-colors"
                >
                  Return to Storefront
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
