'use client';

/**
 * @file app/admin/customers/page.tsx
 * @description Admin Customer Management Console for OX Shoes Pakistan.
 * Includes 100% Free WhatsApp Direct (wa.me) dispatch for each customer.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAllOrders } from '@/actions/order.actions';
import { type IOrder } from '@/types';
import { formatPKR } from '@/lib/formatters/currency';
import { Logo } from '@/components/layout/Logo';
import { generateCustomerWhatsAppUrl } from '@/lib/whatsapp';
import {
  Users,
  Search,
  Share2,
  ExternalLink,
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  ShoppingBag,
  Bell,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  city: string;
  email: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderId: string;
  lastOrderNumber: string;
  lastStatus: string;
  lastOrderDate: string;
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const fetchCustomerProfiles = async (): Promise<CustomerProfile[]> => {
    const [orderRes, userRes] = await Promise.all([
      getAllOrders().catch(() => ({ success: false, data: [] })),
      fetch('/api/admin/users').then((r) => r.json()).catch(() => ({ success: false, data: [] })),
    ]);

    const customerMap = new Map<string, CustomerProfile>();

    // 1. Seed with registered users from /api/admin/users
    if (userRes.success && Array.isArray(userRes.data)) {
      for (const u of userRes.data) {
        const key = u.phone?.trim() || u.email?.trim() || u._id;
        if (key) {
          customerMap.set(key, {
            id: u._id,
            name: u.name || 'User',
            phone: u.phone || '',
            city: 'Pakistan',
            email: u.email || '',
            totalOrders: 0,
            totalSpent: 0,
            lastOrderId: '',
            lastOrderNumber: 'N/A',
            lastStatus: u.role || 'customer',
            lastOrderDate: u.createdAt || new Date().toISOString(),
          });
        }
      }
    }

    // 2. Merge orders data
    if (orderRes.success && orderRes.data) {
      const orders: IOrder[] = orderRes.data;
      for (const ord of orders) {
        const shipAddr = ord.shippingAddress as unknown as Record<string, string> | undefined;
        const name = shipAddr?.fullName || 'Customer';
        const phone = shipAddr?.phone || '';
        const city = shipAddr?.city || 'Pakistan';
        const email = (ord as unknown as { customerEmail?: string }).customerEmail || '';
        const key = phone.trim() || email.trim() || name.trim() || ord._id.toString();

        const existing = customerMap.get(key);
        if (existing) {
          existing.totalOrders += 1;
          existing.totalSpent += ord.totalAmount || 0;
          if (new Date(ord.createdAt) > new Date(existing.lastOrderDate)) {
            existing.lastOrderId = ord._id.toString();
            existing.lastOrderNumber = ord.orderNumber;
            existing.lastStatus = ord.status;
            existing.lastOrderDate = new Date(ord.createdAt).toISOString();
          }
        } else {
          customerMap.set(key, {
            id: ord.userId ? ord.userId.toString() : ord._id.toString(),
            name,
            phone,
            city,
            email,
            totalOrders: 1,
            totalSpent: ord.totalAmount || 0,
            lastOrderId: ord._id.toString(),
            lastOrderNumber: ord.orderNumber,
            lastStatus: ord.status,
            lastOrderDate: new Date(ord.createdAt).toISOString(),
          });
        }
      }
    }

    return Array.from(customerMap.values());
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const data = await fetchCustomerProfiles();
      setCustomers(data);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchCustomerProfiles()
      .then((data) => {
        if (active) {
          setCustomers(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);


  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.lastOrderNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
      {/* Admin Navbar */}
      <header className="border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Logo theme="dark" size="sm" withLink={false} />
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-amber-500 text-black uppercase tracking-widest">
            Customers & Outreach
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <Link
            href="/admin"
            className="text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Orders ERP</span>
          </Link>
          <Link
            href="/admin/notifications"
            className="text-amber-400 hover:text-amber-300 font-bold transition-colors flex items-center gap-1"
          >
            <Bell className="h-3.5 w-3.5" />
            <span>Notification Hub</span>
          </Link>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-6">
        {/* Banner */}
        <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                100% Free Direct Customer Outreach
              </span>
              <span className="text-xs text-neutral-400">Zero Third-Party Fees</span>
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2.5">
              <Users className="h-6 w-6 text-amber-400" />
              <span>Customers Directory ({customers.length})</span>
            </h1>
            <p className="text-xs text-neutral-400 max-w-2xl leading-relaxed">
              Contact any customer directly via 1-click WhatsApp <code className="text-emerald-400 font-mono">wa.me</code> or dispatch targeted in-app alerts without requiring paid messaging APIs.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-200 transition-colors flex items-center gap-1.5 border border-neutral-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-neutral-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by customer name, phone number, city, or order number..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
        </div>

        {/* Customers Table */}
        <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Contact & City</th>
                  <th className="py-3 px-3">Orders</th>
                  <th className="py-3 px-3">Total Spend</th>
                  <th className="py-3 px-3">Last Order Status</th>
                  <th className="py-3 px-3 text-right">Outreach Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-neutral-500">
                      Loading customer profiles...
                    </td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-neutral-500">
                      No customer records match your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((cust, idx) => {
                    const whatsAppText = `Hello ${cust.name}, your order ${cust.lastOrderNumber} is ${cust.lastStatus} - Bajaur OX Shoes`;
                    const whatsAppUrl = generateCustomerWhatsAppUrl(cust.phone, whatsAppText);

                    return (
                      <tr key={idx} className="hover:bg-neutral-800/40 transition-colors">
                        <td className="py-3.5 px-3">
                          <span className="font-bold text-white block text-sm">{cust.name}</span>
                          <span className="text-[10px] text-neutral-500 font-mono">ID: {cust.id.slice(-6)}</span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="font-mono text-neutral-200 block">{cust.phone || 'No phone'}</span>
                          <span className="text-[11px] text-amber-500 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {cust.city}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-200 font-bold text-[11px]">
                            {cust.totalOrders} {cust.totalOrders === 1 ? 'order' : 'orders'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono font-bold text-emerald-400">
                          {formatPKR(cust.totalSpent)}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="space-y-0.5">
                            <Link
                              href={`/admin/orders/${cust.lastOrderId}`}
                              className="font-mono text-[11px] text-amber-400 hover:underline block"
                            >
                              #{cust.lastOrderNumber}
                            </Link>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                              {cust.lastStatus}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-right space-x-2">
                          {/* Required WhatsApp wa.me button */}
                          {whatsAppUrl ? (
                            <a
                              href={whatsAppUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black font-bold text-xs transition-all border border-emerald-500/30 shadow-sm"
                              title="Open direct WhatsApp conversation"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              <span>WhatsApp</span>
                              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                            </a>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800/40 text-neutral-600 font-bold text-xs border border-neutral-800 cursor-not-allowed opacity-50"
                              title="No valid customer phone number provided"
                              aria-label="No valid customer phone number provided"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              <span>WhatsApp</span>
                            </button>
                          )}

                          <Link
                            href={`/admin/orders/${cust.lastOrderId}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs transition-colors border border-neutral-700"
                          >
                            <span>Order</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
