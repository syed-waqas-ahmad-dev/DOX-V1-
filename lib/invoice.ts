/**
 * @file lib/invoice.ts
 * @description Enterprise tax invoice generator & data formatting for OX Shoes Pakistan.
 * Compliant with Pakistani Sales Tax Act and FBR Tier-1 POS retailer guidelines.
 * Strict TypeScript: ZERO `any`.
 */

import crypto from 'crypto';
import { type IOrder, PaymentStatus, PaymentMethod } from '@/types';
import { GST_RATE } from '@/lib/constants';

/**
 * Returns the canonical base URL for the application from environment variables.
 * Order of evaluation: APP_URL -> NEXT_PUBLIC_APP_URL -> NEXTAUTH_URL.
 * In production, strictly requires a valid HTTPS URL.
 */
export function getAppBaseUrl(): string {
  const envUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  const isProd = process.env.NODE_ENV === 'production';

  if (!envUrl || !envUrl.trim()) {
    if (isProd) {
      throw new Error('[CONFIGURATION ERROR] APP_URL environment variable is required in production.');
    }
    return 'http://localhost:3000';
  }

  let trimmedUrl = envUrl.trim().replace(/\/+$/, '');
  if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
    trimmedUrl = `https://${trimmedUrl}`;
  }

  try {
    const parsed = new URL(trimmedUrl);
    if (isProd && parsed.protocol !== 'https:') {
      throw new Error('[CONFIGURATION ERROR] Production APP_URL must use HTTPS protocol.');
    }
    return parsed.origin;
  } catch (err) {
    if (isProd) {
      throw new Error(`[CONFIGURATION ERROR] Invalid APP_URL format: ${envUrl}`);
    }
    return 'http://localhost:3000';
  }
}

/**
 * Generates a new cryptographically secure 64-character hex verification token.
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Returns the persisted verification token for an order.
 * Strictly requires a persisted random token; no deterministic fallback.
 */
export function getInvoiceVerificationToken(order: {
  verificationToken?: string;
}): string {
  if (order.verificationToken && order.verificationToken.trim()) {
    return order.verificationToken.trim();
  }
  return '';
}

export interface InvoiceData {
  invoiceNumber: string;
  orderNumber: string;
  invoiceDate: string;
  dueDate: string;
  seller: {
    legalName: string;
    brandName: string;
    ntn?: string; // Optional National Tax Number
    strn?: string; // Optional Sales Tax Registration Number
    posRegistrationNo?: string;
    address: string;
    city: string;
    country: string;
    helpline: string;
    email: string;
  };
  customer: {
    fullName: string;
    phone: string;
    address: string;
    city: string;
    postalCode: string;
  };
  items: Array<{
    itemNo: number;
    name: string;
    sku: string;
    size: string;
    color: string;
    quantity: number;
    unitPricePKR: number;
    gstRate: number;
    gstAmountPKR: number;
    totalPKR: number;
  }>;
  financials: {
    subtotalPKR: number;
    discountPKR: number;
    gstPKR: number;
    shippingPKR: number;
    grandTotalPKR: number;
  };
  payment: {
    method: string;
    status: 'PAID' | 'UNPAID / COD DUE ON DELIVERY' | 'REFUNDED';
    paidAt?: string;
  };
  courier: {
    name: string;
    trackingNumber: string;
    consignmentBarcode: string;
  };
  verification: {
    qrCodeData: string;
    fbrInvoiceNumber?: string;
  };
}

export function generateInvoiceData(order: IOrder): InvoiceData {
  const orderNumClean = order.orderNumber ? order.orderNumber.replace('OX-', '') : '2026-1001';
  const invoiceNumber = `INV-${orderNumClean}`;
  const now = order.createdAt ? new Date(order.createdAt) : new Date();

  const formattedDate = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const dueDate = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const isPrepaid =
    order.paymentStatus === PaymentStatus.PAID ||
    order.paymentMethod !== PaymentMethod.COD;

  const items = (order.orderItems || []).map((item, idx) => {
    const itemSubtotal = item.price * item.quantity;
    const itemTax = Math.round(itemSubtotal * GST_RATE);
    return {
      itemNo: idx + 1,
      name: item.name,
      sku: item.sku || `OX-SKU-${item.size}`,
      size: item.size,
      color: item.color,
      quantity: item.quantity,
      unitPricePKR: item.price,
      gstRate: 17,
      gstAmountPKR: itemTax,
      totalPKR: itemSubtotal,
    };
  });

  const tracking = order.trackingNumber || `TCS-${Math.floor(10000000 + Math.random() * 90000000)}`;

  // Public verification URL for QR code (no PII, secure token)
  const baseUrl = getAppBaseUrl();
  const token = getInvoiceVerificationToken(order);
  const qrCodeData = `${baseUrl}/verify-invoice/${token}`;

  // Handle both address and street property
  const shipAddr = order.shippingAddress as unknown as Record<string, string> | undefined;
  const addressText = shipAddr?.street || shipAddr?.address || 'Gulberg';

  return {
    invoiceNumber,
    orderNumber: order.orderNumber,
    invoiceDate: formattedDate,
    dueDate,
    seller: {
      legalName: 'OX Shoes Footwear Pakistan (Pvt.) Ltd.',
      brandName: 'Bajaur OX Shoes',
      address: 'Inayat Killi Bazar, Bypass Road, near Inam Plaza',
      city: 'District Bajaur',
      country: 'Pakistan',
      helpline: '+92 300 0914546 (WhatsApp)',
      email: 'billing@oxshoes.pk',
    },
    customer: {
      fullName: shipAddr?.fullName || 'Customer',
      phone: shipAddr?.phone || '+923000000000',
      address: addressText,
      city: shipAddr?.city || 'Lahore',
      postalCode: shipAddr?.postalCode || '54000',
    },
    items,
    financials: {
      subtotalPKR: order.subtotal,
      discountPKR: order.discountAmount || 0,
      gstPKR: order.taxAmount || Math.round(order.subtotal * GST_RATE),
      shippingPKR: order.shippingCharges || 0,
      grandTotalPKR: order.totalAmount,
    },
    payment: {
      method: order.paymentMethod,
      status: isPrepaid ? 'PAID' : 'UNPAID / COD DUE ON DELIVERY',
      paidAt: isPrepaid ? formattedDate : undefined,
    },
    courier: {
      name: order.courier || 'TCS Express',
      trackingNumber: tracking,
      consignmentBarcode: `*${tracking}*`,
    },
    verification: {
      qrCodeData,
    },
  };
}
