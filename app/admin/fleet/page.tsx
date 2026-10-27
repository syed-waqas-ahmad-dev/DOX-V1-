import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db/connect';
import { DeliveryPartner } from '@/models/DeliveryPartner';
import { Order } from '@/models/Order';
import { OrderStatus } from '@/types';
import { CITY_COORDINATES } from '@/lib/cities';
import MapComponent from './FleetMapClient';
import { formatPKR } from '@/lib/formatters/currency';
import { formatDate } from '@/lib/formatters/date';
import { Logo } from '@/components/layout/Logo';
import {
  Bike,
  Package,
  MapPin,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Phone,
  RefreshCw,
} from 'lucide-react';

export default async function FleetDispatchPage() {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'super_admin') {
    redirect('/admin?error=unauthorized');
  }

  await connectToDatabase();

  // Fetch all active delivery partners/riders using DeliveryPartner model
  const riders = await DeliveryPartner.find({ isDeleted: false }).lean();

  // Create map markers with GPS or city center fallback
  const markers = riders.map((rider) => {
    const position: [number, number] =
      rider.currentLat && rider.currentLng
        ? [rider.currentLat, rider.currentLng]
        : CITY_COORDINATES[rider.city] || CITY_COORDINATES['Peshawar'];

    return {
      position,
      popupContent: `${rider.name} - ${rider.phone} - ${rider.city} - Load: ${rider.currentLoad ?? 0}`,
    };
  });

  // Fetch unassigned / pending orders for dispatch table
  const unassignedOrders = await Order.find({
    $or: [{ riderId: null }, { riderStatus: 'pending' }],
    status: { $nin: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
  })
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
      {/* Top Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Logo theme="dark" size="sm" withLink={false} />
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-amber-500 text-black uppercase tracking-widest font-mono">
            Fleet Dispatch Radar
          </span>
          <span className="text-xs text-neutral-400 hidden sm:inline">
            Foodpanda-Style Closed Fleet
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <Link
            href="/admin"
            className="text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5 font-bold"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Admin Console</span>
          </Link>
          <Link
            href="/admin/delivery-partners"
            className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors font-semibold"
          >
            Manage Partners
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-8">
        {/* Fleet Header Card */}
        <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Bike className="h-3.5 w-3.5" />
              <span>Live Fleet Tracking</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
              Live Fleet Dispatch Console
            </h1>
            <p className="text-xs text-neutral-400">
              {riders.length} active couriers deployed across Pakistani logistics hubs including Peshawar, Lahore, and Bajaur.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2.5 rounded-2xl bg-neutral-950 border border-neutral-800 text-center">
              <span className="text-[10px] text-neutral-400 uppercase font-bold block">Active Riders</span>
              <span className="text-lg font-mono font-bold text-emerald-400">{riders.length}</span>
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-neutral-950 border border-neutral-800 text-center">
              <span className="text-[10px] text-neutral-400 uppercase font-bold block">Unassigned Orders</span>
              <span className="text-lg font-mono font-bold text-amber-400">{unassignedOrders.length}</span>
            </div>
          </div>
        </div>

        {/* Live Radar Map Component */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-amber-500" />
              <span>Live Rider Locations Radar</span>
            </h2>
            <span className="text-xs text-neutral-500">
              OpenStreetMap • 100% Free Stack • No Google API keys
            </span>
          </div>

          {/* Render MapComponent dynamically with markers prop */}
          <MapComponent markers={markers} style={{ height: '400px', width: '100%' }} />
        </section>

        {/* Unassigned Orders Table */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div>
              <h2 className="text-base font-bold uppercase tracking-wide text-white flex items-center gap-2">
                <Package className="h-4 w-4 text-amber-500" />
                <span>Orders Awaiting Rider Assignment ({unassignedOrders.length})</span>
              </h2>
              <p className="text-xs text-neutral-500">
                Pending dispatch orders matched by delivery destination city.
              </p>
            </div>
          </div>

          {unassignedOrders.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-neutral-900 border border-neutral-800 space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-neutral-200">All orders are currently dispatched!</p>
              <p className="text-xs text-neutral-500">No unassigned consignments pending in the system.</p>
            </div>
          ) : (
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-950 text-neutral-400 font-bold uppercase tracking-wider text-[10px] border-b border-neutral-800">
                    <tr>
                      <th className="py-3 px-4">Order #</th>
                      <th className="py-3 px-4">Recipient</th>
                      <th className="py-3 px-4">City</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Payment</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60 font-medium">
                    {unassignedOrders.map((ord) => {
                      const shipAddr = ord.shippingAddress as unknown as Record<string, string> | undefined;
                      return (
                        <tr key={ord._id.toString()} className="hover:bg-neutral-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-amber-400">
                            {ord.orderNumber}
                          </td>
                          <td className="py-3 px-4 text-white">
                            <div>{shipAddr?.fullName || 'Customer'}</div>
                            <div className="text-[11px] text-neutral-500 font-mono">{shipAddr?.phone || ''}</div>
                          </td>
                          <td className="py-3 px-4 text-neutral-300">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-neutral-500" />
                              {shipAddr?.city || 'Pakistan'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                            {formatPKR(ord.totalAmount)}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-300">
                              {ord.paymentMethod}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-neutral-400">
                            {formatDate(ord.createdAt)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link
                              href={`/admin/orders/${ord._id.toString()}`}
                              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider transition-colors inline-block"
                            >
                              Dispatch
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
