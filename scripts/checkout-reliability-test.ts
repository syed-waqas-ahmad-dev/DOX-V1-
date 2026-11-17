/**
 * @file scripts/checkout-reliability-test.ts
 * @description Offline verification suite for Bajaur OX Shoes production checkout & catalog reliability fixes.
 *
 * Covers:
 * 1. Production fail-closed guards (actions, search route, cart routes, health route, log redaction)
 * 2. Live vs MockDb ID mismatch (`660e1234567890abcdef0006` vs `6acddf5f68edf2d2972975f5`) with zero silent substitution
 * 3. `validateCartProducts` validation and checkout flow with `6acddf5f68edf2d2972975f5` / `6acddf5f68edf2d2972975f6`
 * 4. `useCartStore` variant-scoped updates and removals
 * 5. COD-only payment enforcement in Zod and `createOrder`
 * 6. Strict coupon rejection on invalid/ineligible codes
 * 7. Idempotency replay, ownership enforcement, and E11000 duplicate-key recovery
 *
 * Zero remote DB connections/writes. Strict TypeScript: ZERO `any`.
 */

import Module from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import mongoose, { Types } from 'mongoose';
import { NextRequest } from 'next/server';
import {
  canUseMockDatabase,
  disconnectFromDatabase,
  sanitizeMongoLogMessage,
} from '../lib/db/connect';
import { checkoutOrderSchema } from '../lib/validators';
import { useCartStore } from '../lib/store/cart';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
import { Coupon } from '../models/Coupon';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductBrand,
  ProductCategory,
  ProductSubCategory,
  UserRole,
} from '../types';

let mockNextAuthSession: {
  user?: { id: string; role?: string; email?: string; isEmailVerified?: boolean };
} | null = null;

const moduleRuntime = Module as unknown as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalModuleLoad = moduleRuntime._load;
moduleRuntime._load = function patchedLoad(
  request: string,
  parent: unknown,
  isMain: boolean
): unknown {
  if (request === 'next-auth') {
    const actual = originalModuleLoad.call(this, request, parent, isMain) as Record<
      string,
      unknown
    >;
    return {
      ...actual,
      getServerSession: async () => mockNextAuthSession,
    };
  }
  if (request === 'next/cache') {
    const actual = originalModuleLoad.call(this, request, parent, isMain) as Record<
      string,
      unknown
    >;
    return {
      ...actual,
      revalidatePath: () => undefined,
      revalidateTag: () => undefined,
    };
  }
  return originalModuleLoad.call(this, request, parent, isMain);
};

// Provide minimal browser storage shim for zustand persist middleware in Node
const localStorageMap = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => localStorageMap.get(key) ?? null,
    setItem: (key: string, val: string) => {
      localStorageMap.set(key, String(val));
    },
    removeItem: (key: string) => {
      localStorageMap.delete(key);
    },
    clear: () => {
      localStorageMap.clear();
    },
  },
});

function makeChainableQuery<T>(value: T) {
  const q = {
    session: () => q,
    select: () => q,
    sort: () => q,
    limit: () => q,
    skip: () => q,
    populate: () => q,
    lean: async () => value,
    then: (
      onFulfilled?: ((val: T) => unknown) | null,
      onRejected?: ((err: unknown) => unknown) | null
    ) => Promise.resolve(value).then(onFulfilled ?? undefined, onRejected ?? undefined),
  };
  return q;
}

interface SimVariant {
  _id: Types.ObjectId;
  size: string;
  color: string;
  stock: number;
  sku: string;
}

interface SimProduct {
  _id: Types.ObjectId;
  name: string;
  nameUr: string;
  slug: string;
  sku: string;
  price: number;
  originalPrice: number;
  discount: number;
  category: ProductCategory;
  subCategory: ProductSubCategory;
  brand: ProductBrand;
  sizes: string[];
  colors: Array<{ name: string; hex: string }>;
  variants: SimVariant[];
  stock: number;
  weight: number;
  images: string[];
  isActive: boolean;
  isDeleted: boolean;
}

