'use client';

/**
 * @file app/my-account/page.tsx
 * @description Dawood OX Shoes Customer Dashboard.
 * Displays user profile, quick stats, recent orders, sidebar navigation,
 * and seamless links to profile, orders, wishlist, and addresses.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import {
  User as UserIcon,
  ShoppingBag,
  Heart,
  MapPin,
  LogOut,
  Clock,
  CheckCircle2,
  Package,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface OrderItem {
  orderId: string;
  date: string;
  status: 'Delivered' | 'Pending' | 'Shipped' | 'Processing';
  amount: string;
  itemsCount?: number;
}

const DEFAULT_ORDERS: OrderItem[] = [
  {
    orderId: '#OX-1001',
    date: '2026-05-10',
    status: 'Delivered',
    amount: 'Rs. 4500',
    itemsCount: 1,
  },
  {
    orderId: '#OX-1002',
    date: '2026-05-12',
    status: 'Pending',
    amount: 'Rs. 5200',
    itemsCount: 2,
  },
];

export default function MyAccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'wishlist' | 'addresses'>('overview');
  const [loggingOut, setLoggingOut] = useState(false);

  // User identity with fallback matching user brief
  const currentUser = {
    name: session?.user?.name || 'Never',
    email: session?.user?.email || 'never@never.com',
    role: (session?.user as any)?.role || 'customer',
  };

  const avatarInitial = (currentUser.name && currentUser.name.trim().length > 0)
    ? currentUser.name.trim()[0].toUpperCase()
    : 'N';

  const greeting = `Hello, ${currentUser.name}!`;

  const stats = [
    { label: 'Total Orders', value: 5, icon: ShoppingBag, color: 'text-blue-600 bg-blue-50 border-blue-100' },
    { label: 'Pending Orders', value: 1, icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-100' },
    { label: 'Wishlist Items', value: 3, icon: Heart, color: 'text-rose-600 bg-rose-50 border-rose-100' },
  ];

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut({ callbackUrl: '/login' });
  };

  const isAdmin = currentUser.role === 'super_admin' || currentUser.role === 'admin';

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between selection:bg-neutral-950 selection:text-white">
      <AnnouncementBar />
      <Header onOpenSearch={() => {}} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full flex-1">
        {/* Breadcrumb & Store Branding */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-neutral-200 gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium">
              <Link href="/" className="hover:text-neutral-900 transition-colors">
                Dawood OX Shoes
              </Link>
              <span>/</span>
              <span className="text-neutral-950 font-bold">Customer Dashboard</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-neutral-950 mt-1">
              Customer Dashboard
            </h1>
          </div>

          {isAdmin && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-950 text-white rounded-full text-xs font-bold hover:bg-neutral-800 transition-colors shadow-sm"
            >
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Switch to Admin Panel</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {/* Dashboard Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-8">
          {/* Sidebar */}
          <aside className="lg:col-span-1 space-y-6">
            {/* User Profile Card */}
            <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-sm text-center">
              <div className="relative inline-block mx-auto mb-3">
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-neutral-900 to-neutral-700 text-white flex items-center justify-center text-3xl font-black shadow-md border-2 border-white ring-4 ring-neutral-100">
                  {avatarInitial}
                </div>
                <div className="absolute bottom-0 right-0 p-1 bg-emerald-500 text-white rounded-full ring-2 ring-white" title="Verified Customer">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
              </div>

              <h2 className="text-base font-black text-neutral-950 tracking-tight">
                {currentUser.name}
              </h2>
              <p className="text-xs text-neutral-500 truncate max-w-[200px] mx-auto mt-0.5">
                {currentUser.email}
              </p>

              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-100 rounded-full text-[11px] font-bold text-neutral-700 capitalize tracking-wide">
                <Sparkles className="h-3 w-3 text-amber-500" />
                <span>{currentUser.role} Account</span>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="bg-white border border-neutral-200/80 rounded-2xl p-2.5 shadow-sm space-y-1">
              <button
                onClick={() => setActiveTab('overview')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'overview'
                    ? 'bg-neutral-950 text-white shadow-sm'
                    : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <UserIcon className="h-4 w-4" />
                  <span>My Profile</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 opacity-60" />
              </button>

              <Link
                href="/dashboard/orders"
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-100 transition-all"
              >
                <div className="flex items-center gap-3">
                  <ShoppingBag className="h-4 w-4 text-neutral-500" />
                  <span>My Orders</span>
                </div>
                <span className="text-[10px] bg-neutral-200 text-neutral-800 px-2 py-0.5 rounded-full font-black">
                  5
                </span>
              </Link>

              <Link
                href="/wishlist"
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-100 transition-all"
              >
                <div className="flex items-center gap-3">
                  <Heart className="h-4 w-4 text-neutral-500" />
                  <span>Wishlist</span>
                </div>
                <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-black">
                  3
                </span>
              </Link>

              <Link
                href="/dashboard/addresses"
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-100 transition-all"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-neutral-500" />
                  <span>Addresses</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 opacity-60" />
              </Link>

              <div className="pt-2 border-t border-neutral-100">
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{loggingOut ? 'Logging out...' : 'Logout'}</span>
                </button>
              </div>
            </nav>
          </aside>

          {/* Main Content Area */}
          <section className="lg:col-span-3 space-y-6">
            {/* Greeting Hero Card */}
            <div className="bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-800 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
              <div className="relative z-10 max-w-xl">
                <span className="inline-block px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[11px] font-bold uppercase tracking-wider text-neutral-200 mb-2">
                  Dawood OX Shoes
                </span>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                  {greeting}
                </h2>
                <p className="text-xs sm:text-sm text-neutral-300 mt-2 leading-relaxed">
                  Welcome to your Dawood OX Shoes dashboard. Manage your orders, browse saved footwear, and update your personal delivery details.
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/shop"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-neutral-950 rounded-full text-xs font-black uppercase tracking-wider hover:bg-neutral-100 transition-colors shadow-sm"
                  >
                    <span>Browse Collection</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    href="/dashboard/profile"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-bold transition-colors border border-white/20"
                  >
                    <span>Account Settings</span>
                  </Link>
                </div>
              </div>

              {/* Decorative Background Elements */}
              <div className="absolute -right-8 -bottom-10 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute right-6 top-6 text-white/10 pointer-events-none">
                <ShoppingBag className="w-32 h-32" />
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {stats.map((stat, idx) => {
                const IconComponent = stat.icon;
                return (
                  <div
                    key={idx}
                    className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs text-neutral-500 font-bold uppercase tracking-wide">
                        {stat.label}
                      </p>
                      <p className="text-2xl font-black text-neutral-950 mt-1">
                        {stat.value}
                      </p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${stat.color}`}>
                      <IconComponent className="h-6 w-6" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recent Orders Section */}
            <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
                <div>
                  <h3 className="text-base font-black text-neutral-950 uppercase tracking-tight">
                    Recent Orders
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Track delivery status and download official invoices
                  </p>
                </div>
                <Link
                  href="/dashboard/orders"
                  className="text-xs font-bold text-neutral-950 hover:underline inline-flex items-center gap-1"
                >
                  <span>View All Orders</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="divide-y divide-neutral-100 mt-2">
                {DEFAULT_ORDERS.map((order) => {
                  const isDelivered = order.status === 'Delivered';
                  return (
                    <div
                      key={order.orderId}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/70 p-2.5 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-700">
                          <Package className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-black text-neutral-950">
                              {order.orderId}
                            </span>
                            <span
                              className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                                isDelivered
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {order.status}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-400 mt-0.5">
                            Placed on {order.date}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4">
                        <span className="text-sm font-black text-neutral-950">
                          {order.amount}
                        </span>

                        <div className="flex items-center gap-2">
                          <Link
                            href="/track"
                            className="px-3 py-1.5 rounded-full border border-neutral-300 text-[11px] font-bold text-neutral-700 hover:bg-neutral-100 transition-colors"
                          >
                            Track
                          </Link>
                          <Link
                            href="/dashboard/orders"
                            className="px-3 py-1.5 rounded-full bg-neutral-950 text-white text-[11px] font-bold hover:bg-neutral-800 transition-colors"
                          >
                            Details
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Profile Summary & Security Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-800">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-neutral-950 tracking-wider">
                      Account Information
                    </h4>
                    <p className="text-[11px] text-neutral-400">Personal contact details</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-neutral-100">
                    <span className="text-neutral-500">Full Name</span>
                    <span className="font-bold text-neutral-950">{currentUser.name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-neutral-100">
                    <span className="text-neutral-500">Email Address</span>
                    <span className="font-bold text-neutral-950">{currentUser.email}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-neutral-500">Account Type</span>
                    <span className="font-bold text-neutral-950 capitalize">{currentUser.role}</span>
                  </div>
                </div>

                <Link
                  href="/dashboard/profile"
                  className="mt-4 block text-center py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition-colors"
                >
                  Edit Profile
                </Link>
              </div>

              <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-800">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-neutral-950 tracking-wider">
                      Shipping Addresses
                    </h4>
                    <p className="text-[11px] text-neutral-400">Default delivery location</p>
                  </div>
                </div>

                <div className="p-3 bg-neutral-50 border border-neutral-200/60 rounded-xl text-xs space-y-1">
                  <p className="font-bold text-neutral-950">{currentUser.name}</p>
                  <p className="text-neutral-600">Main Bazaar, Inayat Kalay, Bajaur</p>
                  <p className="text-neutral-400">Khyber Pakhtunkhwa, Pakistan</p>
                </div>

                <Link
                  href="/dashboard/addresses"
                  className="mt-4 block text-center py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition-colors"
                >
                  Manage Addresses
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
