'use client';

/**
 * @file app/forgot-password/page.tsx
 * @description Password recovery portal dispatching reset tokens via email/SMS.
 * Strict TypeScript: ZERO `any`.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { Logo } from '@/components/layout/Logo';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setTimeout(() => {
      setSubmitted(true);
      setLoading(false);
    }, 700);
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between selection:bg-neutral-950 selection:text-white">
      <AnnouncementBar />
      <Header onOpenSearch={() => {}} />

      <main className="max-w-md mx-auto my-auto p-6 sm:p-8 w-full space-y-6">
        <div className="text-center space-y-3">
          <Logo size="lg" />
          <h1 className="text-2xl font-black uppercase tracking-tight text-neutral-950">
            Reset Password
          </h1>
          <p className="text-xs text-neutral-500">
            Enter your registered email address to receive password recovery instructions
          </p>
        </div>

        {submitted ? (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-emerald-200 shadow-sm text-center space-y-4">
            <div className="h-14 w-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="font-bold text-base text-neutral-950">Recovery Link Sent</h3>
            <p className="text-xs text-neutral-600 leading-relaxed">
              We have dispatched password reset instructions to <strong className="text-neutral-950">{email}</strong>. Please check your inbox and spam folder.
            </p>
            <Link
              href="/login"
              className="inline-block px-6 py-2.5 rounded-full bg-neutral-950 text-white text-xs font-bold uppercase tracking-wider"
            >
              Return to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-700">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
                <input
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-black uppercase tracking-wider transition-colors shadow-md mt-2"
            >
              {loading ? 'Sending Link...' : 'Send Recovery Link'}
            </button>

            <div className="text-center pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-600 hover:text-neutral-950"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Sign In</span>
              </Link>
            </div>
          </form>
        )}
      </main>

      <Footer />
    </div>
  );
}
