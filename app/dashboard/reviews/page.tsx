'use client';

/**
 * @file app/dashboard/reviews/page.tsx
 * @description Customer verified review history and rating contributions.
 * Strict TypeScript: ZERO `any`.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { Star, CheckCircle2, ThumbsUp, ArrowRight } from 'lucide-react';

interface UserReviewItem {
  id: string;
  shoeName: string;
  rating: number;
  title: string;
  comment: string;
  date: string;
  helpfulCount: number;
}

const INITIAL_REVIEWS: UserReviewItem[] = [
  {
    id: 'rev-1',
    shoeName: 'Kaptaan Special Peshawari Chappal Double Sole',
    rating: 5,
    title: 'Original Kaptaan double sole quality!',
    comment:
      'SubhanAllah outstanding craftsmanship. The leather is genuine full grain and the tyre sole is tough as nails. Delivered in Islamabad in 2 days via TCS.',
    date: 'March 2026',
    helpfulCount: 14,
  },
];

export default function UserReviewsPage() {
  const [reviews] = useState(INITIAL_REVIEWS);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between selection:bg-neutral-950 selection:text-white">
      <AnnouncementBar />
      <Header onOpenSearch={() => {}} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1 space-y-8">
        <div className="border-b border-neutral-200 pb-4">
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-neutral-950">
            My Product Reviews ({reviews.length})
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Verified ratings helping Pakistani shoe buyers make informed footwear choices
          </p>
        </div>

        <div className="space-y-4">
          {reviews.map((rev) => (
            <div
              key={rev.id}
              className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                <h3 className="font-bold text-sm text-neutral-950">{rev.shoeName}</h3>
                <span className="text-xs text-neutral-400">{rev.date}</span>
              </div>

              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i < rev.rating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-neutral-300'
                    }`}
                  />
                ))}
                <span className="text-xs font-bold text-neutral-800 ml-2">{rev.title}</span>
              </div>

              <p className="text-xs text-neutral-600 leading-relaxed">{rev.comment}</p>

              <div className="pt-2 flex items-center justify-between text-[11px] text-neutral-500">
                <span className="flex items-center gap-1 text-emerald-700 font-bold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Verified Purchase</span>
                </span>
                <span className="flex items-center gap-1 font-medium">
                  <ThumbsUp className="h-3 w-3" />
                  <span>{rev.helpfulCount} customers found this helpful</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
