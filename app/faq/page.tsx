'use client';

/**
 * @file app/faq/page.tsx
 * @description Frequently Asked Questions covering Pakistani COD, sizing, delivery, and exchange.
 * Strict TypeScript: ZERO `any`.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { WhatsAppWidget } from '@/components/layout/WhatsAppWidget';
import { ChevronDown, HelpCircle, Phone, ArrowRight } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
  category: 'sizing' | 'shipping' | 'payments' | 'returns';
}

const FAQS: FAQItem[] = [
  {
    category: 'sizing',
    question: 'How do I choose the right size for Peshawari Chappals?',
    answer:
      'We recommend choosing your standard European dress shoe size (e.g., 40, 41, 42, 43, 44). Full-grain leather naturally conforms to the contours of your foot after 2-3 wears. If you have particularly broad feet, our artisans recommend staying true to your standard size as the straps have comfortable flex.',
  },
  {
    category: 'shipping',
    question: 'How long does delivery take across Pakistan?',
    answer:
      'Orders inside Lahore are delivered in 1 to 2 working days. Karachi, Islamabad, Rawalpindi, and Faisalabad take 2 to 3 working days via TCS Air Cargo. Smaller cities and remote tehsils take 3 to 4 working days.',
  },
  {
    category: 'payments',
    question: 'Is Cash on Delivery (COD) available in my city?',
    answer:
      'Yes! Cash on Delivery is available across 200+ cities and tehsils in Pakistan via TCS Express and Leopards Courier. You only pay cash to the rider once the parcel is handed over at your doorstep.',
  },
  {
    category: 'payments',
    question: 'Can I open and inspect the shoe box before paying COD?',
    answer:
      'Absolutely! We allow open-box parcel inspection at your doorstep. You can inspect the craftsmanship, leather quality, and verify your pair before handing over cash to the TCS or Leopards rider.',
  },
  {
    category: 'returns',
    question: 'What is your 7-Day Size Exchange policy?',
    answer:
      'If your shoes do not fit comfortably, you can request an instant size exchange through our Returns Portal within 7 days of delivery. TCS Express will collect the unworn shoes from your doorstep in their original box and deliver your replacement size free of charge.',
  },
  {
    category: 'sizing',
    question: 'How should I care for my full-grain leather shoes?',
    answer:
      'Wipe down your shoes with a dry cotton cloth after wearing. Apply neutral beeswax or natural leather conditioning cream once every 3-4 months to keep the bovine hide soft and water-resistant. Free lifetime leather conditioning is available at all our physical flagship boutiques.',
  },
];

export default function FAQPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredFaqs =
    activeCategory === 'all'
      ? FAQS
      : FAQS.filter((f) => f.category === activeCategory);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between selection:bg-neutral-950 selection:text-white">
      <AnnouncementBar />
      <Header onOpenSearch={() => {}} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full flex-1 space-y-10">
        <div className="text-center space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 px-3.5 py-1 rounded-full inline-block">
            Customer Help Desk
          </span>
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-neutral-950">
            Frequently Asked Questions
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 max-w-lg mx-auto">
            Everything you need to know about shoe sizing, Cash on Delivery, and our 7-day nationwide size exchange.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2 text-xs font-bold">
          {[
            { id: 'all', label: 'All Questions' },
            { id: 'sizing', label: 'Sizing & Fit' },
            { id: 'shipping', label: 'Delivery & TCS' },
            { id: 'payments', label: 'COD & Wallets' },
            { id: 'returns', label: '7-Day Exchange' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-full transition-all ${
                activeCategory === cat.id
                  ? 'bg-neutral-950 text-white shadow-sm'
                  : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Accordion List */}
        <div className="space-y-3">
          {filteredFaqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-sm text-neutral-950 hover:bg-neutral-50/50"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-neutral-500 shrink-0 transition-transform ${
                      isOpen ? 'rotate-180 text-neutral-950' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs text-neutral-600 leading-relaxed border-t border-neutral-100 bg-neutral-50/30">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Still have questions banner */}
        <div className="p-6 rounded-2xl bg-neutral-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
          <div className="space-y-1">
            <h3 className="font-bold text-sm uppercase">Still need assistance?</h3>
            <p className="text-xs text-neutral-300">
              Our Lahore atelier concierge team is available Mon-Sat, 10 AM to 9 PM PST.
            </p>
          </div>
          <a
            href="https://wa.me/923001234567"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shrink-0"
          >
            <Phone className="h-4 w-4" />
            <span>Chat on WhatsApp</span>
          </a>
        </div>
      </main>

      <WhatsAppWidget />
      <Footer />
    </div>
  );
}