interface SimOrderDoc {
  _id: Types.ObjectId;
  orderNumber: string;
  userId: Types.ObjectId | null;
  guestEmail?: string;
  guestPhone?: string;
  orderItems: unknown[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingCharges: number;
  totalAmount: number;
  shippingAddress: {
    fullName: string;
    phone: string;
    villageAddress?: string;
    address: string;
    street?: string;
    city: string;
    postalCode?: string;
  };
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  idempotencyKey?: string;
  createdAt: Date;
}

async function runTests() {
  console.log('Starting Checkout & Storefront Reliability Test Suite...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, label: string, detail = '') {
    if (condition) {
      console.log(`  PASS: ${label}${detail ? ` (${detail})` : ''}`);
      passed++;
    } else {
      console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ''}`);
      failed++;
    }
  }

  // Lazy-import actions/routes AFTER Module._load hooks are registered
  const { createOrder } = await import('../actions/order.actions');
  const { getProducts, getProductBySlug, validateCartProducts } = await import(
    '../actions/product.actions'
  );
  const { validateCouponAction, getAllCoupons } = await import('../actions/coupon.actions');
  const { getProductReviews, markReviewHelpful } = await import('../actions/review.actions');
  const { addAddress, deleteAddress } = await import('../actions/user.actions');
  const { getAdminMetrics } = await import('../actions/dashboard.actions');
  const { GET: searchGET } = await import('../app/api/search/route');
  const { POST: cartAddPOST } = await import('../app/api/cart/add/route');
  const { GET: cartListGET } = await import('../app/api/cart/list/route');
  const { POST: cartUpdatePOST } = await import('../app/api/cart/update/route');
  const { POST: cartRemovePOST } = await import('../app/api/cart/remove/route');
  const { GET: healthGET } = await import('../app/api/db/health/route');

  const mutableEnv = process.env as Record<string, string | undefined>;
  const origNodeEnv = mutableEnv.NODE_ENV;
  const origMongoUri = mutableEnv.MONGODB_URI;
  const origMockAuth = mutableEnv.ALLOW_OFFLINE_MOCK_AUTH;
  const origMongooseConnect = mongoose.connect;

  try {
    // -----------------------------------------------------------------------
    // SECTION 1: Production Fail-Closed Guards & Log Redaction
    // -----------------------------------------------------------------------
    console.log('[Section 1] Production Fail-Closed Guards & Health Probe');

    const redacted = sanitizeMongoLogMessage(
      'MongoServerSelectionError connecting to mongodb+srv://adminUser:SuperSecret123@cluster0.abcde.mongodb.net/ox'
    );
    assert(
      !redacted.includes('SuperSecret123') && !redacted.includes('adminUser'),
      'sanitizeMongoLogMessage strips MongoDB credentials'
    );

    mutableEnv.NODE_ENV = 'production';
    mutableEnv.MONGODB_URI = 'mongodb+srv://user:secretpass@cluster0.invalid.mongodb.net/ox';
    delete mutableEnv.ALLOW_OFFLINE_MOCK_AUTH;
    mongoose.connect = (async () => {
      throw new Error('Replica set unreachable');
    }) as unknown as typeof mongoose.connect;

    assert(
      canUseMockDatabase() === false,
      'canUseMockDatabase() returns false in production with MONGODB_URI set'
    );

    const healthRes = await healthGET();
    const healthJson = (await healthRes.json()) as {
      status: string;
      readyState: number;
      connectionError: string | null;
    };
    assert(
      healthJson.status !== 'connected' && healthJson.connectionError === 'Database connection unavailable',
      '/api/db/health does not report false-positive connected when connectToDatabase returns null',
      `status=${healthJson.status}`
    );

    const prodOrderFail = await createOrder({
      items: [
        {
          productId: '660e1234567890abcdef0006',
          size: '41',
          color: 'Charcoal Neon',
          quantity: 1,
        },
      ],
      checkoutData: {
        shippingAddress: {
          fullName: 'Test Customer',
          phone: '+923001234567',
          villageAddress: 'Khar',
          address: 'Main Bazar',
          street: 'Main Bazar',
          city: 'Bajaur',
        },
        paymentMethod: PaymentMethod.COD,
      },
    });
    assert(
      !prodOrderFail.success && prodOrderFail.error.includes('Database connection unavailable'),
      'createOrder fails closed when DB unavailable in production'
    );

    const prodProductsFail = await getProducts({ limit: 8 });
    assert(!prodProductsFail.success, 'getProducts fails closed in production outage');

    const prodSlugFail = await getProductBySlug('margalla-trail-pro-shock-absorbing-joggers');
    assert(!prodSlugFail.success, 'getProductBySlug fails closed in production outage');

    const prodValidateFail = await validateCartProducts([
      {
        productId: '6acddf5f68edf2d2972975f5',
        size: '41',
        color: 'Charcoal Neon',
        quantity: 1,
      },
    ]);
    assert(!prodValidateFail.success, 'validateCartProducts fails closed in production outage');

    const prodCouponFail = await validateCouponAction('WELCOME10', 5500);
    assert(!prodCouponFail.success, 'validateCouponAction fails closed in production outage');

    mockNextAuthSession = {
      user: { id: new Types.ObjectId().toString(), role: UserRole.SUPER_ADMIN },
    };
    const prodAdminCoupons = await getAllCoupons();
    assert(!prodAdminCoupons.success, 'getAllCoupons fails closed in production outage');

    const prodMetrics = await getAdminMetrics();
    assert(!prodMetrics.success, 'getAdminMetrics fails closed in production outage');

    const customerId = new Types.ObjectId().toString();
    mockNextAuthSession = {
      user: { id: customerId, role: UserRole.CUSTOMER },
    };
    const prodAddAddr = await addAddress(customerId, {
      label: 'Home',
      fullName: 'Test Customer',
      phone: '+923001234567',
      street: 'Bazar',
      villageAddress: 'Khar',
      city: 'Bajaur',
      postalCode: '18500',
      isDefault: true,
    });
    assert(!prodAddAddr.success, 'addAddress fails closed instead of returning fake success');

    const prodDelAddr = await deleteAddress(customerId, new Types.ObjectId().toString());
    assert(!prodDelAddr.success, 'deleteAddress fails closed instead of returning fake success');

    const prodReviewsFail = await getProductReviews(new Types.ObjectId().toString());
    assert(!prodReviewsFail.success, 'getProductReviews fails closed in production outage');

    const prodHelpfulFail = await markReviewHelpful(new Types.ObjectId().toString());
    assert(!prodHelpfulFail.success, 'markReviewHelpful fails closed in production outage');

    const searchRes = await searchGET(
      new NextRequest('http://localhost:3000/api/search?q=joggers')
    );
    assert(searchRes.status === 503, '/api/search returns HTTP 503 during DB outage');

    const cartAddRes = await cartAddPOST(
      new NextRequest('http://localhost:3000/api/cart/add', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId: '6acddf5f68edf2d2972975f5', quantity: 1 }),
      })
    );
    assert(cartAddRes.status === 503, '/api/cart/add returns HTTP 503 during DB outage');

    const cartListRes = await cartListGET(new NextRequest('http://localhost:3000/api/cart/list'));
    assert(cartListRes.status === 503, '/api/cart/list returns HTTP 503 during DB outage');

    const cartUpdateRes = await cartUpdatePOST(
      new NextRequest('http://localhost:3000/api/cart/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId: '6acddf5f68edf2d2972975f5', quantity: 2 }),
      })
    );
    assert(cartUpdateRes.status === 503, '/api/cart/update returns HTTP 503 during DB outage');

    const cartRemoveRes = await cartRemovePOST(
      new NextRequest('http://localhost:3000/api/cart/remove', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId: '6acddf5f68edf2d2972975f5' }),
      })
    );
    assert(cartRemoveRes.status === 503, '/api/cart/remove returns HTTP 503 during DB outage');

    const productPageSource = fs.readFileSync(
      path.join(process.cwd(), 'app', 'product', '[slug]', 'page.tsx'),
      'utf8'
    );
    assert(
      !productPageSource.includes('MockDb') &&
        productPageSource.includes('Store Temporarily Unavailable'),
      'app/product/[slug]/page.tsx contains zero MockDb usage and has outage fallback UI'
    );

    // -----------------------------------------------------------------------
    // SECTION 2: Atlas ID Mismatch, Cart Validation, COD-Only, Coupons, Idempotency
    // -----------------------------------------------------------------------
    console.log('\n[Section 2] Live Checkout Validation, COD-Only, Coupons & Idempotency');

    const atlasProductId = new Types.ObjectId('6acddf5f68edf2d2972975f5');
    const atlasVariantId = new Types.ObjectId('6acddf5f68edf2d2972975f6');
    const secondVariantId = new Types.ObjectId('6acddf5f68edf2d2972975f7');

    const atlasCatalog: SimProduct[] = [
      {
        _id: atlasProductId,
        name: 'Margalla Trail Pro Shock-Absorbing Joggers',
        nameUr: 'مارگلہ ٹریل پرو شاک ایبزاربر جاگرز',
        slug: 'margalla-trail-pro-shock-absorbing-joggers',
        sku: 'OX-JOG-010',
        price: 5500,
        originalPrice: 7000,
        discount: 21,
        category: ProductCategory.MEN,
        subCategory: ProductSubCategory.JOGGERS,
        brand: ProductBrand.LOCAL,
        sizes: ['41', '42'],
        colors: [{ name: 'Charcoal Neon', hex: '#333333' }],
        variants: [
          {
            _id: atlasVariantId,
            size: '41',
            color: 'Charcoal Neon',
            stock: 18,
            sku: 'OX-JOG-010-41-NEO',
          },
          {
            _id: secondVariantId,
            size: '42',
            color: 'Charcoal Neon',
            stock: 37,
            sku: 'OX-JOG-010-42-NEO',
          },
        ],
        stock: 55,
        weight: 650,
        images: ['https://example.com/jogger.jpg'],
        isActive: true,
        isDeleted: false,
      },
    ];
    const createdOrders: SimOrderDoc[] = [];
    let simulateDuplicateKeyOnce = false;

    // Stub mongoose connection readyState = 1 + replica set session
    const origReadyDesc = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
    const origClientDesc = Object.getOwnPropertyDescriptor(mongoose.connection, 'client');
    const origStartSession = mongoose.startSession;
    const origProductFind = Product.find;
    const origProductFindOneAndUpdate = Product.findOneAndUpdate;
    const origOrderFindOne = Order.findOne;
    const origOrderCreate = Order.create;
    const origCouponFindOne = Coupon.findOne;

    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      get: () => 1,
    });
    Object.defineProperty(mongoose.connection, 'client', {
      configurable: true,
      get: () => ({
        topology: { description: { type: 'ReplicaSetWithPrimary', logicalSessionTimeoutMinutes: 30 } },
      }),
    });

    const mockDbSession = {
      inTransaction: () => true,
      startTransaction: () => undefined,
      commitTransaction: async () => undefined,
      abortTransaction: async () => undefined,
      endSession: async () => undefined,
    };
    mongoose.startSession = (async () =>
      mockDbSession) as unknown as typeof mongoose.startSession;

    (Product as unknown as { find: unknown }).find = (query: { _id?: { $in?: string[] } }) => {
      const requestedIds = (query._id?.$in || []).map((id) => id.toString());
      const matches = atlasCatalog.filter(
        (p) => requestedIds.includes(p._id.toString()) && p.isActive && !p.isDeleted
      );
      return makeChainableQuery(matches);
    };

    (Product as unknown as { findOneAndUpdate: unknown }).findOneAndUpdate = async (
      filter: {
        _id?: Types.ObjectId | string;
        variants?: { $elemMatch?: { _id?: Types.ObjectId; sku?: string; stock?: { $gte?: number } } };
      },
      update: unknown
    ) => {
      const prod = atlasCatalog.find((p) => p._id.toString() === filter._id?.toString());
      if (!prod) return null;
      const elem = filter.variants?.$elemMatch;
      if (elem && Array.isArray(update)) {
        const targetVar = prod.variants.find(
          (v) =>
            (elem._id && v._id.toString() === elem._id.toString()) ||
            (elem.sku && v.sku === elem.sku)
        );
        const minRequired = elem.stock?.$gte ?? 0;
        if (!targetVar || targetVar.stock < minRequired) return null;
        // Deduct 1 or delta based on pipeline; inspect stock subtraction from filter
        const qtyDelta = Math.max(1, minRequired);
        targetVar.stock -= qtyDelta;
        prod.stock = prod.variants.reduce((sum, v) => sum + v.stock, 0);
        return prod;
      }
      return null;
    };

    (Order as unknown as { findOne: unknown }).findOne = (filter: { idempotencyKey?: string }) => {
      const found = createdOrders.find((o) => o.idempotencyKey === filter.idempotencyKey) || null;
      return makeChainableQuery(found);
    };

    (Order as unknown as { create: unknown }).create = async (docs: Array<Partial<SimOrderDoc>>) => {
      if (simulateDuplicateKeyOnce) {
        simulateDuplicateKeyOnce = false;
        const dupErr = Object.assign(new Error('E11000 duplicate key error collection: orders index: idempotencyKey_1'), {
          code: 11000,
        });
        throw dupErr;
      }
      const input = docs[0];
      const existingDup = input.idempotencyKey
        ? createdOrders.find((o) => o.idempotencyKey === input.idempotencyKey)
        : undefined;
      if (existingDup) {
        const dupErr = Object.assign(new Error('E11000 duplicate key error'), { code: 11000 });
        throw dupErr;
      }
      const created: SimOrderDoc = {
        _id: new Types.ObjectId(),
        orderNumber: input.orderNumber || 'OX-2026-9999',
        userId: (input.userId as Types.ObjectId | null) ?? null,
        guestEmail: input.guestEmail,
        guestPhone: input.guestPhone,
        orderItems: input.orderItems || [],
        subtotal: input.subtotal || 0,
        discountAmount: input.discountAmount || 0,
        taxAmount: input.taxAmount || 0,
        shippingCharges: input.shippingCharges || 0,
        totalAmount: input.totalAmount || 0,
        shippingAddress: input.shippingAddress!,
        status: input.status || OrderStatus.CONFIRMED,
        paymentMethod: input.paymentMethod || PaymentMethod.COD,
        paymentStatus: input.paymentStatus || PaymentStatus.PENDING,
        idempotencyKey: input.idempotencyKey,
        createdAt: new Date(),
      };
      createdOrders.push(created);
      return [created];
    };

    (Coupon as unknown as { findOne: unknown }).findOne = () => null;

    try {
      // 2a. Cart store variant scoping & removing stale MockDb item
      useCartStore.getState().clearCart();
      useCartStore.getState().addItem({
        productId: '660e1234567890abcdef0006',
        name: 'Margalla Trail Pro Shock-Absorbing Joggers',
        nameUr: 'مارگلہ',
        image: 'https://example.com/jogger.jpg',
        size: '41',
        color: 'Charcoal Neon',
        price: 5500,
        originalPrice: 7000,
        sku: 'OX-JOG-010-41-NEO',
        weight: 650,
      });
      useCartStore.getState().addItem({
        productId: '6acddf5f68edf2d2972975f5',
        variantId: '6acddf5f68edf2d2972975f6',
        variantSku: 'OX-JOG-010-41-NEO',
        name: 'Margalla Trail Pro Shock-Absorbing Joggers',
        nameUr: 'مارگلہ',
        image: 'https://example.com/jogger.jpg',
        size: '41',
        color: 'Charcoal Neon',
        price: 5500,
        originalPrice: 7000,
        sku: 'OX-JOG-010-41-NEO',
        weight: 650,
      });
      useCartStore.getState().addItem({
        productId: '6acddf5f68edf2d2972975f5',
        variantId: '6acddf5f68edf2d2972975f7',
        variantSku: 'OX-JOG-010-42-NEO',
        name: 'Margalla Trail Pro Shock-Absorbing Joggers',
        nameUr: 'مارگلہ',
        image: 'https://example.com/jogger.jpg',
        size: '42',
        color: 'Charcoal Neon',
        price: 5500,
        originalPrice: 7000,
        sku: 'OX-JOG-010-42-NEO',
        weight: 650,
      });
      assert(
        useCartStore.getState().items.length === 3,
        'useCartStore preserves distinct variant lines cleanly'
      );

      // Validate stale MockDb ID + valid Atlas ID
      const validationRes = await validateCartProducts(
        useCartStore.getState().items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          variantSku: i.variantSku,
          size: i.size,
          color: i.color,
          quantity: i.quantity,
        }))
      );
      assert(
        validationRes.success &&
          validationRes.data.allValid === false &&
          validationRes.data.results[0].reason === 'product_not_found' &&
          validationRes.data.results[1].valid === true &&
          validationRes.data.results[1].availableStock === 18,
        'validateCartProducts rejects stale MockDb ID 660e...0006 without silent substitution and validates 6acddf...75f5'
      );

      // Remove only variantId 6acddf...75f7 and stale item
      useCartStore.getState().removeItem('6acddf5f68edf2d2972975f5', '42', 'Charcoal Neon', '6acddf5f68edf2d2972975f7');
      assert(
        useCartStore.getState().items.some((i) => i.variantId === '6acddf5f68edf2d2972975f6'),
        'removeItem with variantId removes only the targeted variant'
      );

      // 2b. Attempting createOrder with stale MockDb ID 660e1234567890abcdef0006 must reject cleanly
      const staleOrderRes = await createOrder({
        items: [
          {
            productId: '660e1234567890abcdef0006',
            size: '41',
            color: 'Charcoal Neon',
            quantity: 1,
          },
        ],
        checkoutData: {
          shippingAddress: {
            fullName: 'Bajaur Customer',
            phone: '+923001234567',
            villageAddress: 'Inayat Killi',
            address: 'Golmarket',
            street: 'Golmarket',
            city: 'Bajaur',
            postalCode: '18500',
          },
          paymentMethod: PaymentMethod.COD,
        },
      });
      assert(
        !staleOrderRes.success &&
          staleOrderRes.error === 'One of the selected shoes is no longer available.',
        'createOrder rejects MockDb productId against Atlas without silent substitution'
      );

      // 2c. COD-only checks
      const nonCodZod = checkoutOrderSchema.safeParse({
        shippingAddress: {
          fullName: 'Bajaur Customer',
          phone: '+923001234567',
          villageAddress: 'Inayat Killi',
          address: 'Golmarket',
          street: 'Golmarket',
          city: 'Bajaur',
        },
        paymentMethod: 'Easypaisa',
      });
      assert(!nonCodZod.success, 'checkoutOrderSchema rejects non-COD payment method (Easypaisa)');

      const nonCodOrderRes = await createOrder({
        items: [
          {
            productId: '6acddf5f68edf2d2972975f5',
            variantId: '6acddf5f68edf2d2972975f6',
            variantSku: 'OX-JOG-010-41-NEO',
            size: '41',
            color: 'Charcoal Neon',
            quantity: 1,
          },
        ],
        checkoutData: {
          shippingAddress: {
            fullName: 'Bajaur Customer',
            phone: '+923001234567',
            villageAddress: 'Inayat Killi',
            address: 'Golmarket',
            street: 'Golmarket',
            city: 'Bajaur',
          },
          paymentMethod: 'JazzCash' as unknown as PaymentMethod,
        },
      });
      assert(!nonCodOrderRes.success, 'createOrder rejects non-COD payment method (JazzCash)');

      // 2d. Invalid coupon code is explicitly rejected
      const badCouponOrderRes = await createOrder({
        items: [
          {
            productId: '6acddf5f68edf2d2972975f5',
            variantId: '6acddf5f68edf2d2972975f6',
            variantSku: 'OX-JOG-010-41-NEO',
            size: '41',
            color: 'Charcoal Neon',
            quantity: 1,
          },
        ],
        checkoutData: {
          shippingAddress: {
            fullName: 'Bajaur Customer',
            phone: '+923001234567',
            villageAddress: 'Inayat Killi',
            address: 'Golmarket',
            street: 'Golmarket',
            city: 'Bajaur',
          },
          paymentMethod: PaymentMethod.COD,
          couponCode: 'NONEXISTENT50',
        },
      });
      assert(
        !badCouponOrderRes.success &&
          badCouponOrderRes.error.includes('Invalid or expired promotional coupon'),
        'createOrder rejects unknown coupon instead of charging full price silently'
      );

      // 2e. Valid Atlas order + idempotency replay + cross-user rejection + E11000 recovery
      const ownerId = new Types.ObjectId().toString();
      mockNextAuthSession = { user: { id: ownerId, role: UserRole.CUSTOMER } };
      const idemKey = 'idem-bajaur-order-0001';

      const validOrderRes = await createOrder({
        items: [
          {
            productId: '6acddf5f68edf2d2972975f5',
            variantId: '6acddf5f68edf2d2972975f6',
            variantSku: 'OX-JOG-010-41-NEO',
            size: '41',
            color: 'Charcoal Neon',
            quantity: 1,
          },
        ],
        checkoutData: {
          shippingAddress: {
            fullName: 'Bajaur Customer',
            phone: '+923001234567',
            villageAddress: 'Inayat Killi',
            address: 'Golmarket',
            street: 'Golmarket',
            city: 'Bajaur',
            postalCode: '18500',
          },
          paymentMethod: PaymentMethod.COD,
          idempotencyKey: idemKey,
        },
      });
      assert(
        validOrderRes.success &&
          validOrderRes.data.order.paymentMethod === PaymentMethod.COD &&
          validOrderRes.data.order.paymentStatus === PaymentStatus.PENDING &&
          atlasCatalog[0].variants[0].stock === 17 &&
          atlasCatalog[0].stock === 54,
        'Valid Atlas checkout places COD order and updates variant (18->17) & parent stock (55->54)'
      );

      // Replay with same key & owner
      const replayRes = await createOrder({
        items: [
          {
            productId: '6acddf5f68edf2d2972975f5',
            variantId: '6acddf5f68edf2d2972975f6',
            variantSku: 'OX-JOG-010-41-NEO',
            size: '41',
            color: 'Charcoal Neon',
            quantity: 1,
          },
        ],
        checkoutData: {
          shippingAddress: {
            fullName: 'Bajaur Customer',
            phone: '+923001234567',
            villageAddress: 'Inayat Killi',
            address: 'Golmarket',
            street: 'Golmarket',
            city: 'Bajaur',
            postalCode: '18500',
          },
          paymentMethod: PaymentMethod.COD,
          idempotencyKey: idemKey,
        },
      });
      assert(
        replayRes.success &&
          validOrderRes.success &&
          replayRes.data.order._id.toString() === validOrderRes.data.order._id.toString() &&
          createdOrders.length === 1 &&
          atlasCatalog[0].variants[0].stock === 17,
        'Idempotent replay returns existing order without duplicating order or deducting stock'
      );

      // Cross-user idempotency key theft attempt rejected
      mockNextAuthSession = {
        user: { id: new Types.ObjectId().toString(), role: UserRole.CUSTOMER },
      };
      const hijackRes = await createOrder({
        items: [
          {
            productId: '6acddf5f68edf2d2972975f5',
            variantId: '6acddf5f68edf2d2972975f6',
            size: '41',
            color: 'Charcoal Neon',
            quantity: 1,
          },
        ],
        checkoutData: {
          shippingAddress: {
            fullName: 'Other Customer',
            phone: '+923007654321',
            villageAddress: 'Khar',
            address: 'Street 2',
            street: 'Street 2',
            city: 'Bajaur',
          },
          paymentMethod: PaymentMethod.COD,
          idempotencyKey: idemKey,
        },
      });
      assert(
        !hijackRes.success && hijackRes.error.includes('Unauthorized'),
        'Cross-user replay of another customer idempotencyKey is rejected'
      );

      // E11000 race condition recovery inside Order.create
      mockNextAuthSession = { user: { id: ownerId, role: UserRole.CUSTOMER } };
      const origFindOneFn = (Order as unknown as { findOne: unknown }).findOne;
      let findOneCallCount = 0;
      (Order as unknown as { findOne: unknown }).findOne = (filter: { idempotencyKey?: string }) => {
        findOneCallCount += 1;
        // Simulate pre-check missing concurrent commit (1st call returns null), then E11000 recovery finds existing order
        if (findOneCallCount === 1) {
          return makeChainableQuery(null);
        }
        return (origFindOneFn as (f: { idempotencyKey?: string }) => unknown)(filter);
      };
      simulateDuplicateKeyOnce = true;

      const e11000RecoveryRes = await createOrder({
        items: [
          {
            productId: '6acddf5f68edf2d2972975f5',
            variantId: '6acddf5f68edf2d2972975f6',
            size: '41',
            color: 'Charcoal Neon',
            quantity: 1,
          },
        ],
        checkoutData: {
          shippingAddress: {
            fullName: 'Bajaur Customer',
            phone: '+923001234567',
            villageAddress: 'Inayat Killi',
            address: 'Golmarket',
            street: 'Golmarket',
            city: 'Bajaur',
          },
          paymentMethod: PaymentMethod.COD,
          idempotencyKey: idemKey,
        },
      });
      assert(
        e11000RecoveryRes.success &&
          validOrderRes.success &&
          e11000RecoveryRes.data.order._id.toString() === validOrderRes.data.order._id.toString(),
        'E11000 duplicate idempotencyKey race recovers existing owner order safely'
      );
    } finally {
      if (origReadyDesc) {
        Object.defineProperty(mongoose.connection, 'readyState', origReadyDesc);
      }
      if (origClientDesc) {
        Object.defineProperty(mongoose.connection, 'client', origClientDesc);
      }
      mongoose.startSession = origStartSession;
      (Product as unknown as { find: unknown }).find = origProductFind;
      (Product as unknown as { findOneAndUpdate: unknown }).findOneAndUpdate =
        origProductFindOneAndUpdate;
      (Order as unknown as { findOne: unknown }).findOne = origOrderFindOne;
      (Order as unknown as { create: unknown }).create = origOrderCreate;
      (Coupon as unknown as { findOne: unknown }).findOne = origCouponFindOne;
    }
  } finally {
    await disconnectFromDatabase().catch(() => undefined);
    mongoose.connect = origMongooseConnect;
    mutableEnv.NODE_ENV = origNodeEnv;
    if (origMongoUri === undefined) delete mutableEnv.MONGODB_URI;
    else mutableEnv.MONGODB_URI = origMongoUri;
    if (origMockAuth === undefined) delete mutableEnv.ALLOW_OFFLINE_MOCK_AUTH;
    else mutableEnv.ALLOW_OFFLINE_MOCK_AUTH = origMockAuth;
    mockNextAuthSession = null;
  }

  console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test harness error:', err);
  process.exit(1);
});
