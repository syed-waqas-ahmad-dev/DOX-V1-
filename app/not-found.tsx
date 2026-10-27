import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-black text-amber-600 mb-2">404</h1>
      <h2 className="text-2xl font-bold text-stone-900 mb-4">Page Not Found</h2>
      <p className="text-stone-600 max-w-md mb-6">
        Sorry, the page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="px-6 py-2.5 rounded-lg bg-stone-900 text-white font-medium hover:bg-stone-800 transition"
      >
        Back to Home
      </Link>
    </div>
  );
}
