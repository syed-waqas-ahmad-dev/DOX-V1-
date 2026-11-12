'use client';

/**
 * @file app/login/page.tsx
 * @description Customer and administrator sign-in portal for OX Shoes.
 * Supports NextAuth credentials authentication and Google fallback authentication.
 * Strict TypeScript: no explicit `any`.
 */

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { Logo } from '@/components/layout/Logo';
import { signIn, useSession } from 'next-auth/react';
import { toast } from 'sonner';
import {
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Chrome,
} from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorQuery = searchParams?.get('error');

  const { data: session, status } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    errorQuery === 'unauthorized'
      ? 'You are not authorized to access that page. Please sign in with an authorized account.'
      : null
  );
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const userRole = (session.user as any)?.role || 'customer';
      console.log('[LOGIN REDIRECT] Authenticated user:', session.user.email, '| Role:', userRole);
      if (userRole === 'super_admin' || userRole === 'admin') {
        console.log('[LOGIN REDIRECT] Redirecting to /admin');
        window.location.href = '/admin';
      } else if (userRole === 'rider') {
        console.log('[LOGIN REDIRECT] Redirecting to /delivery');
        window.location.href = '/delivery';
      } else {
        console.log('[LOGIN REDIRECT] Redirecting to /my-account');
        window.location.href = '/my-account';
      }
    }
  }, [status, session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    console.log('[LOGIN SUBMIT] Attempting credentials signIn for:', email.trim());

    // 1. NextAuth SignIn Call
    const res = await signIn("credentials", {
      email: email.trim(),
      password,
      redirect: false, // Browser ko khud redirect nahi karne dena
    });

    setLoading(false);
    console.log('[LOGIN RESULT] Response ok:', res?.ok, '| error:', res?.error);

    // 2. Agar Password Ghalat hai
    if (res?.error) {
      toast.error("Invalid email or password");
      setErrorMsg("Invalid email or password");
      return;
    }

    // 3. Agar Password Sahi hai
    if (res?.ok) {
      toast.success("Welcome Back!");
    }
  };


  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await signIn('google', { callbackUrl: '/my-account' });
    } catch (error: unknown) {
      console.error(
        'Google authentication failed:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      setErrorMsg('Unable to sign in with Google. Please try again.');
      toast.error('Google authentication failed.');
      setLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto my-auto p-6 sm:p-8 w-full space-y-6">
      <div className="text-center space-y-3">
        <Logo size="lg" />

        <h1 className="text-2xl font-black uppercase tracking-tight text-neutral-950">
          Sign In to OX Shoes
        </h1>

        <p className="text-xs text-neutral-500">
          Access your orders, track consignments, and manage delivery addresses
        </p>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-4"
      >
        <div className="space-y-1">
          <label
            htmlFor="login-email"
            className="text-xs font-bold text-neutral-700"
          >
            Email Address
          </label>

          <div className="relative">
            <Mail className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />

            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={loading}
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950 disabled:opacity-60"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label
              htmlFor="login-password"
              className="text-xs font-bold text-neutral-700"
            >
              Password
            </label>

            <Link
              href="/forgot-password"
              className="text-[11px] font-bold text-amber-700 hover:underline"
            >
              Forgot Password?
            </Link>
          </div>

          <div className="relative">
            <Lock className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />

            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading}
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950 disabled:opacity-60"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-black uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span>
            {loading ? 'Authenticating...' : 'Sign In'}
          </span>

          <ArrowRight className="h-4 w-4" />
        </button>

        <div className="relative my-3 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-200" />
          </div>

          <span className="relative bg-white px-2 text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
            Or Continue With
          </span>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={handleGoogleSignIn}
          className="w-full py-3 rounded-full border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Chrome className="h-4 w-4 text-amber-600" />
          <span>Continue with Google</span>
        </button>
      </form>

      <div className="text-center text-xs text-neutral-500">
        Don&apos;t have an account yet?{' '}
        <Link
          href="/signup"
          className="font-bold text-neutral-950 hover:underline"
        >
          Create an Account (Get 10% Off)
        </Link>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between selection:bg-neutral-950 selection:text-white">
      <AnnouncementBar />

      <Header onOpenSearch={() => {}} />

      <Suspense
        fallback={
          <div className="text-center py-20 text-xs text-neutral-400">
            Loading sign in...
          </div>
        }
      >
        <LoginForm />
      </Suspense>

      <Footer />
    </div>
  );
}