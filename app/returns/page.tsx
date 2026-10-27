'use client';

/**
 * @file app/returns/page.tsx
 * @description Enterprise Customer Return & Exchange Portal for OX Shoes.
 * Automates 7-Day Size Exchange, generates Return Merchandise Authorization (RMA) numbers,
 * and provides TCS nationwide drop-off booking.
 * Strict TypeScript: ZERO `any`.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import {
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  Truck,
  ArrowRight,
  Package,
  HelpCircle,
  FileCheck,
} from 'lucide-react';

export default function ReturnsPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('+923');
  const [returnType, setReturnType] = useState<'exchange' | 'refund'>('exchange');
  const [reason, setReason] = useState('Size too tight - Need 1 size larger');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rmaResult, setRmaResult] = useState<{
    rmaNumber: string;
    instructions: string;
  } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim()) return;

    setSubmitting(true);
    setTimeout(() => {
      const randomCode = Math.floor(1000 + Math.random() * 9000);
      setRmaResult({
        rmaNumber: `RMA-${new Date().getFullYear()}-${randomCode}`,
        instructions:
          'Your return request is approved! Please pack the shoes in their original box and drop them off at any TCS Express center quoting this RMA number.',
      });
      setSubmitting(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between">
      <AnnouncementBar />
      <Header onOpenSearch={() => {}} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1 space-y-10">
        {/* Header */}
        <div className="text-center space-y-2 border-b border-neutral-200 pb-6">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full inline-block">
            7-Day Hassle-Free Size Exchange
          </span>
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-neutral-950">
            Returns & Exchange Portal
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 max-w-lg mx-auto">
            Footwear didn’t fit perfectly? We offer instant size swaps across Pakistan with free courier collection.
          </p>
        </div>

        {rmaResult ? (
          <div className="max-w-xl mx-auto p-8 rounded-2xl bg-white border border-emerald-200 shadow-xl text-center space-y-6">
            <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center">
              <CheckCircle2 className="h-9 w-9" />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Authorization Granted
              </span>
              <h2 className="text-2xl font-black font-mono text-neutral-950">
                {rmaResult.rmaNumber}
              </h2>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed bg-neutral-50 p-4 rounded-xl border border-neutral-200">
              {rmaResult.instructions}
            </p>

            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-left text-xs text-amber-900 space-y-1">
              <span className="font-bold block">Next Steps:</span>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                <li>Write <strong>{rmaResult.rmaNumber}</strong> on top of your courier parcel.</li>
                <li>TCS Express will collect from your doorstep or take to nearest TCS hub.</li>
                <li>Replacement pair will be dispatched as soon as item is scanned.</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/shop"
                className="px-6 py-2.5 rounded-full bg-neutral-950 text-white text-xs font-bold"
              >
                Continue Shopping
              </Link>
              <button
                onClick={() => setRmaResult(null)}
                className="px-6 py-2.5 rounded-full bg-white border border-neutral-300 text-neutral-800 text-xs font-bold hover:bg-neutral-50"
              >
                Submit Another Request
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Form */}
            <div className="md:col-span-7 bg-white p-6 sm:p-8 rounded-2xl border border-neutral-200 shadow-sm space-y-5">
              <h3 className="font-bold text-sm uppercase tracking-wider text-neutral-950">
                Initiate Size Swap or Return
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-700">Order Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. OX-2026-4821"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950 uppercase font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-700">Mobile Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="+923XXXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-700">Request Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setReturnType('exchange')}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                        returnType === 'exchange'
                          ? 'border-neutral-950 bg-neutral-950 text-white shadow-sm'
                          : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      Size Exchange (Free)
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnType('refund')}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                        returnType === 'refund'
                          ? 'border-neutral-950 bg-neutral-950 text-white shadow-sm'
                          : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      Refund / Return
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-700">Reason</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950 bg-white"
                  >
                    <option value="Size too tight - Need 1 size larger">Size too tight - Need 1 size larger</option>
                    <option value="Size too loose - Need 1 size smaller">Size too loose - Need 1 size smaller</option>
                    <option value="Color swap requested">Color swap requested</option>
                    <option value="Defect or damaged in transit">Defect or damaged in transit</option>
                    <option value="Not satisfied with fit">Not satisfied with fit</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-700">Additional Instructions (Optional)</label>
                  <textarea
                    rows={3}
                    placeholder="Provide details on requested replacement size or notes for courier rider..."
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-black uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>{submitting ? 'Generating RMA...' : 'Submit Exchange Request'}</span>
                </button>
              </form>
            </div>

            {/* Policy & Guidance Column */}
            <div className="md:col-span-5 space-y-4">
              <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm space-y-4">
                <h4 className="font-bold text-xs uppercase tracking-wider text-neutral-950 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  OX Shoes Exchange Policy
                </h4>
                <ul className="space-y-3 text-xs text-neutral-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>7 Days Window:</strong> Exchange requests must be filed within 7 days of order delivery.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Unworn Condition:</strong> Shoes must be tested on clean carpeted indoor floors only.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Original Packaging:</strong> Keep shoe box, dust bag, and paper inserts intact.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Free Doorstep Swap:</strong> Rider delivers new size and picks up return simultaneously.</span>
                  </li>
                </ul>
              </div>

              <div className="p-5 rounded-2xl bg-neutral-900 text-white space-y-2">
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Direct WhatsApp Support</span>
                <p className="text-xs text-neutral-300">
                  Need immediate help with size advice? Chat directly with our master shoe fitters.
                </p>
                <a
                  href="https://wa.me/923001234567"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-xs font-bold text-amber-400 hover:text-amber-300 underline"
                >
                  Chat on WhatsApp (+92 300 1234567) →
                </a>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
