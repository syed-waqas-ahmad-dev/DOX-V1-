'use client';

/**
 * @file app/signup/page.tsx
 * @description Customer registration page for OX Shoes with viral referral code support.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { Logo } from '@/components/layout/Logo';
import { registerUser } from '@/actions/auth.actions';
import { Lock, Mail, User, Phone, Tag, ArrowRight, AlertCircle, CheckCircle2, Gift } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+923');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [hasReferralBonus, setHasReferralBonus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const refParam = params.get('ref');
      const cookieMatch = document.cookie.match(/ref_code=([^;]+)/);
      const code = refParam || (cookieMatch ? cookieMatch[1] : null);
      if (code) {
        const upper = code.toUpperCase();
        queueMicrotask(() => {
          setReferralCode(upper);
          setHasReferralBonus(true);
        });
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone || !password) return;

    if (!/^\+923\d{9}$/.test(phone)) {
      setErrorMsg('Please enter a valid Pakistani mobile number (+923XXXXXXXXX).');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const res = await registerUser({
      name,
      email,
      phone,
      password,
      referralCode: referralCode || undefined,
    });
    setLoading(false);

    if (res.success) {
      setSuccessMsg('Account created successfully! Welcome to OX Shoes. Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 1200);
    } else {
      setErrorMsg(res.error || 'Failed to create account. Please check your details.');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between selection:bg-neutral-950 selection:text-white">
      <AnnouncementBar />
      <Header onOpenSearch={() => {}} />

      <main className="max-w-md mx-auto my-auto p-6 sm:p-8 w-full space-y-6">
        <div className="text-center space-y-3">
          <Logo size="lg" />
          <h1 className="text-2xl font-black uppercase tracking-tight text-neutral-950">
            Create an Account
          </h1>
          <p className="text-xs text-neutral-500">
            Join the OX Shoes family and receive 10% off your first footwear purchase
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {hasReferralBonus && (
          <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center gap-2.5">
            <Gift className="h-4 w-4 text-amber-700 shrink-0" />
            <div>
              <strong className="block font-bold">Friend Invitation Activated!</strong>
              <span>You will receive an automatic 10% discount on your first footwear purchase.</span>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-700">Full Name *</label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                required
                placeholder="Hamza Bilal Qureshi"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-700">Email Address *</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
              <input
                type="email"
                required
                placeholder="hamza@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-700">WhatsApp Mobile Number (+923XXXXXXXXX) *</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                required
                placeholder="+923XXXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-700">Password (min 6 characters) *</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-700">Referral Code (Optional)</label>
            <div className="relative">
              <Tag className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="e.g. OX-HAMZA8"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950 uppercase font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-black uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2 mt-2"
          >
            <span>{loading ? 'Creating Account...' : 'Register Account'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="text-center text-xs text-neutral-500">
          Already have an account?{' '}
          <Link href="/login" className="font-bold text-neutral-950 hover:underline">
            Sign In here
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
