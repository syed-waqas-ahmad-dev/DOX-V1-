'use client';

/**
 * @file app/checkout/page.tsx
 * @description Enterprise 3-step checkout for Pakistani footwear e-commerce.
 * Form validation, city-based shipping, 17% GST tax calculation,
 * COD checkout with phone OTP verification and atomic order creation.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { buildCheckoutOrderItems, useCartStore } from '@/lib/store/cart';
import { useLocale } from '@/lib/store/locale';
import { useHydrated } from '@/lib/hooks/useHydrated';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { formatPKR } from '@/lib/formatters/currency';
import { calculateOrderTotals } from '@/lib/pricing';
import { cityOptions, COD_MAX_LIMIT_WITHOUT_OTP, PAYMENT_METHOD_DETAILS } from '@/lib/constants';
import { CouponType, PaymentMethod, type IDeliveryCoordinates } from '@/types';
import { createOrder } from '@/actions/order.actions';
import { validateCartProducts, type CartValidationItemResult } from '@/actions/product.actions';
import { validateCouponAction } from '@/actions/coupon.actions';
import { CheckoutAddressMap } from '@/components/maps/CheckoutAddressMap';
import {
  ShieldCheck,
  Truck,
  CheckCircle2,
  Lock,
  ArrowRight,
  AlertCircle,
  Clock,
  Sparkles,
  CreditCard,
  Smartphone,
  Building,
  Check,
  Trash2,
  Tag,
  X,
} from 'lucide-react';

function getCartLineKey(item: {
  productId: string;
  variantId?: string;
  size: string;
  color: string;
}): string {
  return `${item.productId}::${
    item.variantId || `${item.size.trim().toLowerCase()}::${item.color.trim().toLowerCase()}`
  }`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, appliedCoupon, applyCoupon, removeCoupon, clearCart, removeItem } = useCartStore();
  const { isUrdu } = useLocale();
  const isHydrated = useHydrated();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [validatingCart, setValidatingCart] = useState(false);
  const [cartValidationError, setCartValidationError] = useState<string | null>(null);
  const [invalidCartMap, setInvalidCartMap] = useState<Record<string, CartValidationItemResult>>({});
  const submittingRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const idempotencySignatureRef = useRef<string>('');

  // Address & Guest Contact State
  const [fullName, setFullName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [phone, setPhone] = useState('+923');
  const [villageAddress, setVillageAddress] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('Lahore');
  const [customCity, setCustomCity] = useState('');
  const [postalCode, setPostalCode] = useState('54000');
  const [hasEditedPostalCode, setHasEditedPostalCode] = useState(false);
  const [notes, setNotes] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState<IDeliveryCoordinates | null>(null);

  // Coupon UI State
  const [couponInput, setCouponInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);

  const effectiveCity = city === 'Other' ? customCity.trim() : city;

  const handleCitySelectChange = (nextCity: string) => {
    setCity(nextCity);
    if (nextCity !== 'Other') {
      setCustomCity('');
    }
    setDeliveryLocation(null);
    if (!hasEditedPostalCode && postalCode === '54000' && nextCity !== 'Lahore') {
      setPostalCode('');
    }
  };

  // Payment Method
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.COD);
  const [paymentVerified, setPaymentVerified] = useState(false);

  // COD OTP State for orders > PKR 10,000
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [codOtpToken, setCodOtpToken] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);

  const runCartValidation = useCallback(async () => {
    if (!isHydrated || items.length === 0) {
      setInvalidCartMap({});
      setCartValidationError(null);
      return;
    }

    setValidatingCart(true);
    setCartValidationError(null);
    try {
      const res = await validateCartProducts(buildCheckoutOrderItems(items));
      if (!res.success) {
        setCartValidationError(res.error || 'Could not verify live product availability.');
        return;
      }

      const nextInvalid: Record<string, CartValidationItemResult> = {};
      for (const result of res.data.results) {
        if (!result.valid) {
          nextInvalid[getCartLineKey(result)] = result;
        }
      }
      setInvalidCartMap(nextInvalid);
    } catch {
      setCartValidationError('Could not verify live product availability.');
    } finally {
      setValidatingCart(false);
    }
  }, [isHydrated, items]);

  useEffect(() => {
    if (!isHydrated || items.length === 0) return;
    let active = true;
    validateCartProducts(buildCheckoutOrderItems(items))
      .then((res) => {
        if (!active) return;
        if (!res.success) {
          setCartValidationError(res.error || 'Could not verify live product availability.');
          return;
        }
        const nextInvalid: Record<string, CartValidationItemResult> = {};
        for (const result of res.data.results) {
          if (!result.valid) {
            nextInvalid[getCartLineKey(result)] = result;
          }
        }
        setInvalidCartMap(nextInvalid);
        setCartValidationError(null);
      })
      .catch(() => {
        if (active) {
          setCartValidationError('Could not verify live product availability.');
        }
      });

    return () => {
      active = false;
    };
  }, [isHydrated, items]);

  const invalidCount = Object.keys(invalidCartMap).length;
  const hasInvalidItems = invalidCount > 0;

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const appliedCouponCode = appliedCoupon?.code;

  // Keep applied coupon revalidated when cart subtotal changes
  useEffect(() => {
    if (!isHydrated || !appliedCouponCode) return;
    if (subtotal <= 0) {
      removeCoupon();
      return;
    }
    let active = true;
    validateCouponAction(appliedCouponCode, subtotal)
      .then((res) => {
        if (!active) return;
        if (res.success) {
          applyCoupon({
            code: res.data.code,
            discountAmount: res.data.discountAmount,
            value: res.data.value,
            minOrderAmount: res.data.minOrderAmount,
            maxDiscountAmount: res.data.maxDiscountAmount,
            type: res.data.type,
          });
        } else {
          removeCoupon();
          setCouponSuccess(null);
          setCouponError(res.error || 'Applied coupon is no longer eligible for this bag.');
        }
      })
      .catch(() => {
        // Defer to authoritative server validation on submit
      });
    return () => {
      active = false;
    };
  }, [isHydrated, appliedCouponCode, subtotal, applyCoupon, removeCoupon]);

  const getActiveIdempotencyKey = useCallback(() => {
    const signature = JSON.stringify({
      items: items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId || '',
        size: i.size,
        color: i.color,
        quantity: i.quantity,
      })),
      fullName: fullName.trim(),
      guestEmail: guestEmail.trim().toLowerCase(),
      phone: phone.trim(),
      villageAddress: villageAddress.trim(),
      street: street.trim(),
      city: effectiveCity,
      postalCode: postalCode.trim(),
      paymentMethod,
      couponCode: appliedCoupon?.code || '',
      notes: notes.trim(),
    });

    if (idempotencyKeyRef.current && idempotencySignatureRef.current === signature) {
      return idempotencyKeyRef.current;
    }

    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `ox-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    idempotencyKeyRef.current = generated;
    idempotencySignatureRef.current = signature;
    return generated;
  }, [
    items,
    fullName,
    guestEmail,
    phone,
    villageAddress,
    street,
    effectiveCity,
    postalCode,
    paymentMethod,
    appliedCoupon,
    notes,
  ]);

  // Pricing calculations
  const totalWeight = items.reduce((sum, item) => sum + (item.weight || 750) * item.quantity, 0);
  const pricing = calculateOrderTotals(
    items.map((i) => ({ price: i.price, quantity: i.quantity })),
    effectiveCity || city,
    totalWeight,
    appliedCoupon
      ? {
          type: appliedCoupon.type as CouponType,
          value: appliedCoupon.value ?? appliedCoupon.discountAmount,
          minOrderAmount: appliedCoupon.minOrderAmount || 0,
          maxDiscountAmount: appliedCoupon.maxDiscountAmount || undefined,
        }
      : null
  );

  const requiresCodOtp = pricing.totalAmount > COD_MAX_LIMIT_WITHOUT_OTP;

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;

    setCouponLoading(true);
    setCouponError(null);
    setCouponSuccess(null);

    try {
      const res = await validateCouponAction(couponInput.trim(), subtotal);
      if (res.success) {
        applyCoupon({
          code: res.data.code,
          discountAmount: res.data.discountAmount,
          value: res.data.value,
          minOrderAmount: res.data.minOrderAmount,
          maxDiscountAmount: res.data.maxDiscountAmount,
          type: res.data.type,
        });
        setCouponSuccess(res.data.message);
        setCouponInput('');
      } else {
        setCouponError(res.error || 'Invalid promotional code.');
      }
    } catch {
      setCouponError('Unable to validate coupon right now.');
    } finally {
      setCouponLoading(false);
    }
  };

  const sendCodOtp = async (): Promise<boolean> => {
    setOtpLoading(true);
    setOtpError(null);
    setOtpMessage(null);
    try {
      const response = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = (await response.json()) as { success?: boolean; message?: string; error?: string };
      if (!response.ok || !data.success) {
        setOtpError(data.error || 'Unable to send OTP verification code.');
        return false;
      }
      setOtpSent(true);
      setOtpMessage(data.message || `6-digit verification code sent to ${phone.trim()}.`);
      return true;
    } catch {
      setOtpError('Network error while sending verification code. Please try again.');
      return false;
    } finally {
      setOtpLoading(false);
    }
  };

  const submitOrder = async (verifiedOtpToken?: string) => {
    if (submittingRef.current || submitting || validatingCart) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const idempotencyKey = getActiveIdempotencyKey();
      const activeOtpToken = verifiedOtpToken || codOtpToken || undefined;

      const res = await createOrder({
        items: buildCheckoutOrderItems(items),
        checkoutData: {
          guestEmail: guestEmail.trim() || undefined,
          guestPhone: phone.trim(),
          shippingAddress: {
            fullName: fullName.trim(),
            phone: phone.trim(),
            villageAddress: villageAddress.trim(),
            address: street.trim(),
            street: street.trim(),
            city: effectiveCity,
            postalCode: postalCode.trim(),
            ...(deliveryLocation ? { coordinates: deliveryLocation } : {}),
          },
          paymentMethod,
          couponCode: appliedCoupon?.code,
          notes: notes.trim() || undefined,
          idempotencyKey,
          codOtpToken: activeOtpToken,
        },
      });

      if (res.success) {
        idempotencyKeyRef.current = null;
        idempotencySignatureRef.current = '';
        setCodOtpToken(null);
        clearCart();
        const confirmationUrl = res.data.guestAccessToken
          ? `/order-confirmation/${res.data.order._id}?token=${encodeURIComponent(res.data.guestAccessToken)}`
          : `/order-confirmation/${res.data.order._id}`;
        router.push(confirmationUrl);
      } else {
        const message = res.error || 'Failed to place order. Please check item stock.';
        if (message.toLowerCase().includes('verification required') || message.toLowerCase().includes('otp')) {
          setCodOtpToken(null);
          setOtpModalOpen(true);
          setOtpError(message);
          if (!otpSent) {
            await sendCodOtp();
          }
        } else {
          setErrorMsg(message);
          await runCartValidation();
        }
      }
    } catch {
      setErrorMsg('Unable to submit order right now. Please try again.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (submittingRef.current || submitting || validatingCart) {
      return;
    }

    if (items.length === 0) {
      setErrorMsg('Your cart is empty.');
      return;
    }

    if (hasInvalidItems) {
      setErrorMsg('One or more items in your bag are no longer available. Please remove unavailable items before placing your order.');
      return;
    }

    if (!fullName.trim() || !phone.trim() || !street.trim() || !villageAddress.trim() || !effectiveCity) {
      setErrorMsg('Please complete all recipient shipping details.');
      setStep(1);
      return;
    }

    if (guestEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
      setErrorMsg('Please enter a valid email address or leave email blank.');
      setStep(1);
      return;
    }

    if (!/^\+923\d{9}$/.test(phone.trim())) {
      setErrorMsg('Please enter a valid Pakistani mobile number in format +923XXXXXXXXX');
      setStep(1);
      return;
    }

    if (requiresCodOtp && !codOtpToken) {
      setErrorMsg(null);
      setOtpError(null);
      setOtpModalOpen(true);
      if (!otpSent) {
        await sendCodOtp();
      }
      return;
    }

    await submitOrder();
  };

  const handleVerifyOtpAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpInput.trim() || otpInput.trim().length < 6) {
      setOtpError('Please enter the 6-digit verification code sent to your phone.');
      return;
    }

    setOtpLoading(true);
    setOtpError(null);

    try {
      const response = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          otp: otpInput.trim(),
        }),
      });
      const data = (await response.json()) as {
        success?: boolean;
        verified?: boolean;
        codOtpToken?: string;
        error?: string;
      };

      if (!response.ok || !data.verified || !data.codOtpToken) {
        setOtpError(data.error || 'Invalid or expired OTP code.');
        return;
      }

      setCodOtpToken(data.codOtpToken);
      setOtpModalOpen(false);
      setOtpInput('');
      setOtpLoading(false);
      await submitOrder(data.codOtpToken);
    } catch {
      setOtpError('Unable to verify OTP right now. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col justify-between">
        <AnnouncementBar />
        <Header onOpenSearch={() => {}} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-neutral-200 rounded w-48" />
            <div className="h-4 bg-neutral-200 rounded w-72" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mt-8">
              <div className="lg:col-span-7 h-96 bg-neutral-200 rounded-2xl" />
              <div className="lg:col-span-5 h-64 bg-neutral-200 rounded-2xl" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col justify-between">
        <AnnouncementBar />
        <Header onOpenSearch={() => {}} />
        <main className="max-w-xl mx-auto my-auto p-8 text-center space-y-4">
          <h2 className="text-2xl font-black uppercase tracking-tight text-neutral-900">Your bag is empty</h2>
          <p className="text-xs text-neutral-500">Add handcrafted shoes or sneakers before proceeding to checkout.</p>
          <Link href="/shop" className="inline-block px-6 py-3 rounded-full bg-neutral-950 text-white text-xs font-bold uppercase tracking-wider">
            Explore Footwear Catalog
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between">
      <AnnouncementBar />
      <Header onOpenSearch={() => {}} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1">
        {/* Checkout Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 pb-5 mb-8">
          <div>
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
              Secure Checkout • 256-Bit SSL
            </span>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-neutral-950">
              {isUrdu ? 'آرڈر چیک آؤٹ' : 'Fast & Secure Checkout'}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
            <Lock className="h-3.5 w-3.5" />
            <span>Encrypted Payment</span>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {cartValidationError && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3 font-medium">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-700" />
              <span>{cartValidationError}</span>
            </div>
            <button
              type="button"
              onClick={runCartValidation}
              disabled={validatingCart}
              className="px-3 py-1.5 rounded-full bg-neutral-950 text-white text-[11px] font-bold uppercase tracking-wider shrink-0 disabled:opacity-50"
            >
              {validatingCart ? 'Checking...' : 'Retry Check'}
            </button>
          </div>
        )}

        {hasInvalidItems && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>
              {invalidCount} {invalidCount === 1 ? 'item in your bag is' : 'items in your bag are'} unavailable or out of stock. Remove flagged {invalidCount === 1 ? 'item' : 'items'} below to continue.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left Column: Checkout Stepper */}
          <div className="lg:col-span-7 space-y-8">
            {/* Step 1: Shipping Destination */}
            <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-3">
                  <span className="h-7 w-7 rounded-full bg-neutral-950 text-white font-black text-xs flex items-center justify-center">
                    1
                  </span>
                  <h2 className="font-bold text-base text-neutral-950">
                    Shipping & Delivery Address
                  </h2>
                </div>
                <span className="text-xs text-neutral-400">Step 1 of 2</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="sm:col-span-2">
                  <label className="font-bold text-neutral-700 block mb-1">
                    Recipient Full Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Syed Hamza Ali"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-950 font-medium"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">
                    Email Address (Optional, for Invoice &amp; Order Tracking)
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. customer@example.com"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-950 font-medium"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">
                    Mobile Phone (For TCS SMS / OTP) *
                  </label>
                  <input
                    type="text"
                    placeholder="+923XXXXXXXXX"
                    value={phone}
                    onChange={(e) => {
                      const nextPhone = e.target.value;
                      setPhone(nextPhone);
                      if (nextPhone.trim() !== phone.trim()) {
                        setCodOtpToken(null);
                        setOtpSent(false);
                        setOtpInput('');
                        setOtpError(null);
                      }
                    }}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-950 font-mono font-medium"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">
                    City (For Shipping Tariff & Courier) *
                  </label>
                  <select
                    value={city}
                    onChange={(e) => handleCitySelectChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-950 font-medium bg-white"
                  >
                    {cityOptions.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  {city === 'Other' && (
                    <input
                      type="text"
                      placeholder="Please enter your city name"
                      value={customCity}
                      onChange={(e) => {
                        setCustomCity(e.target.value);
                        setDeliveryLocation(null);
                      }}
                      className="w-full px-3.5 py-2.5 mt-2 rounded-xl border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-950 font-medium"
                    />
                  )}
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">
                    Village / Mohalla / Home Address *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Village Khar, Tehsil Mamund, Near Jamia Masjid"
                    value={villageAddress}
                    onChange={(e) => setVillageAddress(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-950 font-medium"
                  />
                  <p className="text-xs text-neutral-500 mt-1">Apna Gaon, Mohalla aur ghar ka nishan likhein taake rider asani se ponch sake</p>
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-neutral-700 block mb-1">
                    Street Address & House / Flat # *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. House 42-B, Street 10, Sector F-7/2 or DHA Phase 5"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-950 font-medium"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Postal Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 18500"
                    value={postalCode}
                    onChange={(e) => {
                      setHasEditedPostalCode(true);
                      setPostalCode(e.target.value);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-950 font-medium"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Special Delivery Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Ring bell or call upon arrival"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-950 font-medium"
                  />
                </div>
              </div>

              {/* Interactive OpenStreetMap Address Verification */}
              <div className="pt-2 border-t border-neutral-100">
                <CheckoutAddressMap
                  selectedCity={effectiveCity}
                  villageAddress={villageAddress}
                  streetAddress={street}
                  postalCode={postalCode}
                  confirmedLocation={deliveryLocation}
                  onLocationConfirmed={setDeliveryLocation}
                />
              </div>
            </div>

            {/* Step 2: Payment Method */}
            <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-3">
                  <span className="h-7 w-7 rounded-full bg-neutral-950 text-white font-black text-xs flex items-center justify-center">
                    2
                  </span>
                  <h2 className="font-bold text-base text-neutral-950">Select Payment Method</h2>
                </div>
                <span className="text-xs text-neutral-400">Step 2 of 2</span>
              </div>

              <div className="space-y-3">
                {Object.entries(PAYMENT_METHOD_DETAILS).map(([key, details]) => {
                  const isSelected = paymentMethod === key;
                  return (
                    <div
                      key={key}
                      onClick={() => setPaymentMethod(key as PaymentMethod)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-4 ${
                        isSelected
                          ? 'border-neutral-950 bg-neutral-50/80 ring-1 ring-neutral-950'
                          : 'border-neutral-200 hover:border-neutral-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={isSelected}
                          onChange={() => setPaymentMethod(key as PaymentMethod)}
                          className="mt-1 accent-neutral-950"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-neutral-950">
                              {details.label}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-800">
                              {details.badge}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500 mt-0.5">{details.desc}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Cash on Delivery (COD) Details */}
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                <div className="flex items-start gap-2.5">
                  <Truck className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Cash on Delivery (COD) Nationwide:</strong>
                    <span>
                      Our premier logistics partner (TCS / Leopards Courier) will collect exact amount ({formatPKR(pricing.totalAmount)}) in cash at your doorstep.
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-[11px] text-amber-800">
                  <span>✓ Open-Box Inspection Allowed</span>
                  <span>✓ 7-Day Easy Return / Exchange</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary & Placement */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm space-y-6">
              <h2 className="font-bold text-base text-neutral-950 border-b border-neutral-100 pb-3">
                Order Review ({items.length} {items.length === 1 ? 'Pair' : 'Pairs'})
              </h2>

              {/* Items List Mini */}
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {items.map((item) => {
                  const lineValidation = invalidCartMap[getCartLineKey(item)];
                  const isInvalid = Boolean(lineValidation);
                  return (
                    <div
                      key={`${item.productId}-${item.variantId || `${item.size}-${item.color}`}`}
                      className={`flex gap-3 text-xs rounded-xl p-2 ${
                        isInvalid ? 'bg-red-50 border border-red-200' : ''
                      }`}
                    >
                      <div className="relative h-14 w-14 rounded-lg bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0">
                        {item.image && (
                          <Image src={item.image} alt={item.name} fill referrerPolicy="no-referrer" className="object-cover" sizes="56px" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-neutral-950 line-clamp-1">{item.name}</h4>
                        <p className="text-neutral-500 text-[11px]">
                          Size: {item.size} • Color: {item.color} • Qty: {item.quantity}
                        </p>
                        <span className="font-bold text-neutral-900 block mt-0.5">
                          {formatPKR(item.price * item.quantity)}
                        </span>
                        {lineValidation && (
                          <div className="mt-1.5 space-y-1.5">
                            <p className="text-[11px] font-semibold text-red-700">
                              {lineValidation.message || 'This item is no longer available.'}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                removeItem(item.productId, item.size, item.color, item.variantId)
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold uppercase tracking-wider transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Remove Unavailable Item</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Promotional Coupon Code Box */}
              <div className="pt-4 border-t border-neutral-100 space-y-2.5">
                {appliedCoupon ? (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold">
                      <Tag className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {appliedCoupon.code} applied (-{formatPKR(pricing.discountAmount)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        removeCoupon();
                        setCouponSuccess(null);
                        setCouponError(null);
                      }}
                      className="text-red-600 hover:text-red-700 font-bold text-[11px]"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Promo / Coupon code"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      className="flex-1 px-3 py-2 rounded-xl border border-neutral-300 text-xs uppercase font-medium focus:outline-none focus:ring-1 focus:ring-neutral-950"
                    />
                    <button
                      type="submit"
                      disabled={couponLoading || !couponInput.trim()}
                      className="px-4 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold disabled:opacity-50"
                    >
                      {couponLoading ? '...' : 'Apply'}
                    </button>
                  </form>
                )}
                {couponError && <p className="text-[11px] font-medium text-red-600">{couponError}</p>}
                {couponSuccess && <p className="text-[11px] font-medium text-emerald-600">{couponSuccess}</p>}
              </div>

              {/* Pricing Breakdown */}
              <div className="space-y-2 text-xs pt-4 border-t border-neutral-100 text-neutral-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-neutral-950">{formatPKR(pricing.subtotal)}</span>
                </div>

                {appliedCoupon && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Coupon ({appliedCoupon.code})</span>
                    <span>-{formatPKR(pricing.discountAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span>General Sales Tax (17% GST)</span>
                  <span className="font-semibold text-neutral-950">{formatPKR(pricing.taxAmount)}</span>
                </div>

                <div className="flex justify-between">
                  <span>Courier Shipping ({effectiveCity || 'Select City'})</span>
                  <span className="font-semibold text-neutral-950">
                    {pricing.shippingCharges === 0 ? 'FREE' : formatPKR(pricing.shippingCharges)}
                  </span>
                </div>

                <div className="flex justify-between text-base font-black text-neutral-950 pt-3 border-t border-neutral-200">
                  <span>Total Amount (PKR)</span>
                  <span>{formatPKR(pricing.totalAmount)}</span>
                </div>
              </div>

              {requiresCodOtp && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
                  <Smartphone className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    {codOtpToken ? (
                      <strong className="text-emerald-700">
                        Phone verified for Cash on Delivery above PKR {COD_MAX_LIMIT_WITHOUT_OTP.toLocaleString()}.
                      </strong>
                    ) : (
                      <span>
                        COD orders over <strong>PKR {COD_MAX_LIMIT_WITHOUT_OTP.toLocaleString()}</strong> require a quick 6-digit phone OTP verification before dispatch.
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Order Submission Button */}
              <button
                onClick={handlePlaceOrder}
                disabled={submitting || validatingCart || hasInvalidItems}
                className="w-full py-4 px-6 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-neutral-950/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <span>Processing Order...</span>
                ) : validatingCart ? (
                  <span>Verifying Availability...</span>
                ) : hasInvalidItems ? (
                  <span>Remove Unavailable Items to Continue</span>
                ) : (
                  <>
                    <span>Place Order ({formatPKR(pricing.totalAmount)})</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <div className="text-[11px] text-neutral-400 text-center space-y-1">
                <p>By placing this order you agree to our 7-day return & exchange policy.</p>
                <p>TCS tracking number will be sent via SMS to {phone}.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* COD Phone OTP Verification Modal (Orders > PKR 10,000) */}
      {otpModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="COD Phone Verification"
        >
          <div className="w-full max-w-md rounded-2xl bg-white border border-neutral-200 shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-neutral-950 uppercase tracking-tight">
                    Verify Mobile for COD Order
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Order Total: <strong className="text-neutral-950">{formatPKR(pricing.totalAmount)}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOtpModalOpen(false)}
                className="p-1.5 rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Close OTP dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-xs text-neutral-600 space-y-2">
              <p>
                Cash on Delivery orders exceeding <strong>PKR {COD_MAX_LIMIT_WITHOUT_OTP.toLocaleString()}</strong> require phone verification for{' '}
                <strong className="font-mono text-neutral-950">{phone.trim()}</strong>.
              </p>
              {otpMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium">
                  {otpMessage}
                </div>
              )}
              {otpError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[11px] font-medium">
                  {otpError}
                </div>
              )}
            </div>

            <form onSubmit={handleVerifyOtpAndSubmit} className="space-y-4">
              <div>
                <label className="font-bold text-neutral-700 block mb-1.5 text-xs">
                  Enter 6-Digit OTP Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-digit code"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-300 text-center font-mono text-lg tracking-[0.4em] font-bold focus:outline-none focus:ring-2 focus:ring-neutral-950"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={sendCodOtp}
                  disabled={otpLoading}
                  className="font-bold text-neutral-700 hover:text-neutral-950 underline disabled:opacity-50"
                >
                  {otpLoading ? 'Sending...' : otpSent ? 'Resend OTP Code' : 'Send OTP Code'}
                </button>
                <span className="text-[11px] text-neutral-400">Valid for 10 minutes</span>
              </div>

              <button
                type="submit"
                disabled={otpLoading || otpInput.trim().length < 6}
                className="w-full py-3.5 px-5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50"
              >
                {otpLoading ? 'Verifying OTP...' : 'Verify & Place COD Order'}
              </button>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
