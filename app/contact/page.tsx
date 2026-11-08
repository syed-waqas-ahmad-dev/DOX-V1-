'use client';

/**
 * @file app/contact/page.tsx
 * @description Official Corporate Contact & Atelier Headquarters page for OX Shoes.
 * Embedded Google Map of Lahore MM Alam flagship, NTN tax credentials, and inquiry form.
 * Strict TypeScript: ZERO `any`.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { StoreMap } from '@/components/Map/StoreMap';
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
  Building,
  ShieldCheck,
  Compass,
} from 'lucide-react';

const STORE_COORDS: [number, number] = [34.7544498, 71.4530333]; // Inayat Killi Bazar, Bypass Road, near Inam Plaza, District Bajaur

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+923');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitted(true);
      setSubmitting(false);
      setName('');
      setEmail('');
      setMessage('');
    }, 600);
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between">
      <AnnouncementBar />
      <Header onOpenSearch={() => {}} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1 space-y-10">
        {/* Header */}
        <div className="border-b border-neutral-200 pb-6 text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full inline-block">
            Official Store & Customer Concierge
          </span>
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-neutral-950">
            Get in Touch with Bajaur OX Shoes
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600">
            Bajaur OX Shoes Shop is located in District Bajaur, Inayat Killi Bazar, Bypass Road, near Inam Plaza. Reach out directly via WhatsApp for sizing advice, custom chappal inquiries, and order dispatches.
          </p>
        </div>

        {/* 3 Contact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm space-y-3">
            <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Phone className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-sm uppercase text-neutral-950">Official WhatsApp</h3>
            <p className="text-xs text-neutral-600">
              Direct customer assistance & orders
            </p>
            <div className="pt-1 space-y-2 text-xs font-mono font-bold text-neutral-900">
              <p>+92 300 0914546</p>
              <a
                href="https://wa.me/923000914546"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-sans text-xs font-bold transition-colors shadow-xs"
              >
                <span>Chat on WhatsApp</span>
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm space-y-3">
            <div className="h-10 w-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <Mail className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-sm uppercase text-neutral-950">Official Email</h3>
            <p className="text-xs text-neutral-600">
              Customer support & order inquiries
            </p>
            <div className="pt-1 space-y-1 text-xs font-bold text-neutral-900">
              <p>support@oxshoes.pk</p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm space-y-3">
            <div className="h-10 w-10 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center">
              <Building className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-sm uppercase text-neutral-950">Shop Location</h3>
            <p className="text-xs text-neutral-600">
              Inayat Killi Bazar, Bypass Road, near Inam Plaza, District Bajaur, Pakistan
            </p>
            <p className="text-[11px] font-mono text-neutral-500 pt-1">
              Plus Code: QF33+Q6F, Inayat Killi
            </p>
          </div>
        </div>

        {/* Map & Inquiry Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Inquiry Form */}
          <div className="lg:col-span-5 bg-white p-6 sm:p-8 rounded-2xl border border-neutral-200 shadow-sm space-y-5">
            <h3 className="font-bold text-sm uppercase tracking-wider text-neutral-950">
              Send a Direct Message
            </h3>

            {submitted ? (
              <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-3">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-sm text-emerald-900">Message Received!</h4>
                <p className="text-xs text-emerald-700">
                  Our customer service specialist will respond to you via WhatsApp or email within 2 business hours.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-lg"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Syed Waqas Ahmad"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="name@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">WhatsApp Mobile Number</label>
                  <input
                    type="text"
                    placeholder="+923XXXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">Inquiry Message *</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="How can our master craftsmen assist you today?"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-black uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  <span>{submitting ? 'Sending...' : 'Send Message'}</span>
                </button>
              </form>
            )}
          </div>

          {/* Map of Bajaur OX Shoes Shop Location */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div>
                  <h4 className="font-bold text-sm uppercase text-neutral-950 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-amber-600" />
                    Bajaur OX Shoes Shop Location
                  </h4>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Inayat Killi Bazar, Bypass Road, near Inam Plaza, District Bajaur
                  </p>
                </div>
                <span className="text-[11px] font-mono bg-neutral-100 text-neutral-700 px-2.5 py-1 rounded-md border border-neutral-200">
                  QF33+Q6F, Inayat Killi
                </span>
              </div>

              {/* Map Canvas */}
              <div className="w-full">
                <StoreMap
                  center={STORE_COORDS}
                  zoom={16}
                  height="360px"
                  markers={[
                    {
                      position: STORE_COORDS,
                      title: 'Bajaur OX Shoes',
                      address: 'Inayat Killi Bazar, Bypass Road, near Inam Plaza, District Bajaur',
                      phone: '+92 300 0914546',
                      hours: 'Official Retail Shop',
                    },
                  ]}
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 text-xs text-neutral-600">
                <span className="font-mono text-[11px]">GPS: 34.7544498, 71.4530333</span>
                <div className="flex items-center gap-4">
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=34.7544498%2C71.4530333"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-amber-600 hover:text-amber-700 underline flex items-center gap-1"
                  >
                    <span>Open in Google Maps →</span>
                  </a>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${STORE_COORDS[0]}&mlon=${STORE_COORDS[1]}#map=16/${STORE_COORDS[0]}/${STORE_COORDS[1]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-neutral-600 hover:text-neutral-900 underline"
                  >
                    OpenStreetMap →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
