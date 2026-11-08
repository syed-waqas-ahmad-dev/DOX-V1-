'use client';

/**
 * @file app/delivery/page.tsx
 * @description Mobile-First Dedicated Rider Terminal for OX Shoes Private Delivery Fleet.
 * Allows private fleet couriers to view their assigned orders, update real-time status,
 * share live GPS coordinates, collect COD, and upload delivery photo proofs.
 * Zero self-registration — authentication is strictly restricted to admin-created credentials.
 * Strict TypeScript: ZERO `any`.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Logo } from '@/components/layout/Logo';
import {
  riderLogin,
  riderLogout,
  getCurrentRiderProfile,
  getRiderAssignments,
  updateRiderAssignmentStatus,
  updateRiderLocation,
} from '@/actions/delivery.actions';
import {
  DeliveryAssignmentStatus,
  type IDeliveryPartner,
  type IDeliveryAssignment,
} from '@/types';
import { formatPKR } from '@/lib/formatters/currency';
import { formatDate } from '@/lib/formatters/date';
import { generateCustomerWhatsAppUrl } from '@/lib/whatsapp';
import {
  Bike,
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  LogOut,
  Navigation,
  Camera,
  Upload,
  RefreshCw,
  Wallet,
  DollarSign,
  Share2,
  ShieldCheck,
  ChevronRight,
  Package,
  X,
  ExternalLink,
  Sparkles,
  Award,
} from 'lucide-react';

const RIDER_STORAGE_KEY = 'ox_shoes_rider_session';

export default function RiderTerminalPage() {
  const [partner, setPartner] = useState<IDeliveryPartner | null>(null);
  const [assignments, setAssignments] = useState<IDeliveryAssignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'profile'>('active');

  // Login Form
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState<boolean>(false);

  // Status Modals
  const [completingAssignment, setCompletingAssignment] = useState<IDeliveryAssignment | null>(null);
  const [failingAssignment, setFailingAssignment] = useState<IDeliveryAssignment | null>(null);
  const [proofPhotoUrl, setProofPhotoUrl] = useState<string>(
    'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80'
  );
  const [deliveryNote, setDeliveryNote] = useState<string>('');
  const [recipientName, setRecipientName] = useState<string>('');
  const [failureReason, setFailureReason] = useState<string>('Customer phone unreachable');
  const [failureNote, setFailureNote] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // GPS state & Refs
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [lastGpsUpdate, setLastGpsUpdate] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastPingTimeRef = useRef<number>(0);
  const isUpdatingRef = useRef<boolean>(false);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Derived state for GPS tracking activation
  const activeRiderId = partner?._id ? partner._id.toString() : null;
  const hasOutForDeliveryAssignment = assignments.some(
    (a) => a.status === DeliveryAssignmentStatus.OUT_FOR_DELIVERY
  );

  // Automatic Foreground Rider GPS Tracking Watcher
  useEffect(() => {
    if (!activeRiderId || !hasOutForDeliveryAssignment || typeof window === 'undefined' || !navigator.geolocation) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (watchIdRef.current === null) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          const now = Date.now();
          if (now - lastPingTimeRef.current < 30000 || isUpdatingRef.current) {
            return;
          }

          isUpdatingRef.current = true;
          try {
            const { latitude, longitude } = pos.coords;
            const res = await updateRiderLocation(activeRiderId, latitude, longitude);
            if (res.success) {
              lastPingTimeRef.current = Date.now();
              setLastGpsUpdate(new Date().toLocaleTimeString());
            }
          } catch {
            // Quietly handle connection blips
          } finally {
            isUpdatingRef.current = false;
          }
        },
        (err) => {
          console.warn('[Rider Terminal GPS Watcher]', err.message);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [activeRiderId, hasOutForDeliveryAssignment]);

  // Validate genuine server session on mount
  useEffect(() => {
    let active = true;
    getCurrentRiderProfile()
      .then((res) => {
        if (!active) return;
        if (res.success && res.data) {
          setPartner(res.data);
          localStorage.setItem(RIDER_STORAGE_KEY, JSON.stringify(res.data));
        } else {
          localStorage.removeItem(RIDER_STORAGE_KEY);
          setPartner(null);
        }
      })
      .catch(() => {
        if (!active) return;
        localStorage.removeItem(RIDER_STORAGE_KEY);
        setPartner(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Fetch rider assignments
  const fetchAssignments = useCallback(async (partnerId: string) => {
    setRefreshing(true);
    try {
      const res = await getRiderAssignments(partnerId);
      if (res.success && res.data) {
        setAssignments(res.data);
      } else if (!res.success && res.error?.includes('Unauthorized')) {
        localStorage.removeItem(RIDER_STORAGE_KEY);
        setPartner(null);
      }
    } catch {
      // Ignore
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (partner?._id) {
      getRiderAssignments(partner._id.toString())
        .then((res) => {
          if (active && res.success && res.data) {
            setAssignments(res.data);
          } else if (active && !res.success && res.error?.includes('Unauthorized')) {
            localStorage.removeItem(RIDER_STORAGE_KEY);
            setPartner(null);
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [partner?._id]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!phone.trim() || !password.trim()) {
      setLoginError('Please enter your mobile phone number and password.');
      return;
    }

    setLoggingIn(true);
    try {
      const res = await riderLogin(phone, password);
      if (res.success) {
        setPartner(res.data);
        localStorage.setItem(RIDER_STORAGE_KEY, JSON.stringify(res.data));
        showToast('success', res.message || 'Logged in successfully!');
      } else {
        setLoginError(res.error || 'Invalid credentials or inactive account.');
      }
    } catch {
      setLoginError('Connection error. Please try again.');
    } finally {
      setLoggingIn(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await riderLogout();
    } catch {
      // Ignore
    }
    localStorage.removeItem(RIDER_STORAGE_KEY);
    setPartner(null);
    setAssignments([]);
    showToast('success', 'Logged out of rider terminal.');
  };

  // Manual Backup: Share Live GPS Button
  const handleShareGps = () => {
    if (!partner?._id) return;
    if (!navigator.geolocation) {
      showToast('error', 'Geolocation is not supported by your browser.');
      return;
    }
    if (isUpdatingRef.current) return;

    setGpsLoading(true);
    isUpdatingRef.current = true;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await updateRiderLocation(partner._id.toString(), latitude, longitude);
          if (res.success) {
            lastPingTimeRef.current = Date.now();
            setLastGpsUpdate(new Date().toLocaleTimeString());
            showToast('success', `Live GPS broadcasted to Dispatch Radar! (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
          } else {
            showToast('error', 'Failed to transmit GPS coordinates.');
          }
        } finally {
          setGpsLoading(false);
          isUpdatingRef.current = false;
        }
      },
      (err) => {
        setGpsLoading(false);
        isUpdatingRef.current = false;
        showToast('error', `Location permission denied: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Update Status: Picked / Out for Delivery
  const handleAdvanceStatus = async (
    assignment: IDeliveryAssignment,
    newStatus: DeliveryAssignmentStatus
  ) => {
    if (!partner?._id) return;
    setSubmittingAction(true);
    try {
      const res = await updateRiderAssignmentStatus({
        assignmentId: assignment._id.toString(),
        partnerId: partner._id.toString(),
        status: newStatus,
      });

      if (res.success) {
        showToast('success', `Package status marked as ${newStatus}!`);
        fetchAssignments(partner._id.toString());
      } else {
        showToast('error', res.error || 'Failed to update status.');
      }
    } catch {
      showToast('error', 'Error updating status.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Submit Completed Delivery
  const handleSubmitDelivered = async () => {
    if (!completingAssignment || !partner?._id) return;
    setSubmittingAction(true);
    try {
      const noteWithRecipient = recipientName
        ? `Received by: ${recipientName}. ${deliveryNote}`
        : deliveryNote;

      const res = await updateRiderAssignmentStatus({
        assignmentId: completingAssignment._id.toString(),
        partnerId: partner._id.toString(),
        status: DeliveryAssignmentStatus.DELIVERED,
        photoUrl: proofPhotoUrl,
        note: noteWithRecipient,
      });

      if (res.success) {
        showToast('success', `Order delivered! PKR ${completingAssignment.codAmount || 0} COD recorded. +PKR 150 wallet bonus!`);
        // Update local partner state with bonus and COD
        const updatedPartner = {
          ...partner,
          walletBalance: (partner.walletBalance || 0) + 150,
          codCollectedBalance: (partner.codCollectedBalance || 0) + (completingAssignment.codAmount || 0),
          totalDeliveries: (partner.totalDeliveries || 0) + 1,
        };
        setPartner(updatedPartner);
        localStorage.setItem(RIDER_STORAGE_KEY, JSON.stringify(updatedPartner));

        setCompletingAssignment(null);
        setDeliveryNote('');
        setRecipientName('');
        fetchAssignments(partner._id.toString());
      } else {
        showToast('error', res.error || 'Failed to finalize delivery.');
      }
    } catch {
      showToast('error', 'Network error.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Submit Failed Delivery
  const handleSubmitFailed = async () => {
    if (!failingAssignment || !partner?._id) return;
    setSubmittingAction(true);
    try {
      const res = await updateRiderAssignmentStatus({
        assignmentId: failingAssignment._id.toString(),
        partnerId: partner._id.toString(),
        status: DeliveryAssignmentStatus.FAILED,
        failureReason,
        note: failureNote,
      });

      if (res.success) {
        showToast('error', `Order marked as Delivery Attempt Failed (${failureReason}). Admin alerted.`);
        setFailingAssignment(null);
        setFailureNote('');
        fetchAssignments(partner._id.toString());
      } else {
        showToast('error', res.error || 'Failed to log failure.');
      }
    } catch {
      showToast('error', 'Network error.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Filter assignments
  const activeAssignments = assignments.filter(
    (a) =>
      a.status === DeliveryAssignmentStatus.ASSIGNED ||
      a.status === DeliveryAssignmentStatus.PICKED ||
      a.status === DeliveryAssignmentStatus.OUT_FOR_DELIVERY
  );

  const completedAssignments = assignments.filter(
    (a) =>
      a.status === DeliveryAssignmentStatus.DELIVERED ||
      a.status === DeliveryAssignmentStatus.FAILED ||
      a.status === DeliveryAssignmentStatus.RETURNED
  );

  const totalCodCollectedToday = assignments
    .filter((a) => a.status === DeliveryAssignmentStatus.DELIVERED && a.codCollected)
    .reduce((sum, a) => sum + (a.codAmount || 0), 0);

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6">
        <div className="h-10 w-10 rounded-full border-4 border-amber-400 border-t-transparent animate-spin mb-4" />
        <p className="text-xs font-mono text-neutral-400 tracking-widest uppercase">
          Initializing OX Rider Terminal...
        </p>
      </div>
    );
  }

  // LOGIN SCREEN (No self-registration)
  if (!partner) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
        {/* Top Header */}
        <header className="border-b border-neutral-800 bg-neutral-900/80 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo theme="dark" size="sm" withLink={false} />
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500 text-black tracking-widest font-mono">
              Fleet Terminal
            </span>
          </div>
          <Link
            href="/admin/delivery-partners"
            className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"
          >
            <span>Admin Fleet</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </header>

        {/* Login Body */}
        <main className="flex-1 max-w-md w-full mx-auto px-6 py-10 flex flex-col justify-center">
          <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
                <Bike className="h-7 w-7" />
              </div>
              <h1 className="text-xl font-black uppercase tracking-tight text-white">
                Rider Sign In
              </h1>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Welcome to OX Shoes Private Courier Terminal. Please sign in with the official credentials issued by the Dispatch Administration.
              </p>
            </div>

            {/* Strict Notice */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <span>
                <strong>Closed Fleet System:</strong> Self-registration is disabled. Contact your OX Shoes warehouse supervisor if you do not have an account.
              </span>
            </div>

            {loginError && (
              <div className="p-3.5 rounded-2xl bg-red-950/80 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300 block">
                  Registered Mobile Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 h-4 w-4 text-neutral-500" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="03001234567"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300 block">
                  Access Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
              >
                {loggingIn ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Verifying Fleet Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Enter Rider Terminal</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </main>

        {/* Footer */}
        <footer className="py-4 text-center text-xs text-neutral-600 border-t border-neutral-900">
          OX Shoes Private Fleet Ecosystem · 100% Free Stack (MongoDB & Leaflet)
        </footer>
      </div>
    );
  }

  // RIDER ACTIVE TERMINAL (Mobile First)
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md animate-in slide-in-from-top-4">
          <div
            className={`px-4 py-3 rounded-2xl text-xs font-bold shadow-2xl flex items-center gap-2.5 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-300'
                : 'bg-red-950 border border-red-500/40 text-red-300'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Sticky Mobile App Bar */}
      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-md px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 rounded-full overflow-hidden bg-neutral-800 border border-amber-400/40 shrink-0">
            <Image
              src={partner.photo || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'}
              alt={partner.name}
              fill
              referrerPolicy="no-referrer"
              className="object-cover"
              sizes="40px"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs font-black text-white">{partner.name}</h2>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <span className="text-[10px] text-neutral-400 flex items-center gap-1">
              <Bike className="h-3 w-3 text-amber-400" />
              <span>{partner.bikeNumber} · {partner.city}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchAssignments(partner._id.toString())}
            disabled={refreshing}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors border border-neutral-700"
            title="Refresh Deliveries"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-red-950 text-neutral-400 hover:text-red-300 transition-colors border border-neutral-700"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Mobile App Container */}
      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-4 space-y-4">
        {/* Rider Wallet & COD Cash In Hand Card */}
        <div className="p-4 rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 border border-neutral-800 shadow-xl space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-black/40 border border-neutral-800/80">
              <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1">
                <span className="flex items-center gap-1">
                  <Wallet className="h-3 w-3 text-amber-400" />
                  <span>My Wallet</span>
                </span>
                <span className="text-[9px] text-amber-400 font-bold bg-amber-400/10 px-1.5 py-0.2 rounded">+150/dlv</span>
              </div>
              <div className="text-lg font-black text-amber-400 font-mono">
                {formatPKR(partner.walletBalance || 0)}
              </div>
              <span className="text-[9px] text-neutral-500">Earned delivery bonus</span>
            </div>

            <div className="p-3 rounded-2xl bg-black/40 border border-neutral-800/80">
              <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1">
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-emerald-400" />
                  <span>COD in Bag</span>
                </span>
                <span className="text-[9px] text-emerald-400 font-bold bg-emerald-400/10 px-1.5 py-0.2 rounded">Cash</span>
              </div>
              <div className="text-lg font-black text-emerald-400 font-mono">
                {formatPKR(partner.codCollectedBalance || totalCodCollectedToday || 0)}
              </div>
              <span className="text-[9px] text-neutral-500">To deposit at dispatch</span>
            </div>
          </div>

          {/* Live GPS Broadcast Button */}
          <button
            type="button"
            onClick={handleShareGps}
            disabled={gpsLoading}
            className="w-full py-2.5 px-3 rounded-2xl bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700/80 text-xs font-bold text-neutral-200 flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-2 text-left">
              <div className="h-7 w-7 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <Navigation className={`h-3.5 w-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <span className="text-white block text-xs">Transmit Live GPS Location</span>
                <span className="text-[10px] text-neutral-400 block font-normal">
                  {lastGpsUpdate ? `Last ping: ${lastGpsUpdate}` : 'Broadcast coordinate to Admin radar'}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">
              {gpsLoading ? 'Transmitting...' : 'Ping Radar'}
            </span>
          </button>
        </div>

        {/* Task Tabs */}
        <div className="flex rounded-2xl bg-neutral-900 p-1 border border-neutral-800">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'active'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Package className="h-3.5 w-3.5" />
            <span>Active Queue</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'active' ? 'bg-black text-amber-400 font-bold' : 'bg-neutral-800 text-neutral-300'
              }`}
            >
              {activeAssignments.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Completed</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'history' ? 'bg-black text-amber-400 font-bold' : 'bg-neutral-800 text-neutral-300'
              }`}
            >
              {completedAssignments.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'profile'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>ID Card</span>
          </button>
        </div>

        {/* TAB 1: ACTIVE ASSIGNMENTS QUEUE */}
        {activeTab === 'active' && (
          <div className="space-y-3">
            {activeAssignments.length === 0 ? (
              <div className="p-8 text-center rounded-3xl bg-neutral-900 border border-neutral-800 space-y-3">
                <div className="h-12 w-12 rounded-full bg-neutral-800 text-neutral-500 flex items-center justify-center mx-auto">
                  <Package className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-white">No Assigned Deliveries</h3>
                <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                  You currently have no pending orders. As soon as the dispatch team assigns a customer order to you, it will appear here in real time.
                </p>
                <button
                  type="button"
                  onClick={() => fetchAssignments(partner._id.toString())}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-amber-400 border border-neutral-700 inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Check for New Orders</span>
                </button>
              </div>
            ) : (
              activeAssignments.map((assignment) => {
                const waUrl = generateCustomerWhatsAppUrl(
                  assignment.customerPhone,
                  `Assalam-o-Alaikum ${assignment.customerName}, I am ${partner.name} from Bajaur OX Shoes. I am delivering your order ${assignment.orderNumber} for PKR ${assignment.codAmount?.toLocaleString()}. Are you available at your address?`
                );
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${assignment.deliveryAddress}, ${assignment.city}`
                )}`;

                return (
                  <div
                    key={assignment._id.toString()}
                    className="p-4 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-xl space-y-3"
                  >
                    {/* Header: Order Number + Status Badge */}
                    <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2.5">
                      <div>
                        <span className="text-[10px] text-neutral-500 font-mono block">Order Consignment</span>
                        <span className="text-sm font-black text-white font-mono">{assignment.orderNumber}</span>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          assignment.status === DeliveryAssignmentStatus.OUT_FOR_DELIVERY
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse'
                            : assignment.status === DeliveryAssignmentStatus.PICKED
                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        }`}
                      >
                        {assignment.status}
                      </span>
                    </div>

                    {/* Customer Info */}
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">{assignment.customerName}</span>
                        <div className="flex items-center gap-1.5">
                          {assignment.customerPhone ? (
                            <a
                              href={`tel:${assignment.customerPhone}`}
                              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sky-400 border border-neutral-700"
                              title="Call Customer"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="p-1.5 rounded-lg bg-neutral-800/40 text-neutral-600 border border-neutral-800 cursor-not-allowed opacity-40"
                              title="No phone number provided"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {waUrl ? (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/30 transition-colors"
                              title="WhatsApp Customer"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="p-1.5 rounded-lg bg-neutral-800/40 text-neutral-600 border border-neutral-800 cursor-not-allowed opacity-40"
                              title="No valid customer phone number provided"
                              aria-label="No valid customer phone number provided"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start gap-1.5 text-neutral-300">
                        <MapPin className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span className="leading-tight">{assignment.deliveryAddress}</span>
                      </div>
                    </div>

                    {/* COD Highlight & Map Navigation */}
                    <div className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-neutral-400 block">Cash On Delivery (COD)</span>
                        <span className="text-base font-black text-emerald-400 font-mono">
                          {formatPKR(assignment.codAmount || 0)}
                        </span>
                      </div>

                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold flex items-center gap-1 border border-neutral-700"
                      >
                        <Navigation className="h-3.5 w-3.5 text-amber-400" />
                        <span>Navigate</span>
                      </a>
                    </div>

                    {/* Workflow Step Actions */}
                    <div className="pt-1 space-y-2">
                      {assignment.status === DeliveryAssignmentStatus.ASSIGNED && (
                        <button
                          type="button"
                          disabled={submittingAction}
                          onClick={() => handleAdvanceStatus(assignment, DeliveryAssignmentStatus.PICKED)}
                          className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md shadow-sky-500/10"
                        >
                          <Package className="h-4 w-4" />
                          <span>1. Pick Up Parcel from Warehouse</span>
                        </button>
                      )}

                      {assignment.status === DeliveryAssignmentStatus.PICKED && (
                        <button
                          type="button"
                          disabled={submittingAction}
                          onClick={() =>
                            handleAdvanceStatus(assignment, DeliveryAssignmentStatus.OUT_FOR_DELIVERY)
                          }
                          className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-500/10"
                        >
                          <Bike className="h-4 w-4" />
                          <span>2. Start Delivery (Out for Delivery)</span>
                        </button>
                      )}

                      {assignment.status === DeliveryAssignmentStatus.OUT_FOR_DELIVERY && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setCompletingAssignment(assignment)}
                            className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-500/10"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Delivered ✓</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFailingAssignment(assignment)}
                            className="py-2.5 px-3 rounded-xl bg-red-950 hover:bg-red-900 text-red-300 border border-red-500/30 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
                          >
                            <AlertCircle className="h-4 w-4 text-red-400" />
                            <span>Report Issue</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: COMPLETED & HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {completedAssignments.length === 0 ? (
              <div className="p-8 text-center rounded-3xl bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs">
                No past deliveries recorded yet.
              </div>
            ) : (
              completedAssignments.map((assignment) => (
                <div
                  key={assignment._id.toString()}
                  className="p-4 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-white text-sm">{assignment.orderNumber}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        assignment.status === DeliveryAssignmentStatus.DELIVERED
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}
                    >
                      {assignment.status}
                    </span>
                  </div>

                  <div className="text-neutral-300">
                    <span className="font-bold text-white">{assignment.customerName}</span> · {assignment.deliveryAddress}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-neutral-800/80 text-[11px]">
                    <span className="text-neutral-400">
                      {assignment.deliveredAt ? `Delivered: ${formatDate(assignment.deliveredAt)}` : formatDate(assignment.assignedAt)}
                    </span>
                    <span className="font-mono font-bold text-emerald-400">
                      COD: {formatPKR(assignment.codAmount || 0)}
                    </span>
                  </div>

                  {assignment.proofPhotoUrl && (
                    <div className="pt-1">
                      <span className="text-[10px] text-neutral-400 block mb-1">Proof of Delivery:</span>
                      <div className="relative h-20 w-32 rounded-xl overflow-hidden border border-neutral-700 bg-neutral-950">
                        <Image
                          src={assignment.proofPhotoUrl}
                          alt="Delivery Proof"
                          fill
                          referrerPolicy="no-referrer"
                          className="object-cover"
                          sizes="130px"
                        />
                      </div>
                    </div>
                  )}

                  {assignment.failureReason && (
                    <div className="p-2 rounded-xl bg-red-950/40 border border-red-900/40 text-[11px] text-red-300">
                      <strong>Issue:</strong> {assignment.failureReason}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: RIDER PROFILE & ID CARD */}
        {activeTab === 'profile' && (
          <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 text-xs">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 rounded-2xl overflow-hidden bg-neutral-800 border-2 border-amber-400 shrink-0 shadow-lg">
                <Image
                  src={partner.photo || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80'}
                  alt={partner.name}
                  fill
                  referrerPolicy="no-referrer"
                  className="object-cover"
                  sizes="64px"
                />
              </div>
              <div>
                <h3 className="font-black text-white text-base">{partner.name}</h3>
                <span className="text-amber-400 font-bold block">{partner.phone}</span>
                <span className="text-[11px] text-neutral-400 block">Fleet Base: {partner.city} ({partner.area || 'All Sectors'})</span>
              </div>
            </div>

            <div className="divide-y divide-neutral-800 border-y border-neutral-800 py-1">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-neutral-400">CNIC Identity Card</span>
                <span className="font-mono text-white font-bold">{partner.cnic || 'Verified'}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-neutral-400">Motorbike Registration</span>
                <span className="font-mono text-amber-400 font-bold">{partner.bikeNumber}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-neutral-400">Fleet Rating</span>
                <span className="text-white font-bold">⭐ {partner.rating || 5.0} / 5.0</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-neutral-400">Total Successful Deliveries</span>
                <span className="font-mono text-emerald-400 font-bold">{partner.totalDeliveries || 0} parcels</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2.5 rounded-xl bg-red-950 hover:bg-red-900 text-red-300 border border-red-500/30 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out of Terminal</span>
            </button>
          </div>
        )}
      </main>

      {/* MODAL: PROOF OF DELIVERY & COD CONFIRMATION */}
      {completingAssignment && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-3xl p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-white uppercase flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Handover & COD Collection</span>
                </h3>
                <span className="text-[11px] text-neutral-400 font-mono">
                  Consignment #{completingAssignment.orderNumber}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCompletingAssignment(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center justify-between">
              <div>
                <span className="text-neutral-400 block text-[10px]">Collect Cash from Customer:</span>
                <span className="text-lg font-black text-emerald-400 font-mono">
                  {formatPKR(completingAssignment.codAmount || 0)}
                </span>
              </div>
              <span className="px-2 py-1 rounded bg-emerald-500 text-black font-black text-[10px] uppercase">
                COD Ready
              </span>
            </div>

            {/* Photo Proof */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300 block flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5 text-amber-400" />
                <span>Proof of Delivery Photo (Doorstep / Parcel)</span>
              </label>
              <div className="flex items-center gap-3">
                <div className="relative h-16 w-24 rounded-xl overflow-hidden bg-neutral-950 border border-neutral-700 shrink-0">
                  <Image
                    src={proofPhotoUrl}
                    alt="Proof Preview"
                    fill
                    referrerPolicy="no-referrer"
                    className="object-cover"
                    sizes="96px"
                  />
                </div>
                <div className="space-y-1 flex-1">
                  <input
                    type="text"
                    value={proofPhotoUrl}
                    onChange={(e) => setProofPhotoUrl(e.target.value)}
                    placeholder="Photo URL or camera upload"
                    className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] text-white focus:outline-none focus:border-amber-500"
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setProofPhotoUrl(
                          'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80'
                        )
                      }
                      className="px-2 py-0.5 rounded bg-neutral-800 text-[10px] text-neutral-300 hover:text-white"
                    >
                      Sample Photo 1
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setProofPhotoUrl(
                          'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=600&q=80'
                        )
                      }
                      className="px-2 py-0.5 rounded bg-neutral-800 text-[10px] text-neutral-300 hover:text-white"
                    >
                      Sample Photo 2
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Recipient Details */}
            <div className="space-y-2">
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Receiver name (if different from customer)"
                className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
              />
              <input
                type="text"
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                placeholder="Optional note: e.g. Handed over to brother with exact change"
                className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="button"
              disabled={submittingAction}
              onClick={handleSubmitDelivered}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              {submittingAction ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Submitting Delivery Proof...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Confirm Delivery & COD Received</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* MODAL: REPORT FAILED DELIVERY */}
      {failingAssignment && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-3xl p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-red-400 uppercase flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" />
                  <span>Report Delivery Issue</span>
                </h3>
                <span className="text-[11px] text-neutral-400 font-mono">
                  Order #{failingAssignment.orderNumber}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFailingAssignment(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300 block">
                Reason for Incomplete Delivery
              </label>
              <select
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white outline-none focus:border-amber-500"
              >
                <option value="Customer phone unreachable">Customer phone unreachable / power off</option>
                <option value="Customer requested reschedule">Customer requested delivery tomorrow</option>
                <option value="Incorrect / incomplete address">Incorrect / incomplete address (house not found)</option>
                <option value="Customer refused parcel">Customer refused to accept parcel</option>
                <option value="Customer did not have cash">Customer did not have cash ready for COD</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300 block">
                Rider Explanation Note
              </label>
              <textarea
                rows={2}
                value={failureNote}
                onChange={(e) => setFailureNote(e.target.value)}
                placeholder="Explain what happened (e.g. called 4 times at gate, no answer)..."
                className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            <button
              type="button"
              disabled={submittingAction}
              onClick={handleSubmitFailed}
              className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
            >
              {submittingAction ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Logging Incident...</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4" />
                  <span>Submit Failure to Dispatch</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
