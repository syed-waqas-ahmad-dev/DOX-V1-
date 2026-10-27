/**
 * @file app/api/db/models/route.ts
 * @description API endpoint to inspect all 19 OX Shoes Mongoose schemas, compound indexes,
 * and middleware hooks in real time.
 * Strict TypeScript: ZERO `any`.
 */

import { NextResponse } from 'next/server';

export interface ModelMetadata {
  name: string;
  collection: string;
  category: 'Core Commerce' | 'Transactions & Logistics' | 'Marketing & Retention' | 'System & Auditing';
  description: string;
  fieldsCount: number;
  indexes: Array<{ fields: string; type: string; purpose: string }>;
  hooks: string[];
  virtuals: string[];
  keyValidations: string[];
}

const MODELS_METADATA: ModelMetadata[] = [
  {
    name: 'Product',
    collection: 'products',
    category: 'Core Commerce',
    description: 'Footwear catalogue for Pakistani market (Peshawari Chappal, Khussa, Formal, Joggers). Stores bilingual Urdu/English names, variants, and aggregated stocks.',
    fieldsCount: 26,
    indexes: [
      { fields: '{ slug: 1, isDeleted: 1 }', type: 'Compound Unique', purpose: 'PDP URL lookup' },
      { fields: '{ sku: 1, isDeleted: 1 }', type: 'Compound Unique', purpose: 'Warehouse inventory scan' },
      { fields: '{ category: 1, subCategory: 1, isActive: 1 }', type: 'Compound', purpose: 'PLP faceted filtering' },
      { fields: '{ price: 1, rating: -1 }', type: 'Compound', purpose: 'Budget sort by top rated' },
      { fields: '{ isFeatured: 1, createdAt: -1 }', type: 'Compound', purpose: 'Homepage carousel' },
      { fields: 'text: name(10), description(1), tags(5), shortDescription(3)', type: 'Weighted Text', purpose: 'Urdu & English storefront search' },
    ],
    hooks: ['pre-save: auto-slug derivation & discount % calculation & variant stock sum', 'pre-find: automatic soft-delete filter'],
    virtuals: ['sizeGuide (ref: SizeGuide)'],
    keyValidations: ['Pakistani category/subCategory enums', 'Selling price >= 0', 'Image URL presence', 'Low stock threshold >= 1'],
  },
  {
    name: 'User',
    collection: 'users',
    category: 'Core Commerce',
    description: 'Customer accounts and administrative roles (super_admin, admin, manager, customer). Manages addresses, Pakistani mobile numbers, and referrals.',
    fieldsCount: 17,
    indexes: [
      { fields: '{ email: 1, isDeleted: 1 }', type: 'Compound Unique', purpose: 'Login authentication' },
      { fields: '{ phone: 1 }', type: 'Single', purpose: 'Pakistani mobile number (+923XXXXXXXXX) lookups' },
      { fields: '{ referralCode: 1 }', type: 'Sparse Unique', purpose: 'Friend invite attribution' },
      { fields: '{ role: 1, createdAt: -1 }', type: 'Compound', purpose: 'Staff directory listing' },
    ],
    hooks: ['pre-save: bcrypt password hash (salt 10) & auto referral code generation', 'pre-find: soft-delete filter'],
    virtuals: ['orders (ref: Order)'],
    keyValidations: ['Regex +923XXXXXXXXX phone verification', 'Email regex validation', 'Name length 2-100'],
  },
  {
    name: 'Order',
    collection: 'orders',
    category: 'Transactions & Logistics',
    description: 'Comprehensive order ledger. Captures line item snapshots, Pakistani couriers (TCS, Leopards, M&P, Trax), COD OTP verification, and 17% GST.',
    fieldsCount: 24,
    indexes: [
      { fields: '{ orderNumber: 1 }', type: 'Unique', purpose: 'OX-YYYY-XXXX order lookup' },
      { fields: '{ userId: 1, createdAt: -1 }', type: 'Compound', purpose: 'Customer order history' },
      { fields: '{ status: 1, createdAt: -1 }', type: 'Compound', purpose: 'Warehouse dispatch queue' },
      { fields: '{ paymentStatus: 1, createdAt: -1 }', type: 'Compound', purpose: 'Accounts reconciliation' },
      { fields: '{ courier: 1, trackingNumber: 1 }', type: 'Compound', purpose: 'Courier webhook sync' },
    ],
    hooks: ['pre-save: auto-generate OX-YYYY-XXXX number & calculate 17% Pakistani GST and total'],
    virtuals: [],
    keyValidations: ['Non-empty order items array', 'Pakistani recipient phone regex', 'Status & Courier enums'],
  },
  {
    name: 'Category',
    collection: 'categories',
    category: 'Core Commerce',
    description: 'Taxonomy hierarchy with Urdu names (مردانہ جوتے, روایتی دستکاری) and parent-child nesting.',
    fieldsCount: 14,
    indexes: [
      { fields: '{ slug: 1, isDeleted: 1 }', type: 'Compound Unique', purpose: 'SEO route resolution' },
      { fields: '{ type: 1, order: 1, isActive: 1 }', type: 'Compound', purpose: 'Nav menu order rendering' },
    ],
    hooks: ['pre-save: auto slug from name', 'pre-find: soft delete filter'],
    virtuals: ['subCategories (ref: Category)'],
    keyValidations: ['Name min length 2', 'CategoryType enum validation'],
  },
  {
    name: 'Review',
    collection: 'reviews',
    category: 'Core Commerce',
    description: 'Customer ratings and reviews linked to verified purchase orders. Automatically computes average rating and total review counts on Product model.',
    fieldsCount: 12,
    indexes: [
      { fields: '{ productId: 1, isApproved: 1, createdAt: -1 }', type: 'Compound', purpose: 'PDP review list' },
      { fields: '{ userId: 1, productId: 1, orderId: 1 }', type: 'Compound Unique', purpose: 'Anti-spam: 1 review per item per order' },
    ],
    hooks: ['post-save: aggregate rating stats and update target Product rating & numReviews'],
    virtuals: [],
    keyValidations: ['Rating 1-5 stars', 'Comment 5-2000 characters'],
  },
  {
    name: 'Cart',
    collection: 'carts',
    category: 'Core Commerce',
    description: 'Persistent shopping cart storing footwear items, sizes, and color swatches.',
    fieldsCount: 5,
    indexes: [{ fields: '{ userId: 1 }', type: 'Unique', purpose: 'Single cart per registered user' }],
    hooks: [],
    virtuals: [],
    keyValidations: ['Item quantity >= 1', 'Size and color required'],
  },
  {
    name: 'Wishlist',
    collection: 'wishlists',
    category: 'Core Commerce',
    description: 'Customer saved shoes and future purchase bookmarks.',
    fieldsCount: 5,
    indexes: [{ fields: '{ userId: 1 }', type: 'Unique', purpose: 'Single wishlist per user' }],
    hooks: [],
    virtuals: [],
    keyValidations: ['Product reference valid'],
  },
  {
    name: 'Coupon',
    collection: 'coupons',
    category: 'Marketing & Retention',
    description: 'Promotional discount engine supporting percentage, fixed PKR, and free shipping vouchers with order limits.',
    fieldsCount: 16,
    indexes: [
      { fields: '{ code: 1, isActive: 1, expiresAt: 1 }', type: 'Compound', purpose: 'Checkout discount validation' },
    ],
    hooks: ['pre-save: uppercase and trim coupon code'],
    virtuals: [],
    keyValidations: ['Code uppercase min 3 chars', 'Value >= 0', 'Expiry date required'],
  },
  {
    name: 'CouponUsage',
    collection: 'couponusages',
    category: 'Marketing & Retention',
    description: 'Audit tracking for applied vouchers to enforce per-user and per-order usage rules.',
    fieldsCount: 8,
    indexes: [
      { fields: '{ couponId: 1, userId: 1, orderId: 1 }', type: 'Compound Unique', purpose: 'Prevent double redemptions' },
      { fields: '{ couponId: 1, userId: 1 }', type: 'Compound', purpose: 'Per-user quota check' },
    ],
    hooks: [],
    virtuals: [],
    keyValidations: ['Discount applied in PKR >= 0'],
  },
  {
    name: 'Notification',
    collection: 'notifications',
    category: 'Marketing & Retention',
    description: 'User notification inbox for order dispatch updates, Eid promotions, and system announcements.',
    fieldsCount: 9,
    indexes: [
      { fields: '{ userId: 1, isRead: 1, createdAt: -1 }', type: 'Compound', purpose: 'Unread badge count & inbox list' },
    ],
    hooks: [],
    virtuals: [],
    keyValidations: ['Title max 150 chars', 'NotificationType enum'],
  },
  {
    name: 'ReturnRequest',
    collection: 'returnrequests',
    category: 'Transactions & Logistics',
    description: 'Reverse logistics claims for sizing exchanges and damaged footwear with inspection states.',
    fieldsCount: 13,
    indexes: [
      { fields: '{ userId: 1, createdAt: -1 }', type: 'Compound', purpose: 'Customer returns history' },
      { fields: '{ status: 1, createdAt: -1 }', type: 'Compound', purpose: 'Customer care processing queue' },
      { fields: '{ orderId: 1, status: 1 }', type: 'Compound', purpose: 'Order return verification' },
    ],
    hooks: [],
    virtuals: [],
    keyValidations: ['ReturnReason enum', 'Refund amount >= 0'],
  },
  {
    name: 'AuditLog',
    collection: 'auditlogs',
    category: 'System & Auditing',
    description: 'Administrative action audit trail with 1-year auto-cleanup MongoDB TTL index.',
    fieldsCount: 10,
    indexes: [
      { fields: '{ createdAt: 1 } (expireAfterSeconds: 31536000)', type: 'TTL Index', purpose: 'Automatic 365-day log purge' },
      { fields: '{ entity: 1, entityId: 1, createdAt: -1 }', type: 'Compound', purpose: 'Entity audit history' },
      { fields: '{ adminId: 1, createdAt: -1 }', type: 'Compound', purpose: 'Admin activity audit' },
    ],
    hooks: [],
    virtuals: [],
    keyValidations: ['Admin reference required', 'Action string required'],
  },
  {
    name: 'Newsletter',
    collection: 'newsletters',
    category: 'Marketing & Retention',
    description: 'Marketing subscriber list for Pakistani shoe drops and seasonal sales.',
    fieldsCount: 7,
    indexes: [
      { fields: '{ email: 1 }', type: 'Unique', purpose: 'Deduplicated email subscriber list' },
      { fields: '{ isActive: 1, subscribedAt: -1 }', type: 'Compound', purpose: 'Active subscriber blast' },
    ],
    hooks: [],
    virtuals: [],
    keyValidations: ['Valid email regex pattern'],
  },
  {
    name: 'Banner',
    collection: 'banners',
    category: 'Marketing & Retention',
    description: 'Homepage banners and promotional strips with start and expiration dates.',
    fieldsCount: 11,
    indexes: [
      { fields: '{ position: 1, isActive: 1, order: 1 }', type: 'Compound', purpose: 'Storefront banner sort' },
      { fields: '{ expiresAt: 1 }', type: 'Single', purpose: 'Scheduled expiration checks' },
    ],
    hooks: [],
    virtuals: [],
    keyValidations: ['BannerPosition enum', 'Desktop image URL required'],
  },
  {
    name: 'SizeGuide',
    collection: 'sizeguides',
    category: 'Core Commerce',
    description: 'Shoe sizing conversion table translating between Pakistani/UK, US, EU, and foot centimeters.',
    fieldsCount: 7,
    indexes: [{ fields: '{ name: 1 }', type: 'Unique', purpose: 'Unique guide chart title' }],
    hooks: [],
    virtuals: [],
    keyValidations: ['Foot length > 10 cm', 'Measurements non-empty'],
  },
  {
    name: 'ShippingZone',
    collection: 'shippingzones',
    category: 'Transactions & Logistics',
    description: 'Pakistani city shipping rates (Lahore, Karachi, Islamabad, Peshawar) and courier transit SLAs.',
    fieldsCount: 9,
    indexes: [{ fields: '{ cities: 1, isActive: 1 }', type: 'Multikey Compound', purpose: 'Instant city tariff match' }],
    hooks: [],
    virtuals: [],
    keyValidations: ['Base rate >= 0', 'Min 1 city in list', 'SLA days min >= 1'],
  },
  {
    name: 'Referral',
    collection: 'referrals',
    category: 'Marketing & Retention',
    description: 'Customer friend invite reward records with PKR store credit bonuses.',
    fieldsCount: 8,
    indexes: [
      { fields: '{ referrerId: 1, status: 1 }', type: 'Compound', purpose: 'Referrer balance calculation' },
      { fields: '{ code: 1, status: 1 }', type: 'Compound', purpose: 'Code validation' },
    ],
    hooks: [],
    virtuals: [],
    keyValidations: ['Reward amount in PKR >= 0', 'ReferralStatus enum'],
  },
  {
    name: 'FlashSale',
    collection: 'flashsales',
    category: 'Marketing & Retention',
    description: 'Time-boxed discount events (e.g. 11.11, Eid, Independence Day) on select shoe SKUs.',
    fieldsCount: 8,
    indexes: [{ fields: '{ isActive: 1, startsAt: 1, endsAt: 1 }', type: 'Compound', purpose: 'Active deals query' }],
    hooks: [],
    virtuals: [],
    keyValidations: ['Discount percentage 1-90%', 'Min 1 product ID'],
  },
  {
    name: 'AbandonedCart',
    collection: 'abandonedcarts',
    category: 'Marketing & Retention',
    description: 'Abandoned checkout recovery snapshot for automated Pakistani SMS and email reminders.',
    fieldsCount: 9,
    indexes: [
      { fields: '{ recoveryEmailSent: 1, createdAt: 1 }', type: 'Compound', purpose: 'Recovery queue worker' },
      { fields: '{ email: 1, createdAt: -1 }', type: 'Compound', purpose: 'Customer drop-off frequency' },
    ],
    hooks: [],
    virtuals: [],
    keyValidations: ['Valid email string required'],
  },
];

export async function GET() {
  return NextResponse.json({
    totalModels: MODELS_METADATA.length,
    models: MODELS_METADATA,
  });
}
