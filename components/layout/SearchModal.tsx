'use client';

/**
 * @file components/layout/SearchModal.tsx
 * @description Cmd+K instant modal search for OX Shoes storefront.
 * Features live debounce search, Urdu keyword queries, popular tags, and direct product navigation.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { formatPKR } from '@/lib/formatters/currency';
import { Search, X, TrendingUp, ArrowRight, Loader2 } from 'lucide-react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResultItem {
  name: string;
  nameUr: string;
  slug: string;
  price: number;
  image: string;
  subCategory: string;
}

const POPULAR_SEARCHES = [
  'Kaptaan Peshawari Chappal',
  'Multani Khussa',
  'Executive Oxford',
  'Margalla Joggers',
  'Charsadda Chappal',
  'Double Sole',
];

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleClose = useCallback(() => {
    setQuery('');
    setResults([]);
    onClose();
  }, [onClose]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) handleClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Live search query with debounce
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        setResults(data.products || []);
      } catch (err: unknown) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    handleClose();
    router.push(`/shop?search=${encodeURIComponent(query.trim())}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden text-neutral-900 z-10">
        {/* Search Input Bar */}
        <form onSubmit={handleSubmit} className="relative border-b border-neutral-200 flex items-center px-4">
          <Search className="h-5 w-5 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search shoes by name, Urdu (پشاوری چپل), style, or brand..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-4 text-sm sm:text-base bg-transparent focus:outline-none placeholder:text-neutral-400 font-medium"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-neutral-400 shrink-0 mr-2" />}
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </form>

        {/* Results / Popular Suggestions */}
        <div className="p-4 sm:p-6 max-h-[60vh] overflow-y-auto">
          {query.trim().length === 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
                <TrendingUp className="h-3.5 w-3.5" />
                Popular Searches
              </div>
              <div className="flex flex-wrap gap-2">
                {POPULAR_SEARCHES.map((term) => (
                  <button
                    key={term}
                    onClick={() => {
                      setQuery(term);
                    }}
                    className="px-3 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-xs font-medium text-neutral-800 transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
                Footwear Matches ({results.length})
              </div>
              <div className="divide-y divide-neutral-100">
                {results.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/product/${item.slug}`}
                    onClick={onClose}
                    className="py-3 flex items-center justify-between gap-4 hover:bg-neutral-50 px-2 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 bg-neutral-100 rounded-md overflow-hidden shrink-0 border border-neutral-200">
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            referrerPolicy="no-referrer"
                            className="object-cover"
                            sizes="48px"
                          />
                        ) : null}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-neutral-900 group-hover:text-black line-clamp-1">
                          {item.name}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-neutral-500">
                          <span>{item.subCategory}</span>
                          {item.nameUr && (
                            <span className="text-neutral-400" dir="rtl">
                              • {item.nameUr}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm text-neutral-950">
                        {formatPKR(item.price)}
                      </span>
                      <ArrowRight className="h-4 w-4 text-neutral-400 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : !loading ? (
            <div className="py-8 text-center text-neutral-500 text-xs">
              No shoes found matching &quot;{query}&quot;. Try checking for spelling or search a category like &quot;Peshawari&quot; or &quot;Khussa&quot;.
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 bg-neutral-50 border-t border-neutral-100 text-[11px] text-neutral-500 flex items-center justify-between">
          <span>Press <strong>Enter</strong> to search all products</span>
          <span>Press <strong>ESC</strong> to dismiss</span>
        </div>
      </div>
    </div>
  );
}
