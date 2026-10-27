'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global Error caught:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-neutral-950 text-white min-h-screen flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-black text-amber-500">Application Error</h1>
          <p className="text-sm text-neutral-400">
            A critical application error occurred. Click below to reload.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="px-4 py-2 bg-amber-500 text-neutral-950 font-bold rounded-xl text-xs hover:bg-amber-400"
            >
              Reload Page
            </button>
            <Link
              href="/"
              className="px-4 py-2 bg-neutral-800 text-neutral-200 font-bold rounded-xl text-xs border border-neutral-700 hover:bg-neutral-700"
            >
              Storefront
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
