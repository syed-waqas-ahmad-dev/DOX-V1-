'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log client error to console
    console.error('App Router Caught Error:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-12 text-center bg-neutral-950 text-white">
      <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 mb-4">
        <AlertCircle className="w-10 h-10" />
      </div>
      <h1 className="text-3xl font-black tracking-tight text-white mb-2">Something went wrong</h1>
      <p className="text-sm text-neutral-400 max-w-md mb-8 leading-relaxed">
        An unexpected error occurred while loading this page. You can try refreshing the view or returning to the storefront.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Try Again</span>
        </button>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs border border-neutral-700 transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Back to Store</span>
        </Link>
      </div>
    </div>
  );
}
