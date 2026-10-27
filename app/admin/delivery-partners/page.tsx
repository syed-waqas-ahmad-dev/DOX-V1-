'use client';

/**
 * @file app/admin/delivery-partners/page.tsx
 * @description Enterprise Delivery Partner & Private Fleet Command Center for OX Shoes Pakistan.
 * 100% Free Stack (MongoDB, Leaflet + OpenStreetMap, Haversine routing).
 * Features:
 *  - Partner Management CRUD (Create, Edit, Soft Delete, Deactivate)
 *  - Live Radar Map on OpenStreetMap with green status dots & COD tracking
 *  - Order Assignment & Dispatch Engine with Haversine distance
 *  - Office COD Reconciliation & Settlement ("Mark as Received in Office")
 *  - Rider Wallet Adjustment & Commission Credits
 *  - Delivery History, Proof Photo Viewer & Performance Metrics
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Logo } from '@/components/layout/Logo';
import { DeliveryPartnersMap } from '@/components/maps/DeliveryPartnersMap';
import {
  getAllDeliveryPartners,
  createDeliveryPartner,
  updateDeliveryPartner,
  deleteDeliveryPartner,
  markCodReceivedInOffice,
  getAllDeliveryAssignments,
  assignOrderToPartner,
  reassignOrder,
  unassignOrder,
  getActiveRidersForCity,
  getDeliveryDashboardMetrics,
} from '@/actions/delivery.actions';
import { getAllOrders, getOrderById } from '@/actions/order.actions';
import { formatPKR } from '@/lib/formatters/currency';
import { formatDate } from '@/lib/formatters/date';
import { PAKISTAN_MAJOR_CITIES } from '@/lib/constants';
import {
  DeliveryPartnerStatus,
  DeliveryAssignmentStatus,
  type IDeliveryPartner,
  type IDeliveryAssignment,
  type IOrder,
} from '@/types';
import {
  Bike,
  Users,
  MapPin,
  Phone,
  ShieldCheck,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  DollarSign,
  Wallet,
  Navigation,
  Edit2,
  Trash2,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Package,
  X,
  CreditCard,
  UserCheck,
  UserX,
  SlidersHorizontal,
  Compass,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export default function AdminDeliveryPartnersPage() {
  const [activeTab, setActiveTab] = useState<'partners' | 'map' | 'assignments' | 'cod'>('partners');
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState<IDeliveryPartner[]>([]);
  const [assignments, setAssignments] = useState<IDeliveryAssignment[]>([]);
  const [pendingOrders, setPendingOrders] = useState<IOrder[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusNotice, setStatusNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Metrics
  const [metrics, setMetrics] = useState({
    totalPartners: 0,
    activePartners: 0,
    totalAssignments: 0,
    deliveredCount: 0,
    outForDeliveryCount: 0,
    failedCount: 0,
    totalCodInTransit: 0,
  });

  // Modal States
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<IDeliveryPartner | null>(null);
  const [assigningOrder, setAssigningOrder] = useState<IOrder | null>(null);
  const [candidateRiders, setCandidateRiders] = useState<Array<IDeliveryPartner & { distanceKm?: number }>>([]);
  const [reassigningAssignment, setReassigningAssignment] = useState<IDeliveryAssignment | null>(null);
  const [adjustingWalletPartner, setAdjustingWalletPartner] = useState<IDeliveryPartner | null>(null);
  const [walletAmount, setWalletAmount] = useState<number>(500);

  // Form State for New Partner
  const [newPartner, setNewPartner] = useState({
    name: '',
    phone: '',
    cnic: '',
    bikeNumber: '',
    password: '',
    area: '',
    city: 'Peshawar',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, aRes, mRes, oRes] = await Promise.all([
        getAllDeliveryPartners({ city: selectedCity !== 'all' ? selectedCity : undefined }),
        getAllDeliveryAssignments({ city: selectedCity !== 'all' ? selectedCity : undefined }),
        getDeliveryDashboardMetrics(),
        getAllOrders().catch(() => ({ success: false, data: [] })),
      ]);

      if (pRes.success && pRes.data) setPartners(pRes.data);
      if (aRes.success && aRes.data) setAssignments(aRes.data);
      if (mRes.success && mRes.data) setMetrics(mRes.data);

      if (oRes.success && oRes.data) {
        // Find unassigned orders
        const assignmentsList = aRes.success && aRes.data ? aRes.data : [];
        const assignedOrderIds = new Set(assignmentsList.map((a) => a.orderId.toString()));
        const unassigned = oRes.data.filter(
          (ord) => !assignedOrderIds.has(ord._id.toString()) && ord.status !== 'Delivered' && ord.status !== 'Cancelled'
        );
        setPendingOrders(unassigned);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [selectedCity]);

  useEffect(() => {
    let active = true;
    Promise.all([
      getAllDeliveryPartners({ city: selectedCity !== 'all' ? selectedCity : undefined }),
      getAllDeliveryAssignments({ city: selectedCity !== 'all' ? selectedCity : undefined }),
      getDeliveryDashboardMetrics(),
      getAllOrders().catch(() => ({ success: false, data: [] })),
    ])
      .then(([pRes, aRes, mRes, oRes]) => {
        if (!active) return;
        if (pRes.success && pRes.data) setPartners(pRes.data);
        if (aRes.success && aRes.data) setAssignments(aRes.data);
        if (mRes.success && mRes.data) setMetrics(mRes.data);

        if (oRes.success && oRes.data) {
          const assignmentsList = aRes.success && aRes.data ? aRes.data : [];
          const assignedOrderIds = new Set(assignmentsList.map((a) => a.orderId.toString()));
          const unassigned = oRes.data.filter(
            (ord) => !assignedOrderIds.has(ord._id.toString()) && ord.status !== 'Delivered' && ord.status !== 'Cancelled'
          );
          setPendingOrders(unassigned);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedCity]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setStatusNotice({ type, text });
    setTimeout(() => setStatusNotice(null), 4000);
  };

  // Create Partner
  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartner.name || !newPartner.phone || !newPartner.password) {
      showFeedback('error', 'Please fill in Name, Phone, and Password.');
      return;
    }

    const res = await createDeliveryPartner(newPartner);
    if (res.success) {
      showFeedback('success', res.message || 'Delivery Partner registered successfully!');
      setShowAddPartnerModal(false);
      setNewPartner({
        name: '',
        phone: '',
        cnic: '',
        bikeNumber: '',
        password: '',
        area: '',
        city: 'Peshawar',
        photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      });
      loadData();
    } else {
      showFeedback('error', res.error || 'Failed to create partner.');
    }
  };

  // Update Partner
  const handleUpdatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner) return;

    const res = await updateDeliveryPartner({
      id: editingPartner._id.toString(),
      name: editingPartner.name,
      phone: editingPartner.phone,
      cnic: editingPartner.cnic,
      bikeNumber: editingPartner.bikeNumber,
      area: editingPartner.area,
      city: editingPartner.city,
      status: editingPartner.status,
      photo: editingPartner.photo,
    });

    if (res.success) {
      showFeedback('success', 'Partner updated successfully.');
      setEditingPartner(null);
      loadData();
    } else {
      showFeedback('error', res.error || 'Failed to update partner.');
    }
  };

  // Delete Partner
  const handleDeletePartner = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to deactivate rider ${name}?`)) return;
    const res = await deleteDeliveryPartner(id);
    if (res.success) {
      showFeedback('success', `Rider ${name} deactivated.`);
      loadData();
    } else {
      showFeedback('error', res.error || 'Failed to deactivate.');
    }
  };

  // COD Cash Settlement
  const handleCollectCod = async (partnerId: string, partnerName: string) => {
    const res = await markCodReceivedInOffice(partnerId);
    if (res.success) {
      showFeedback('success', `COD received from ${partnerName}! Balance settled in office.`);
      loadData();
    } else {
      showFeedback('error', res.error || 'Failed to mark received.');
    }
  };

  // Open Assign Modal
  const handleOpenAssignModal = async (order: IOrder) => {
    setAssigningOrder(order);
    const orderCity = (order.shippingAddress as unknown as Record<string, string> | undefined)?.city || 'Peshawar';
    const ridersRes = await getActiveRidersForCity(orderCity);
    if (ridersRes.success && ridersRes.data) {
      setCandidateRiders(ridersRes.data);
    }
  };

  // Assign Order to Rider
  const handleConfirmAssignment = async (riderId: string) => {
    if (!assigningOrder) return;
    const res = await assignOrderToPartner({
      orderId: assigningOrder._id.toString(),
      partnerId: riderId,
      expectedVersion: assigningOrder.version ?? 0,
    });

    if (res.success) {
      showFeedback('success', res.message || 'Order assigned to rider.');
      setAssigningOrder(null);
      loadData();
    } else {
      showFeedback('error', res.error || 'Failed to assign order.');
    }
  };

  // Re-assign Order
  const handleConfirmReassign = async (newRiderId: string) => {
    if (!reassigningAssignment) return;
    // Fetch order to get current version for OCC
    const orderRes = await getOrderById(reassigningAssignment.orderId.toString());
    if (!orderRes.success || !orderRes.data) {
      showFeedback('error', 'Order not found');
      return;
    }
    const expectedVersion = orderRes.data.version ?? 0;
    const res = await reassignOrder(reassigningAssignment._id.toString(), newRiderId, expectedVersion);
    if (res.success) {
      showFeedback('success', res.message || 'Order reassigned.');
      setReassigningAssignment(null);
      loadData();
    } else {
      showFeedback('error', res.error || 'Failed to reassign.');
    }
  };

  // Unassign Order
  const handleUnassign = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to unassign this order from the rider?')) return;
    try {
      const assignmentObj = assignments.find((a) => a._id.toString() === assignmentId);
      if (!assignmentObj) { showFeedback('error', 'Assignment not found'); return; }
      const orderRes = await getOrderById(assignmentObj.orderId.toString());
      if (!orderRes.success || !orderRes.data) { showFeedback('error', 'Order not found'); return; }
      const expectedVersion = orderRes.data.version ?? 0;
      const res = await unassignOrder(assignmentId, expectedVersion);
      if (res.success) {
        showFeedback('success', 'Order unassigned and returned to general dispatch.');
        loadData();
      } else {
        showFeedback('error', res.error || 'Failed to unassign.');
      }
    } catch {
      showFeedback('error', 'Error unassigning.');
    }
  };

  // Wallet adjustment
  const handleAdjustWallet = async () => {
    if (!adjustingWalletPartner) return;
    const res = await updateDeliveryPartner({
      id: adjustingWalletPartner._id.toString(),
      walletDelta: walletAmount,
    });
    if (res.success) {
      showFeedback('success', `Wallet updated by PKR ${walletAmount}.`);
      setAdjustingWalletPartner(null);
      loadData();
    } else {
      showFeedback('error', res.error || 'Failed to adjust wallet.');
    }
  };

  const filteredPartners = partners.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone.includes(searchTerm) ||
      p.bikeNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.area?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCity = selectedCity === 'all' || p.city.toLowerCase() === selectedCity.toLowerCase();
    return matchesSearch && matchesCity;
  });

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Logo theme="dark" size="sm" withLink={false} />
          <span className="text-[10px] font-black px-2.5 py-0.5 rounded bg-emerald-500 text-black uppercase tracking-widest font-mono">
            Private Fleet Command
          </span>
          <span className="hidden md:inline text-xs text-neutral-400">
            {metrics.activePartners} Active Riders · {metrics.deliveredCount} Delivered Today · {formatPKR(metrics.totalCodInTransit)} COD in Hand
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <Link
            href="/delivery"
            className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition-colors flex items-center gap-1.5 font-bold"
            title="Open Mobile Rider App"
          >
            <Bike className="h-3.5 w-3.5" />
            <span>Open Rider App →</span>
          </Link>
          <Link
            href="/admin"
            className="text-neutral-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Main ERP</span>
          </Link>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-8">
        {/* Top Hero Banner */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900 to-emerald-950/40 border border-neutral-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">
                100% Free Stack • No Supabase • No Google Maps API
              </span>
              <span className="text-xs text-neutral-400">Peshawar & Nationwide Fleet</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
              <Bike className="h-7 w-7 text-emerald-400" />
              <span>Delivery Partner Fleet & Dispatch</span>
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl">
              Admin-controlled internal courier fleet. Create delivery riders, assign COD orders with Haversine distance calculations, monitor riders live on OpenStreetMap, and reconcile cash in hand.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-stretch sm:self-auto">
            <button
              onClick={() => setShowAddPartnerModal(true)}
              className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-2 group hover:scale-105"
            >
              <Plus className="h-4 w-4" />
              <span>Add New Partner</span>
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-neutral-300 transition-colors"
              title="Refresh Fleet Data"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Status Notification Toast */}
        {statusNotice && (
          <div
            className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-in fade-in ${
              statusNotice.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300'
                : 'bg-red-950/80 border border-red-500/40 text-red-300'
            }`}
          >
            {statusNotice.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            )}
            <span>{statusNotice.text}</span>
          </div>
        )}

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1">
            <div className="flex items-center justify-between text-neutral-400 text-xs">
              <span>Active Fleet</span>
              <Users className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white">{metrics.activePartners} Riders</div>
            <div className="text-[11px] text-neutral-500">{metrics.totalPartners} Total in Database</div>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1">
            <div className="flex items-center justify-between text-neutral-400 text-xs">
              <span>COD in Transit</span>
              <Wallet className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400">{formatPKR(metrics.totalCodInTransit)}</div>
            <div className="text-[11px] text-neutral-500">Collected by riders today</div>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1">
            <div className="flex items-center justify-between text-neutral-400 text-xs">
              <span>Dispatched Today</span>
              <Package className="h-4 w-4 text-sky-400" />
            </div>
            <div className="text-2xl font-black text-white">{metrics.totalAssignments} Orders</div>
            <div className="text-[11px] text-emerald-400 font-bold">{metrics.deliveredCount} Delivered Successfully</div>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1">
            <div className="flex items-center justify-between text-neutral-400 text-xs">
              <span>Pending Assignment</span>
              <Clock className="h-4 w-4 text-neutral-400" />
            </div>
            <div className="text-2xl font-black text-white">{pendingOrders.length} Orders</div>
            <div className="text-[11px] text-neutral-500">Ready for rider dispatch</div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto text-xs font-bold">
            <button
              onClick={() => setActiveTab('partners')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'partners'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Riders Roster ({partners.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('map')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'map'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Compass className="h-3.5 w-3.5 text-emerald-400" />
              <span>Live Fleet Map</span>
            </button>

            <button
              onClick={() => setActiveTab('assignments')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'assignments'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              <span>Dispatch & Assignments ({assignments.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('cod')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'cod'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <DollarSign className="h-3.5 w-3.5 text-amber-400" />
              <span>COD Office Settlement</span>
            </button>
          </div>

          {/* City Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 font-bold">City:</span>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="bg-neutral-900 border border-neutral-800 text-neutral-200 text-xs px-3 py-1.5 rounded-xl focus:outline-none focus:border-amber-400"
            >
              <option value="all">All Cities (Pakistan)</option>
              <option value="Peshawar">Peshawar (Hub)</option>
              <option value="Lahore">Lahore</option>
              <option value="Islamabad">Islamabad</option>
              <option value="Rawalpindi">Rawalpindi</option>
              <option value="Karachi">Karachi</option>
              <option value="Faisalabad">Faisalabad</option>
              <option value="Multan">Multan</option>
            </select>
          </div>
        </div>

        {/* TAB 1: PARTNERS ROSTER */}
        {activeTab === 'partners' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search rider by name, phone, bike number, or area..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="text-xs text-neutral-400 font-medium">
                Showing {filteredPartners.length} of {partners.length} registered fleet partners
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPartners.map((partner) => (
                <div
                  key={partner._id.toString()}
                  className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-md space-y-4 flex flex-col justify-between hover:border-neutral-700 transition-all"
                >
                  <div className="space-y-4">
                    {/* Header info */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-12 rounded-2xl bg-neutral-800 overflow-hidden border border-neutral-700 shrink-0">
                          {partner.photo && (
                            <Image
                              src={partner.photo}
                              alt={partner.name}
                              fill
                              referrerPolicy="no-referrer"
                              className="object-cover"
                              sizes="48px"
                            />
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-white line-clamp-1">{partner.name}</h3>
                          <span className="text-xs text-neutral-400 font-mono">{partner.phone}</span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          partner.status === DeliveryPartnerStatus.ACTIVE
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {partner.status}
                      </span>
                    </div>

                    {/* Rider Details Grid */}
                    <div className="p-3.5 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Operating City:</span>
                        <span className="font-bold text-amber-400">{partner.city}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Assigned Area:</span>
                        <span className="text-neutral-300 line-clamp-1">{partner.area}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Bike Plate:</span>
                        <span className="font-mono font-bold text-neutral-200">{partner.bikeNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">CNIC:</span>
                        <span className="font-mono text-neutral-400">{partner.cnic}</span>
                      </div>
                      <div className="flex justify-between border-t border-neutral-800/80 pt-1.5">
                        <span className="text-neutral-500 font-bold">Total Deliveries:</span>
                        <span className="font-bold text-white">{partner.totalDeliveries}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500 font-bold">Wallet Balance:</span>
                        <span className="font-bold text-emerald-400 font-mono">{formatPKR(partner.walletBalance || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500 font-bold">COD Cash in Hand:</span>
                        <span className="font-bold text-amber-400 font-mono">{formatPKR(partner.codCollectedBalance || 0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-neutral-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setEditingPartner(partner)}
                        className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-neutral-300 transition-colors"
                        title="Edit Partner"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setAdjustingWalletPartner(partner)}
                        className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-emerald-400 text-xs font-bold transition-colors"
                        title="Adjust Wallet"
                      >
                        Wallet ±
                      </button>
                      {partner.codCollectedBalance > 0 && (
                        <button
                          onClick={() => handleCollectCod(partner._id.toString(), partner.name)}
                          className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 rounded-xl text-xs font-bold transition-colors"
                          title="Mark COD Cash Received in Office"
                        >
                          Settle COD
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeletePartner(partner._id.toString(), partner.name)}
                      className="p-2 text-neutral-500 hover:text-red-400 transition-colors"
                      title="Deactivate Partner"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: LIVE MAP RADAR */}
        {activeTab === 'map' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-bold text-white uppercase tracking-wider">
                  Live OpenStreetMap Fleet Radar
                </span>
                <span className="text-neutral-500">• Centered on {selectedCity === 'all' ? 'Pakistan' : selectedCity}</span>
              </div>
              <span className="text-neutral-400 text-[11px]">
                Showing active riders with live green status dots & COD tracking
              </span>
            </div>

            <DeliveryPartnersMap
              partners={filteredPartners}
              selectedCity={selectedCity}
              onSelectPartner={(partner) => {
                setEditingPartner(partner);
              }}
            />
          </div>
        )}

        {/* TAB 3: DISPATCH & ASSIGNMENTS */}
        {activeTab === 'assignments' && (
          <div className="space-y-8">
            {/* Unassigned Pending Orders Section */}
            {pendingOrders.length > 0 && (
              <div className="p-6 rounded-3xl bg-neutral-900 border border-amber-500/30 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-white">
                      Orders Awaiting Rider Assignment ({pendingOrders.length})
                    </h3>
                  </div>
                  <span className="text-xs text-neutral-400">Assign to local city riders with distance check</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingOrders.map((ord) => {
                    const addr = ord.shippingAddress as unknown as Record<string, string> | undefined;
                    return (
                      <div
                        key={ord._id.toString()}
                        className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 flex flex-col justify-between space-y-3"
                      >
                        <div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono font-bold text-amber-400">#{ord.orderNumber}</span>
                            <span className="font-bold text-white">{formatPKR(ord.totalAmount)}</span>
                          </div>
                          <h4 className="font-bold text-sm text-neutral-200 mt-1">{addr?.fullName || 'Customer'}</h4>
                          <p className="text-xs text-neutral-400 line-clamp-1">{addr?.street || 'Address'}</p>
                          <span className="text-[11px] font-bold text-emerald-400 block mt-0.5">{addr?.city || 'Pakistan'}</span>
                        </div>

                        <button
                          onClick={() => handleOpenAssignModal(ord)}
                          className="w-full py-2 bg-amber-400 hover:bg-amber-300 text-black rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <Bike className="h-3.5 w-3.5" />
                          <span>Assign to Rider</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Current Fleet Assignments Table */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black uppercase tracking-wider text-white">
                  Active Dispatch Assignments ({assignments.length})
                </h3>
                <span className="text-xs text-neutral-500">Live order fulfillment status across Pakistan</span>
              </div>

              <div className="bg-neutral-900 rounded-3xl border border-neutral-800 overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-neutral-300">
                    <thead className="bg-neutral-950 text-neutral-400 font-mono text-[11px] uppercase border-b border-neutral-800">
                      <tr>
                        <th className="p-4">Order Ref</th>
                        <th className="p-4">Customer & City</th>
                        <th className="p-4">Assigned Rider</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">COD Amount</th>
                        <th className="p-4">Proof Photo</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/80">
                      {assignments.map((assignment) => (
                        <tr key={assignment._id.toString()} className="hover:bg-neutral-800/40 transition-colors">
                          <td className="p-4 font-mono font-bold text-amber-400">
                            {assignment.orderNumber}
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-white">{assignment.customerName}</div>
                            <div className="text-neutral-400 text-[11px] line-clamp-1">{assignment.deliveryAddress}</div>
                            <span className="text-[10px] text-emerald-400 font-bold">{assignment.city}</span>
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-neutral-200">🛵 {assignment.partnerName}</div>
                            <div className="font-mono text-neutral-400 text-[11px]">{assignment.partnerPhone}</div>
                          </td>
                          <td className="p-4">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                assignment.status === DeliveryAssignmentStatus.DELIVERED
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : assignment.status === DeliveryAssignmentStatus.OUT_FOR_DELIVERY
                                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 animate-pulse'
                                  : assignment.status === DeliveryAssignmentStatus.PICKED
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : assignment.status === DeliveryAssignmentStatus.FAILED
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                              }`}
                            >
                              {assignment.status.replace(/_/g, ' ')}
                            </span>
                            {assignment.failureReason && (
                              <div className="text-[10px] text-red-400 mt-1 line-clamp-1">
                                Reason: {assignment.failureReason}
                              </div>
                            )}
                          </td>
                          <td className="p-4 font-mono font-bold text-white">
                            {formatPKR(assignment.codAmount)}
                            {assignment.codCollected ? (
                              <span className="block text-[10px] text-emerald-400 font-normal">✓ Collected</span>
                            ) : (
                              <span className="block text-[10px] text-neutral-500 font-normal">Pending Cash</span>
                            )}
                          </td>
                          <td className="p-4">
                            {assignment.proofPhotoUrl ? (
                              <a
                                href={assignment.proofPhotoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block relative h-10 w-10 rounded-lg overflow-hidden border border-neutral-700 hover:scale-110 transition-transform"
                                title="View Delivery Proof Photo"
                              >
                                <Image
                                  src={assignment.proofPhotoUrl}
                                  alt="Proof"
                                  fill
                                  referrerPolicy="no-referrer"
                                  className="object-cover"
                                  sizes="40px"
                                />
                              </a>
                            ) : (
                              <span className="text-[11px] text-neutral-600">—</span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {assignment.status !== DeliveryAssignmentStatus.DELIVERED && (
                                <button
                                  onClick={() => setReassigningAssignment(assignment)}
                                  className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-colors"
                                  title="Reassign to another rider"
                                >
                                  Reassign
                                </button>
                              )}
                              <button
                                onClick={() => handleUnassign(assignment._id.toString())}
                                className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                                title="Unassign"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: COD OFFICE SETTLEMENT */}
        {activeTab === 'cod' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black uppercase text-white">COD Cash Reconciliation & Handover</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  When riders return to the office at end of shift, verify their physical cash and mark as received.
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-neutral-500 uppercase font-bold block">Total Cash in Rider Pockets</span>
                <span className="text-2xl font-black text-amber-400 font-mono">{formatPKR(metrics.totalCodInTransit)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {partners
                .filter((p) => (p.codCollectedBalance || 0) > 0)
                .map((partner) => (
                  <div
                    key={partner._id.toString()}
                    className="p-6 rounded-3xl bg-neutral-900 border border-amber-500/30 space-y-4 shadow-md flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-white">🛵 {partner.name}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                          {partner.city}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-400 font-mono">{partner.phone} · Bike: {partner.bikeNumber}</div>
                      <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 text-center space-y-1">
                        <span className="text-[11px] text-neutral-500 uppercase font-bold">Unsettled COD Cash</span>
                        <div className="text-2xl font-black text-amber-400 font-mono">
                          {formatPKR(partner.codCollectedBalance || 0)}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleCollectCod(partner._id.toString(), partner.name)}
                      className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Mark Cash Received in Office</span>
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: ADD DELIVERY PARTNER */}
      {showAddPartnerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-2">
                <Bike className="h-5 w-5 text-amber-400" />
                <h3 className="text-lg font-black uppercase text-white tracking-tight">
                  Register Delivery Partner
                </h3>
              </div>
              <button
                onClick={() => setShowAddPartnerModal(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePartner} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-neutral-300">Partner Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ali Khan (Peshawar Fleet)"
                  value={newPartner.name}
                  onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="03001234567"
                    value={newPartner.phone}
                    onChange={(e) => setNewPartner({ ...newPartner, phone: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">Login Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••"
                    value={newPartner.password}
                    onChange={(e) => setNewPartner({ ...newPartner, password: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">CNIC Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="17301-1234567-1"
                    value={newPartner.cnic}
                    onChange={(e) => setNewPartner({ ...newPartner, cnic: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">Bike Registration No *</label>
                  <input
                    type="text"
                    required
                    placeholder="PSH-7842"
                    value={newPartner.bikeNumber}
                    onChange={(e) => setNewPartner({ ...newPartner, bikeNumber: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white uppercase font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">City *</label>
                  <select
                    value={newPartner.city}
                    onChange={(e) => setNewPartner({ ...newPartner, city: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-amber-400"
                  >
                    {PAKISTAN_MAJOR_CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">Assigned Area *</label>
                  <input
                    type="text"
                    required
                    placeholder="Hayatabad & University Road"
                    value={newPartner.area}
                    onChange={(e) => setNewPartner({ ...newPartner, area: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-300">Rider Photo URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newPartner.photo}
                  onChange={(e) => setNewPartner({ ...newPartner, photo: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddPartnerModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black uppercase tracking-wider shadow-md"
                >
                  Save Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ASSIGN ORDER TO RIDER (WITH HAVERSINE DISTANCE) */}
      {assigningOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest block">
                  Haversine Dispatch Optimizer
                </span>
                <h3 className="text-lg font-black uppercase text-white">
                  Assign Order #{assigningOrder.orderNumber}
                </h3>
              </div>
              <button
                onClick={() => setAssigningOrder(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-500">Destination:</span>
                <span className="font-bold text-white">
                  {(assigningOrder.shippingAddress as unknown as Record<string, string> | undefined)?.city || 'Peshawar'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Address:</span>
                <span className="text-neutral-300 line-clamp-1">
                  {(assigningOrder.shippingAddress as unknown as Record<string, string> | undefined)?.street || 'Street Address'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">COD Total:</span>
                <span className="font-bold text-amber-400 font-mono">{formatPKR(assigningOrder.totalAmount)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                Select Active Fleet Rider:
              </span>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {candidateRiders.length === 0 ? (
                  <div className="p-6 text-center text-xs text-neutral-500 bg-neutral-950 rounded-2xl">
                    No active riders currently registered for this city. Please add a rider first.
                  </div>
                ) : (
                  candidateRiders.map((rider) => (
                    <div
                      key={rider._id.toString()}
                      className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between hover:border-amber-400/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-neutral-800 text-amber-400 flex items-center justify-center font-bold text-sm">
                          🛵
                        </div>
                        <div className="text-xs">
                          <div className="font-bold text-white">{rider.name}</div>
                          <div className="text-neutral-500 text-[11px] font-mono">
                            {rider.bikeNumber} · {rider.area}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {typeof rider.distanceKm === 'number' && (
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            ~{rider.distanceKm} km
                          </span>
                        )}
                        <button
                          onClick={() => handleConfirmAssignment(rider._id.toString())}
                          className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs rounded-xl uppercase tracking-wider transition-colors"
                        >
                          Dispatch
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REASSIGN ORDER */}
      {reassigningAssignment && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest block">
                  Re-assign Order
                </span>
                <h3 className="text-lg font-black uppercase text-white">
                  Order #{reassigningAssignment.orderNumber}
                </h3>
              </div>
              <button
                onClick={() => setReassigningAssignment(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-400">
              Current rider: <strong className="text-white">{reassigningAssignment.partnerName}</strong>. Choose a replacement rider to take over this consignment:
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {partners
                .filter((p) => p._id.toString() !== reassigningAssignment.partnerId.toString())
                .map((rider) => (
                  <div
                    key={rider._id.toString()}
                    className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between hover:border-neutral-700"
                  >
                    <div className="text-xs">
                      <div className="font-bold text-white">🛵 {rider.name}</div>
                      <div className="text-neutral-500 font-mono text-[11px]">{rider.city} · {rider.bikeNumber}</div>
                    </div>
                    <button
                      onClick={() => handleConfirmReassign(rider._id.toString())}
                      className="px-3.5 py-1.5 bg-neutral-800 hover:bg-amber-400 hover:text-black text-neutral-200 text-xs font-bold rounded-xl transition-colors"
                    >
                      Assign Here
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: ADJUST WALLET */}
      {adjustingWalletPartner && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-black uppercase text-white">
                Adjust Wallet: {adjustingWalletPartner.name}
              </h3>
              <button onClick={() => setAdjustingWalletPartner(null)} className="text-neutral-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-neutral-400">
                <span>Current Balance:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {formatPKR(adjustingWalletPartner.walletBalance || 0)}
                </span>
              </div>

              <div className="space-y-1 pt-2">
                <label className="font-bold text-neutral-300">Adjustment Amount (PKR)</label>
                <input
                  type="number"
                  value={walletAmount}
                  onChange={(e) => setWalletAmount(Number(e.target.value))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-white font-mono focus:outline-none focus:border-amber-400"
                />
                <span className="text-[10px] text-neutral-500">Positive adds funds, negative deducts.</span>
              </div>
            </div>

            <button
              onClick={handleAdjustWallet}
              className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs uppercase tracking-wider transition-colors"
            >
              Update Wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
