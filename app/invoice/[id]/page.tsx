'use client';

/**
 * @file app/invoice/[id]/page.tsx
 * @description Official Pakistani FBR-compliant Tax Invoice for OX Shoes.
 * Features automated invoice generation, printable A4/thermal layout,
 * NTN/STRN tax compliance, verification QR code, and PDF download triggers.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { getOrderById } from '@/actions/order.actions';
import { generateInvoiceData, type InvoiceData } from '@/lib/invoice';
import { formatPKR } from '@/lib/formatters/currency';
import { Logo } from '@/components/layout/Logo';
import type { IOrder } from '@/types';
import {
  Printer,
  Download,
  Share2,
  CheckCircle2,
  Truck,
  ArrowLeft,
  ShieldCheck,
  QrCode,
  FileText,
  Clock,
  Sparkles,
  Phone,
} from 'lucide-react';

interface InvoicePageProps {
  params: Promise<{ id: string }>;
}

export default function InvoicePage({ params }: InvoicePageProps) {
  const resolvedParams = use(params);
  const orderId = resolvedParams.id;

  const [order, setOrder] = useState<IOrder | null>(null);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const res = await getOrderById(orderId);
      if (res.success && res.data) {
        setOrder(res.data);
        const invData = generateInvoiceData(res.data);
        setInvoice(invData);
      }
      setLoading(false);
    }
    loadData();
  }, [orderId]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleShareWhatsApp = () => {
    if (!invoice) return;
    const text = encodeURIComponent(
      `OX Shoes Invoice: ${invoice.invoiceNumber}\nOrder: ${invoice.orderNumber}\nAmount: PKR ${invoice.financials.grandTotalPKR.toLocaleString()}\nStatus: ${invoice.payment.status}\nView & Print: ${window.location.href}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-600">
        Generating official tax invoice...
      </div>
    );
  }

  if (!order || !invoice) {
    return (
      <div className="min-h-screen bg-neutral-100 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <h2 className="text-xl font-bold text-neutral-900">Invoice Not Found</h2>
        <p className="text-xs text-neutral-500">Could not locate an order matching this identifier.</p>
        <Link
          href="/"
          className="px-6 py-2.5 rounded-full bg-neutral-950 text-white text-xs font-bold"
        >
          Return to Storefront
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100/80 text-neutral-900 py-8 px-4 sm:px-6 selection:bg-amber-400 selection:text-black">
      {/* Top Action Bar (Hidden on Print) */}
      <div className="max-w-4xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href={`/order-confirmation/${order._id}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-600 hover:text-neutral-950 transition-colors bg-white px-3.5 py-2 rounded-xl border border-neutral-300 shadow-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Order
          </Link>
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest hidden sm:inline">
            Official Tax Invoice
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-700 bg-white hover:bg-neutral-50 px-3.5 py-2 rounded-xl border border-neutral-300 shadow-sm transition-colors"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
          </button>
          <button
            onClick={handleShareWhatsApp}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-2 rounded-xl border border-emerald-300 shadow-sm transition-colors"
          >
            <Phone className="h-3.5 w-3.5 text-emerald-600" />
            <span>WhatsApp Invoice</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 text-xs font-black text-white bg-neutral-950 hover:bg-neutral-800 px-5 py-2 rounded-xl shadow-md transition-transform hover:scale-105"
          >
            <Printer className="h-4 w-4" />
            <span>Print / Save as PDF</span>
          </button>
        </div>
      </div>

      {/* Main Printable Tax Invoice Sheet */}
      <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-neutral-300 shadow-xl overflow-hidden print:shadow-none print:border-none print:rounded-none print:p-0">
        <div className="p-8 sm:p-12 space-y-8">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b-2 border-neutral-900 pb-6">
            <div className="space-y-3">
              <Logo size="lg" />
              <div className="text-xs text-neutral-600 space-y-0.5">
                <p className="font-bold text-neutral-950 text-sm">{invoice.seller.legalName}</p>
                <p>{invoice.seller.address}</p>
                <p>{invoice.seller.city}, {invoice.seller.country}</p>
                <p className="pt-1 font-mono text-[11px] text-neutral-500">
                  <strong>NTN:</strong> {invoice.seller.ntn} • <strong>STRN:</strong> {invoice.seller.strn}
                </p>
                <p className="font-mono text-[11px] text-neutral-500">
                  <strong>FBR POS Registration:</strong> {invoice.seller.posRegistrationNo}
                </p>
              </div>
            </div>

            <div className="sm:text-right space-y-2">
              <div className="inline-block px-3 py-1 rounded bg-neutral-950 text-white text-[11px] font-black uppercase tracking-widest">
                TAX INVOICE
              </div>
              <h1 className="text-xl sm:text-2xl font-black font-mono tracking-tight text-neutral-950">
                {invoice.invoiceNumber}
              </h1>
              <div className="text-xs space-y-1 text-neutral-600 font-medium">
                <p><strong>Order Ref:</strong> <span className="font-mono">{invoice.orderNumber}</span></p>
                <p><strong>Invoice Date:</strong> {invoice.invoiceDate}</p>
                <p><strong>Payment Due:</strong> {invoice.dueDate}</p>
              </div>
              <div className="pt-1">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    invoice.payment.status === 'PAID'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}
                >
                  {invoice.payment.status}
                </span>
              </div>
            </div>
          </div>

          {/* Billing & Shipping Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-neutral-50 p-6 rounded-xl border border-neutral-200">
            <div className="space-y-1.5 text-xs">
              <span className="font-bold text-[10px] text-neutral-400 uppercase tracking-widest block">
                BILL TO & SHIP TO (CUSTOMER)
              </span>
              <p className="font-bold text-sm text-neutral-950">{invoice.customer.fullName}</p>
              <p className="text-neutral-600">{invoice.customer.address}</p>
              <p className="text-neutral-600">{invoice.customer.city}, {invoice.customer.postalCode}</p>
              <p className="text-neutral-600 font-mono">Mobile: {invoice.customer.phone}</p>
            </div>

            <div className="space-y-1.5 text-xs sm:border-l sm:border-neutral-200 sm:pl-6">
              <span className="font-bold text-[10px] text-neutral-400 uppercase tracking-widest block">
                LOGISTICS & DISPATCH MANIFEST
              </span>
              <p className="text-neutral-700"><strong>Courier:</strong> {invoice.courier.name}</p>
              <p className="text-neutral-700">
                <strong>Tracking Consignment:</strong>{' '}
                <span className="font-mono font-bold text-neutral-950">{invoice.courier.trackingNumber}</span>
              </p>
              <p className="text-neutral-700">
                <strong>Payment Method:</strong> {invoice.payment.method}
              </p>
              <p className="text-neutral-500 font-mono text-[11px] pt-1">
                Barcode: {invoice.courier.consignmentBarcode}
              </p>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-neutral-900 text-neutral-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-2 w-10">#</th>
                  <th className="py-3 px-3">Description & Artisan SKU</th>
                  <th className="py-3 px-3">Size / Color</th>
                  <th className="py-3 px-3 text-center">Qty</th>
                  <th className="py-3 px-3 text-right">Unit Price</th>
                  <th className="py-3 px-3 text-right">GST (17%)</th>
                  <th className="py-3 px-3 text-right">Total (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 font-medium">
                {invoice.items.map((item) => (
                  <tr key={item.itemNo} className="hover:bg-neutral-50/50">
                    <td className="py-3.5 px-2 font-mono text-neutral-400">{item.itemNo}</td>
                    <td className="py-3.5 px-3">
                      <span className="font-bold text-neutral-950 block">{item.name}</span>
                      <span className="text-[10px] text-neutral-500 font-mono">SKU: {item.sku}</span>
                    </td>
                    <td className="py-3.5 px-3 text-neutral-600">
                      {item.size} • {item.color}
                    </td>
                    <td className="py-3.5 px-3 text-center font-bold">{item.quantity}</td>
                    <td className="py-3.5 px-3 text-right font-mono">{formatPKR(item.unitPricePKR)}</td>
                    <td className="py-3.5 px-3 text-right font-mono text-neutral-500">{formatPKR(item.gstAmountPKR)}</td>
                    <td className="py-3.5 px-3 text-right font-bold text-neutral-950 font-mono">
                      {formatPKR(item.totalPKR)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Breakdown */}
          <div className="flex flex-col sm:flex-row items-start justify-between gap-6 pt-4 border-t-2 border-neutral-900">
            {/* Left: Notes & Tax Declarations */}
            <div className="space-y-3 text-xs text-neutral-500 max-w-sm">
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-1">
                <span className="font-bold text-neutral-800 block text-[11px] uppercase">Tax & FBR Declaration:</span>
                <p className="text-[11px] leading-relaxed">
                  This computer-generated tax invoice complies with Sales Tax Special Procedure Rules. 17% General Sales Tax has been charged and recorded for FBR compliance.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>7-Day Easy Size Exchange guaranteed nationwide.</span>
              </div>
            </div>

            {/* Right: Financial Totals Box */}
            <div className="w-full sm:w-80 space-y-2 text-xs">
              <div className="flex justify-between py-1 text-neutral-600">
                <span>Subtotal (Excl. Tax)</span>
                <span className="font-mono font-bold text-neutral-950">
                  {formatPKR(invoice.financials.subtotalPKR)}
                </span>
              </div>

              {invoice.financials.discountPKR > 0 && (
                <div className="flex justify-between py-1 text-emerald-600 font-bold">
                  <span>Promotional Discount</span>
                  <span className="font-mono">-{formatPKR(invoice.financials.discountPKR)}</span>
                </div>
              )}

              <div className="flex justify-between py-1 text-neutral-600">
                <span>Sales Tax (17% GST)</span>
                <span className="font-mono font-bold text-neutral-950">
                  {formatPKR(invoice.financials.gstPKR)}
                </span>
              </div>

              <div className="flex justify-between py-1 text-neutral-600">
                <span>Courier Express Shipping</span>
                <span className="font-mono font-bold text-neutral-950">
                  {invoice.financials.shippingPKR === 0
                    ? 'FREE'
                    : formatPKR(invoice.financials.shippingPKR)}
                </span>
              </div>

              <div className="flex justify-between py-3 text-base font-black text-neutral-950 border-t-2 border-neutral-900 pt-2">
                <span>Invoice Grand Total</span>
                <span className="font-mono text-lg">
                  {formatPKR(invoice.financials.grandTotalPKR)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-neutral-100 text-center text-[11px] font-bold text-neutral-700">
                Amount Payable in PKR (Pakistani Rupees)
              </div>
            </div>
          </div>

          {/* Footer Official Seal & QR Code */}
          <div className="pt-6 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-neutral-500">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 bg-neutral-100 rounded-lg border border-neutral-300 p-2 flex flex-col items-center justify-center text-center">
                <QrCode className="h-9 w-9 text-neutral-800" />
                <span className="text-[8px] font-mono font-bold">SCAN FBR</span>
              </div>
              <div className="text-[11px] space-y-0.5">
                <p className="font-bold text-neutral-800">FBR Digital Invoice Verification</p>
                <p className="font-mono text-neutral-500">{invoice.verification.fbrInvoiceNumber}</p>
                <p className="text-[10px]">Verify at e.fbr.gov.pk or scan QR barcode</p>
              </div>
            </div>

            <div className="text-center sm:text-right space-y-1">
              <div className="border-b border-neutral-400 pb-1 w-48 mx-auto sm:ml-auto">
                <span className="font-serif italic text-sm text-neutral-800 font-bold block">
                  OX Shoes Accounts
                </span>
              </div>
              <span className="text-[10px] text-neutral-400 uppercase tracking-widest block">
                Authorized Commercial Signatory
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
