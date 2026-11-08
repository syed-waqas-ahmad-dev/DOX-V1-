'use client';

/**
 * @file app/admin/archived-orders/page.tsx
 * @description Archived Orders Vault for OX Shoes Pakistan.
 * Displays only delivered orders that have been archived ({ archived: true })
 * to conserve MongoDB Atlas 512MB free-tier storage.
 * Features:
 *  - Real-time list of archived orders from MongoDB Atlas
 *  - Search & filter by order #, customer, phone, and city
 *  - "Restore / Unarchive" button for each order calling /api/admin/orders/unarchive
 *  - Direct links to FBR Tax Invoice, Order Tracking, and Order Details
 *  - Storage efficiency calculator
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getAllOrders } from '@/actions/order.actions';
import { type IOrder } from '@/types';
import { formatPKR } from '@/lib/formatters/currency';
import { formatDate } from '@/lib/formatters/date';
import { generateCustomerWhatsAppUrl } from '@/lib/whatsapp';
import { Logo } from '@/components/layout/Logo';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Truck,
  Printer,
  MapPin,
  ExternalLink,
  Share2,
  HardDrive,
  Database,
  Calendar,
} from 'lucide-react';

export default function ArchivedOrdersPage() {
  const [archivedOrders, setArchivedOrders] = useState<IOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 4000);
  };

  const fetchArchived = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAllOrders({ archived: true });
      if (res.success && res.data) {
        setArchivedOrders(res.data);
      }
    } catch {
      showNotice('error', 'Failed to retrieve archived orders from MongoDB Atlas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getAllOrders({ archived: true })
      .then((res) => {
        if (active && res.success && res.data) {
          setArchivedOrders(res.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleUnarchive = async (orderId: string, orderNumber: string) => {
    setRestoringId(orderId);
    try {
      const res = await fetch('/api/admin/orders/unarchive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (data.success) {
        setArchivedOrders((prev) => prev.filter((o) => o._id.toString() !== orderId));
        showNotice('success', `Order ${orderNumber} restored successfully to active orders!`);
      } else {
        showNotice('error', data.error || 'Failed to restore order.');
      }
    } catch {
      showNotice('error', 'Network error while attempting to restore order.');
    } finally {
      setRestoringId(null);
    }
  };

  const filteredOrders = archivedOrders.filter((ord) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const shipAddr = ord.shippingAddress as unknown as Record<string, string> | undefined;
    return (
      ord.orderNumber.toLowerCase().includes(q) ||
      (shipAddr?.fullName || '').toLowerCase().includes(q) ||
      (shipAddr?.phone || '').toLowerCase().includes(q) ||
      (shipAddr?.city || '').toLowerCase().includes(q) ||
      (ord.trackingNumber || '').toLowerCase().includes(q)
    );
  });

  // Calculate estimated space saved: ~4.5 KB per detailed order document
  const estimatedStorageSavedKb = (archivedOrders.length * 4.5).toFixed(1);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Logo theme="dark" size="sm" withLink={false} />
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-amber-500 text-black uppercase tracking-widest font-mono">
            Archived Orders Vault
          </span>
          <span className="text-xs text-neutral-400 hidden sm:inline">
            Atlas Space Optimization
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <Link
            href="/admin"
            className="text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5 font-bold"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Active Orders ERP</span>
          </Link>
          <button
            type="button"
            onClick={fetchArchived}
            disabled={loading}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
            title="Refresh list"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-6">
        {/* Banner Notice */}
        {notice && (
          <div
            className={`p-4 rounded-2xl text-xs flex items-center gap-2.5 transition-all ${
              notice.type === 'success'
                ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300'
                : 'bg-red-950/70 border border-red-500/40 text-red-300'
            }`}
          >
            {notice.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            )}
            <span className="font-medium">{notice.message}</span>
          </div>
        )}

        {/* Hero Card */}
        <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Archive className="h-3.5 w-3.5" />
              <span>Cold Storage Optimization</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
              Archived Delivered Orders ({archivedOrders.length})
            </h1>
            <p className="text-xs text-neutral-400 max-w-2xl leading-relaxed">
              Old delivered orders are safely archived instead of deleted, preserving compliance with Pakistani FBR tax rules while freeing operational database indices and active query memory on MongoDB Atlas 512MB tier.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-3 rounded-2xl bg-neutral-950 border border-neutral-800 text-center min-w-[130px]">
              <div className="flex items-center justify-center gap-1.5 text-neutral-400 text-[10px] font-bold uppercase tracking-wider">
                <Database className="h-3.5 w-3.5 text-amber-400" />
                <span>Atlas Storage</span>
              </div>
              <div className="text-xl font-mono font-bold text-emerald-400 mt-1">
                ~{estimatedStorageSavedKb} KB
              </div>
              <span className="text-[10px] text-neutral-500">Active RAM Saved</span>
            </div>

            <div className="px-4 py-3 rounded-2xl bg-neutral-950 border border-neutral-800 text-center min-w-[130px]">
              <div className="flex items-center justify-center gap-1.5 text-neutral-400 text-[10px] font-bold uppercase tracking-wider">
                <HardDrive className="h-3.5 w-3.5 text-sky-400" />
                <span>Archived Count</span>
              </div>
              <div className="text-xl font-mono font-bold text-white mt-1">
                {archivedOrders.length}
              </div>
              <span className="text-[10px] text-neutral-500">Delivered Orders</span>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-neutral-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter archived by order #, customer name, mobile phone, city, or tracking..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="text-xs text-neutral-400 hover:text-white font-bold"
            >
              Clear Filter
            </button>
          )}
        </div>

        {/* Orders Table */}
        <div className="rounded-3xl bg-neutral-900 border border-neutral-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/60 text-neutral-400 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3.5 px-4">Order #</th>
                  <th className="py-3.5 px-4">Customer & City</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Status & Archive Date</th>
                  <th className="py-3.5 px-4">Courier / Tracking</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/80 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-neutral-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-6 w-6 animate-spin text-amber-400" />
                        <span className="text-xs">Loading archived orders from MongoDB Atlas...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredOrders.length > 0 ? (
                  filteredOrders.map((ord) => {
                    const shipAddr = ord.shippingAddress as unknown as Record<string, string> | undefined;
                    const waUrl = generateCustomerWhatsAppUrl(
                      shipAddr?.phone,
                      `Hello ${shipAddr?.fullName || 'Customer'}, regarding your completed order ${ord.orderNumber} - Bajaur OX Shoes`
                    );
                    const isRestoring = restoringId === ord._id.toString();

                    return (
                      <tr key={ord._id.toString()} className="hover:bg-neutral-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-white">
                          <Link href={`/admin/orders/${ord._id}`} className="hover:text-amber-400">
                            {ord.orderNumber}
                          </Link>
                          <span className="text-[10px] text-neutral-500 block flex items-center gap-1 mt-0.5">
                            <Calendar className="h-3 w-3" />
                            {formatDate(ord.createdAt)}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="text-white font-bold block">{shipAddr?.fullName || 'Customer'}</span>
                          <span className="text-[11px] text-neutral-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 text-amber-500" />
                            {shipAddr?.city || 'Pakistan'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                          {formatPKR(ord.totalAmount)}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                            <CheckCircle2 className="h-3 w-3" />
                            Delivered & Archived
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-mono text-[11px] text-neutral-300 block">
                            {ord.courier || 'TCS Express'}
                          </span>
                          <Link
                            href={`/track?order=${ord.orderNumber}`}
                            className="font-mono text-[10px] text-amber-400 hover:text-amber-300 underline flex items-center gap-1"
                          >
                            <Truck className="h-3 w-3" />
                            <span>{ord.trackingNumber || 'Track Record'}</span>
                          </Link>
                        </td>

                        <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                          {/* Unarchive / Restore Button */}
                          <button
                            type="button"
                            onClick={() => handleUnarchive(ord._id.toString(), ord.orderNumber)}
                            disabled={isRestoring}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-transform hover:scale-105 shadow-sm disabled:opacity-50"
                            title="Restore this order back to active consignments"
                          >
                            <ArchiveRestore className={`h-3.5 w-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                            <span>{isRestoring ? 'Restoring...' : 'Restore / Unarchive'}</span>
                          </button>

                          <Link
                            href={`/invoice/${ord._id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-400 font-bold text-[11px] transition-colors border border-neutral-700"
                            title="Tax Invoice"
                          >
                            <Printer className="h-3 w-3" />
                            <span>Invoice</span>
                          </Link>

                          {waUrl ? (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-emerald-400 font-bold text-[11px] transition-colors border border-neutral-700"
                              title="WhatsApp Customer"
                            >
                              <Share2 className="h-3 w-3" />
                              <span>WA</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-neutral-800/40 text-neutral-600 font-bold text-[11px] border border-neutral-800 cursor-not-allowed opacity-50"
                              title="No valid customer phone number provided"
                              aria-label="No valid customer phone number provided"
                            >
                              <Share2 className="h-3 w-3" />
                              <span>WA</span>
                            </button>
                          )}

                          <Link
                            href={`/admin/orders/${ord._id}`}
                            className="text-neutral-400 hover:text-white font-bold text-[11px]"
                          >
                            Details →
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-neutral-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Archive className="h-8 w-8 text-neutral-600" />
                        <span className="text-sm font-bold text-neutral-300">No Archived Orders Found</span>
                        <p className="text-xs text-neutral-500 max-w-md">
                          When customer orders are marked as Delivered, you can click &ldquo;Archive&rdquo; on the active orders list to move them here and conserve MongoDB Atlas 512MB storage.
                        </p>
                        <Link
                          href="/admin"
                          className="mt-3 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold"
                        >
                          Return to Active Orders ERP
                        </Link>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
