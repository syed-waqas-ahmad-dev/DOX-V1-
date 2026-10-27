'use client';

/**
 * @file app/dashboard/addresses/page.tsx
 * @description Customer delivery address book for Pakistani destinations.
 * Manage primary addresses across Lahore, Karachi, Islamabad, and nationwide tehsils.
 * Strict TypeScript: ZERO `any`.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { PAKISTAN_MAJOR_CITIES } from '@/lib/constants';
import { MapPin, Plus, Trash2, CheckCircle2, Building, ShieldCheck } from 'lucide-react';

interface SavedAddress {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  street: string;
  city: string;
  postalCode: string;
  isDefault: boolean;
}

const INITIAL_ADDRESSES: SavedAddress[] = [
  {
    id: 'addr-1',
    label: 'Home (Islamabad)',
    fullName: 'Hamza Bilal Qureshi',
    phone: '+923339876543',
    street: 'House 112, Street 14, Sector F-8/2',
    city: 'Islamabad',
    postalCode: '44000',
    isDefault: true,
  },
  {
    id: 'addr-2',
    label: 'Lahore Office',
    fullName: 'Hamza Bilal Qureshi',
    phone: '+923339876543',
    street: 'Floor 3, Siddique Trade Center, Main Boulevard, Gulberg',
    city: 'Lahore',
    postalCode: '54000',
    isDefault: false,
  },
];

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<SavedAddress[]>(INITIAL_ADDRESSES);
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [label, setLabel] = useState('Home');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+923');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('Lahore');
  const [postalCode, setPostalCode] = useState('54000');

  const handleSetDefault = (id: string) => {
    setAddresses(
      addresses.map((a) => ({
        ...a,
        isDefault: a.id === id,
      }))
    );
  };

  const handleDelete = (id: string) => {
    setAddresses(addresses.filter((a) => a.id !== id));
  };

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone || !street) return;

    const newAddr: SavedAddress = {
      id: `addr-${Date.now()}`,
      label,
      fullName,
      phone,
      street,
      city,
      postalCode,
      isDefault: addresses.length === 0,
    };

    setAddresses([...addresses, newAddr]);
    setModalOpen(false);
    setFullName('');
    setStreet('');
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between selection:bg-neutral-950 selection:text-white">
      <AnnouncementBar />
      <Header onOpenSearch={() => {}} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-200 pb-4 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-neutral-950">
              Saved Delivery Addresses
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Manage your residential and corporate addresses for 1-click checkout
            </p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto text-xs font-bold">
            <Link href="/dashboard/profile" className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-full text-neutral-700">
              Profile
            </Link>
            <Link href="/dashboard/orders" className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-full text-neutral-700">
              Orders
            </Link>
            <Link href="/dashboard/addresses" className="px-4 py-2 bg-neutral-950 text-white rounded-full">
              Addresses
            </Link>
            <Link href="/dashboard/wishlist" className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-full text-neutral-700">
              Wishlist
            </Link>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Address</span>
          </button>
        </div>

        {/* Address Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`p-6 rounded-2xl bg-white border transition-all space-y-4 flex flex-col justify-between ${
                addr.isDefault
                  ? 'border-neutral-950 shadow-md ring-1 ring-neutral-950/5'
                  : 'border-neutral-200 shadow-sm'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-neutral-900 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-amber-600" />
                    {addr.label}
                  </span>
                  {addr.isDefault ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Default Delivery
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSetDefault(addr.id)}
                      className="text-[11px] font-bold text-neutral-500 hover:text-neutral-950"
                    >
                      Set as Default
                    </button>
                  )}
                </div>

                <div className="space-y-1 text-xs text-neutral-600">
                  <p className="font-bold text-sm text-neutral-950">{addr.fullName}</p>
                  <p className="leading-relaxed">{addr.street}</p>
                  <p className="font-medium text-neutral-800">
                    {addr.city}, {addr.postalCode}
                  </p>
                  <p className="font-mono text-neutral-500 pt-1">{addr.phone}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                <span className="text-[10px] text-neutral-400">TCS & Leopards Coverage</span>
                <button
                  onClick={() => handleDelete(addr.id)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 transition-colors"
                  title="Delete Address"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Address Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                <h3 className="text-lg font-black uppercase tracking-tight text-neutral-950">
                  Add Delivery Address
                </h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="text-neutral-400 hover:text-neutral-700 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddAddress} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">Address Label</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Home, Office, Studio"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">Recipient Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Hamza Bilal"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">Mobile Number (+923XXXXXXXXX) *</label>
                  <input
                    type="text"
                    required
                    placeholder="+923XXXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-700">City *</label>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950 bg-white"
                    >
                      {PAKISTAN_MAJOR_CITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-700">Postal Code</label>
                    <input
                      type="text"
                      placeholder="54000"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">Complete Street Address *</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="House / Plaza number, street, sector, area"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-5 py-2.5 rounded-full border border-neutral-300 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-full bg-neutral-950 text-white text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 shadow-md"
                  >
                    Save Address
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
