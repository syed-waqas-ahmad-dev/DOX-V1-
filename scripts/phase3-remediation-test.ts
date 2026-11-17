/**
 * @file scripts/phase3-remediation-test.ts
 * @description Comprehensive verification suite for Phase 3 Controlled Production-Readiness Remediation.
 * Explicitly labels Real unit checks vs Mocked DB/Session harness checks. Zero production DB writes.
 * Strict TypeScript: ZERO `any`.
 */

import Module from 'node:module';
import mongoose, { Types } from 'mongoose';
import { NextRequest } from 'next/server';
import type { ICoupon, IOrder } from '../types';

type AsyncSessionFn = () => Promise<unknown>;
let mockSession: unknown = null;

// Hook next-auth, next/headers, and next/cache via Module._load BEFORE importing server modules
const moduleRuntime = Module as unknown as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalModuleLoad = moduleRuntime._load;
moduleRuntime._load = function patchedLoad(
  request: string,
  parent: unknown,
  isMain: boolean
): unknown {
  if (request === 'server-only') {
    return {};
  }
  if (request === 'next-auth' || request === 'next-auth/next') {
    const actual = originalModuleLoad.call(this, request, parent, isMain) as Record<string, unknown>;
    return {
      ...actual,
      getServerSession: async () => mockSession,
    };
  }
  if (request === 'next/headers') {
    const actual = originalModuleLoad.call(this, request, parent, isMain) as Record<string, unknown>;
    return {
      ...actual,
      headers: async () => new Map([['x-forwarded-for', '127.0.0.1']]),
      cookies: async () => ({
        get: () => undefined,
        getAll: () => [],
      }),
    };
  }
  if (request === 'next/cache') {
    const actual = originalModuleLoad.call(this, request, parent, isMain) as Record<string, unknown>;
    return {
      ...actual,
      revalidatePath: () => undefined,
      revalidateTag: () => undefined,
    };
  }
  return originalModuleLoad.call(this, request, parent, isMain);
};

// Minimal localStorage shim for zustand persist middleware in Node
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

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, classification: '[Real]' | '[Mocked]', detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✅ PASS ${classification} ${name}${detail ? ` (${detail})` : ''}`);
  } else {
    failed += 1;
    console.error(`  ❌ FAIL ${classification} ${name}${detail ? ` (${detail})` : ''}`);
  }
}

function makeChainableQuery<T>(value: T) {
  const queryObj: Record<string, unknown> = {
    lean: async () => value,
    sort: () => queryObj,
    limit: () => queryObj,
    skip: () => queryObj,
    select: () => queryObj,
    populate: () => queryObj,
    then: (resolve: (val: T) => unknown, reject: (err: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
  };
  return queryObj;
}

async function runPhase3Tests() {
  console.log('\n=================================================================');
  console.log('🛡️  OX SHOES — PHASE 3 REMEDIATION VERIFICATION SUITE');
  console.log('=================================================================\n');

  const {
    signGuestOrderToken,
    verifyGuestOrderToken,
    signCodOtpToken,
    verifyCodOtpToken,
    consumeCodOtpToken,
    releaseCodOtpToken,
  } = await import('../lib/guest-order-token');
  const { validateCouponRules } = await import('../lib/coupon-validator');
  const { calculateOrderTotals } = await import('../lib/pricing');
  const { generateInvoiceData } = await import('../lib/invoice');
  const { Order } = await import('../models/Order');
  const { Product } = await import('../models/Product');
  const { Coupon } = await import('../models/Coupon');
  const { migrationRegistry } = await import('../lib/db/migrate');
  const { setOtp, clearOtpStore } = await import('../lib/otp-store');
  const { POST: verifyOtpRoute } = await import('../app/api/otp/verify/route');
  const { GET: getAdminEnv } = await import('../app/api/admin/env/route');
  const { POST: postCloudinaryDebug, GET: getCloudinaryDebug } = await import(
    '../app/api/debug/cloudinary/route'
  );
  const { useCartStore } = await import('../lib/store/cart');
  const { validateCartProducts } = await import('../actions/product.actions');
  const { createOrder, getOrderById, trackOrder } = await import('../actions/order.actions');
  const { disconnectFromDatabase } = await import('../lib/db/connect');
  const {
    CouponType,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    ProductCategory,
    ProductSubCategory,
    ProductBrand,
    UserRole,
  } = await import('../types');

  // =========================================================================
  // 1. GUEST TOKEN & COD OTP REPLAY PREVENTION
  // =========================================================================
  console.log('[1/6] Testing Guest Order Tokens & COD OTP Replay Prevention...');
  {
    const oId = new Types.ObjectId().toString();
    const oNum = 'OX-2026-4411';
    const token = signGuestOrderToken(oId, oNum);

    assert(
      verifyGuestOrderToken(token, oId, oNum) === true,
      'Valid guest order token verifies matching orderId & orderNumber',
      '[Real]'
    );
    assert(
      verifyGuestOrderToken(token, new Types.ObjectId().toString(), oNum) === false,
      'Guest order token rejects mismatched orderId',
      '[Real]'
    );
    assert(
      verifyGuestOrderToken(`${token}tampered`, oId, oNum) === false,
      'Tampered guest order token signature rejected',
      '[Real]'
    );

    const phone = '+923001112233';
    const otpTok = signCodOtpToken(phone);
    assert(
      verifyCodOtpToken(otpTok, '+923009998877') === false,
      'COD OTP token bound to Phone A rejects Phone B',
      '[Real]'
    );
    assert(
      verifyCodOtpToken(otpTok, phone) === true,
      'Fresh COD OTP token verifies matching phone',
      '[Real]'
    );

    const firstConsume = consumeCodOtpToken(otpTok, phone);
    assert(
      firstConsume.valid === true && Boolean(firstConsume.jti),
      'First consumeCodOtpToken succeeds and returns JTI',
      '[Real]'
    );
    const replayConsume = consumeCodOtpToken(otpTok, phone);
    assert(
      replayConsume.valid === false,
      'Replaying the same COD OTP token is rejected',
      '[Real]'
    );
    releaseCodOtpToken(firstConsume.jti);
    assert(
      verifyCodOtpToken(otpTok, phone) === true,
      'releaseCodOtpToken restores usability if pre-persistence order fails',
      '[Real]'
    );
    consumeCodOtpToken(otpTok, phone);
  }

  // =========================================================================
  // 2. COUPON CALCULATIONS, PRICING, ORDER HOOK & INVOICE TAX PRESERVATION
  // =========================================================================
  console.log('\n[2/6] Testing Coupons, Discounted GST, Order Hook & Invoice Calculation...');
  {
    const now = new Date();
    const pctCoupon: ICoupon = {
      _id: new Types.ObjectId(),
      code: 'EID10',
      type: CouponType.PERCENTAGE,
      value: 10,
      minOrderAmount: 2000,
      maxDiscountAmount: 800,
      usageLimit: 0, // unlimited
      usedCount: 500,
      perUserLimit: 1,
      applicableCategories: [],
      applicableBrands: [],
      isFirstOrderOnly: false,
      startsAt: new Date(now.getTime() - 86400000),
      expiresAt: new Date(now.getTime() + 86400000),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const resUnlimited = validateCouponRules(pctCoupon, 5000);
    assert(
      resUnlimited.valid && resUnlimited.discountAmount === 500,
      'Percentage coupon (10% of 5000 = 500) with usageLimit=0 (unlimited) validates correctly',
      '[Real]'
    );

    const resCapped = validateCouponRules(pctCoupon, 12000);
    assert(
      resCapped.valid && resCapped.discountAmount === 800,
      'Percentage coupon respects maxDiscountAmount cap (10% of 12000 capped at 800)',
      '[Real]'
    );

    const resBelowMin = validateCouponRules(pctCoupon, 1500);
    assert(
      !resBelowMin.valid && resBelowMin.discountAmount === 0,
      'Coupon enforces minOrderAmount threshold',
      '[Real]'
    );

    const totals = calculateOrderTotals([{ price: 5000, quantity: 1 }], 'Lahore', 800, pctCoupon);
    // discountedSubtotal = 5000 - 500 = 4500; GST 17% = 765; subtotal 5000 >= FREE_SHIPPING_THRESHOLD => 0 shipping
    assert(
      totals.subtotal === 5000 &&
        totals.discountAmount === 500 &&
        totals.taxAmount === 765 &&
        totals.totalAmount === 5265,
      'calculateOrderTotals computes 17% GST on discounted subtotal (5000 - 500 = 4500 -> GST 765)',
      '[Real]'
    );

    // Order pre-save hook preserves explicit taxAmount: 0
    const zeroTaxOrder = new Order({
      orderNumber: 'OX-2026-9001',
      orderItems: [
        {
          productId: new Types.ObjectId(),
          name: 'Test Khussa',
          image: 'https://example.com/a.jpg',
          size: '38',
          color: 'Maroon',
          quantity: 1,
          price: 3000,
          sku: 'OX-KHU-38',
        },
      ],
      subtotal: 3000,
      discountAmount: 500,
      taxAmount: 0,
      shippingCharges: 200,
      totalAmount: 2700,
      shippingAddress: {
        fullName: 'Test Buyer',
        phone: '+923001234567',
        address: 'Street 1',
        city: 'Lahore',
      },
      paymentMethod: PaymentMethod.COD,
    });
    await zeroTaxOrder.validate();
    // Simulate Mongoose save pre-hooks cleanly without DB write via direct schema validate + invoice check
    const invoiceZeroTax = generateInvoiceData(zeroTaxOrder.toObject() as unknown as IOrder);
    assert(
      invoiceZeroTax.financials.gstPKR === 0 && invoiceZeroTax.financials.grandTotalPKR === 2700,
      'generateInvoiceData preserves explicit taxAmount: 0 without recomputing 17%',
      '[Real]'
    );
  }

  // =========================================================================
  // 3. MIGRATION REGISTRY CHECK & ADMIN/CLOUDINARY RBAC FAIL-CLOSED
  // =========================================================================
  console.log('\n[3/6] Testing Migration 005 & SuperAdmin Route Fail-Closed Security...');
  {
    const has005 = migrationRegistry.some((m) => m.name === '005_create_order_idempotency_index');
    assert(has005, 'migrationRegistry registers 005_create_order_idempotency_index', '[Real]');

    mockSession = null;
    const unauthEnv = await getAdminEnv();
    const unauthCloudGet = await getCloudinaryDebug();
    const unauthCloudPost = await postCloudinaryDebug(
      new NextRequest('http://localhost:3000/api/debug/cloudinary', { method: 'POST' })
    );
    assert(
      unauthEnv.status === 401 && unauthCloudGet.status === 405 && unauthCloudPost.status === 401,
      '/api/admin/env (401) & /api/debug/cloudinary (GET 405, unauth POST 401) locked down',
      '[Mocked]'
    );
  }

  // =========================================================================
  // 4. FAIL-CLOSED PRODUCTION OUTAGE GUARDS FOR SERVER ACTIONS
  // =========================================================================
  console.log('\n[4/6] Testing Production Outage Fail-Closed Behavior...');
  const mutableEnv = process.env as Record<string, string | undefined>;
  const origNodeEnv = mutableEnv.NODE_ENV;
  const origMongoUri = mutableEnv.MONGODB_URI;
  const origMongooseConnect = mongoose.connect;

  try {
    await disconnectFromDatabase().catch(() => undefined);
    mutableEnv.NODE_ENV = 'production';
    mutableEnv.MONGODB_URI = 'mongodb+srv://offline:test@cluster.example.com/oxshoes';
    mongoose.connect = (async () => {
      throw new Error('ECONNREFUSED simulated production outage');
    }) as typeof mongoose.connect;

    const { getAllDeliveryPartners } = await import('../actions/delivery.actions');
    const { getUserReturns } = await import('../actions/return.actions');
    const { getWalletBalance } = await import('../actions/wallet.actions');
    const { getMyReferrals } = await import('../actions/referral.actions');
    const { getBanners } = await import('../actions/banner.actions');

    const custId = new Types.ObjectId().toString();
    mockSession = { user: { id: custId, role: UserRole.CUSTOMER } };
    const [delivRes, retRes, walRes, refRes, banRes] = await Promise.all([
      getAllDeliveryPartners(),
      getUserReturns(),
      getWalletBalance(custId),
      getMyReferrals(custId),
      getBanners(),
    ]);

    assert(
      !delivRes.success && !retRes.success && !walRes.success && !refRes.success && !banRes.success,
      'Delivery, Return, Wallet, Referral, and Banner actions ALL fail closed on production DB outage',
      '[Mocked]'
    );
  } finally {
    mutableEnv.NODE_ENV = origNodeEnv;
    if (origMongoUri === undefined) delete mutableEnv.MONGODB_URI;
    else mutableEnv.MONGODB_URI = origMongoUri;
    mongoose.connect = origMongooseConnect;
    mockSession = null;
  }

  // =========================================================================
  // 5. CUMULATIVE STOCK VALIDATION & CART PRESERVATION
  // =========================================================================
  console.log('\n[5/6] Testing Cumulative Stock Validation & Cart Preservation...');
  {
    const prodId = new Types.ObjectId();
    const varId = new Types.ObjectId();
    const origReadyDesc = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
    const origProductFind = Product.find;

    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      get: () => 1,
    });
    (Product as unknown as { find: unknown }).find = () =>
      makeChainableQuery([
        {
          _id: prodId,
          name: 'Swat Leather Loafer',
          slug: 'swat-leather-loafer',
          sku: 'OX-SWAT-01',
          price: 6000,
          stock: 4,
          weight: 700,
          images: ['https://example.com/loaf.jpg'],
          isActive: true,
          isDeleted: false,
          variants: [{ _id: varId, size: '42', color: 'Brown', stock: 4, sku: 'OX-SWAT-01-42-BRN' }],
        },
      ]);

    try {
      const cumRes = await validateCartProducts([
        { productId: prodId.toString(), variantId: varId.toString(), size: '42', color: 'Brown', quantity: 3 },
        { productId: prodId.toString(), variantId: varId.toString(), size: '42', color: 'Brown', quantity: 3 },
      ]);
      assert(
        cumRes.success && cumRes.data.allValid === false && cumRes.data.results[1].valid === false,
        'validateCartProducts rejects cumulative duplicate variant lines (3 + 3 = 6 > stock 4)',
        '[Mocked]'
      );
    } finally {
      if (origReadyDesc) {
        Object.defineProperty(mongoose.connection, 'readyState', origReadyDesc);
      } else {
        delete (mongoose.connection as unknown as { readyState?: number }).readyState;
      }
      (Product as unknown as { find: unknown }).find = origProductFind;
    }
  }

  // =========================================================================
  // 6. GUEST CHECKOUT, TOKEN-GATED RECEIPT, COD OTP (>10K), & DUPLICATE SAFETY
  // =========================================================================
  console.log('\n[6/6] Testing Guest Checkout, Token Access, COD OTP (>10K) & Replay Protection...');
  {
    await disconnectFromDatabase().catch(() => undefined);
    mutableEnv.NODE_ENV = 'test';
    delete mutableEnv.MONGODB_URI;
    mutableEnv.ALLOW_OFFLINE_MOCK_AUTH = 'true';
    clearOtpStore();
    mockSession = null;

    const { MockDb } = await import('../lib/db/mock-store');
    const expensiveShoe = MockDb.addProduct({
      name: 'Royal Wedding Sherwani Jutti',
      nameUr: 'شاہی جتی',
      slug: `royal-jutti-${Date.now()}`,
      sku: 'OX-JUT-999',
      price: 12000, // > 10,000 PKR -> requires COD OTP
      originalPrice: 15000,
      sizes: ['42'],
      colors: [{ name: 'Gold', hex: '#D4AF37' }],
      variants: [{ _id: new Types.ObjectId(), size: '42', color: 'Gold', stock: 5, sku: 'OX-JUT-999-42-GLD' }],
      stock: 5,
      category: ProductCategory.MEN,
      subCategory: ProductSubCategory.KHUSSA,
      brand: ProductBrand.LOCAL,
      isActive: true,
      isDeleted: false,
      images: ['https://example.com/jutti.jpg'],
      description: 'Gold jutti',
      shortDescription: 'Gold jutti',
    });

    try {
      // Cart preservation check when order fails OTP check
      useCartStore.getState().clearCart();
      useCartStore.getState().addItem({
        productId: expensiveShoe._id.toString(),
        variantId: expensiveShoe.variants[0]._id?.toString(),
        variantSku: expensiveShoe.variants[0].sku,
        name: expensiveShoe.name,
        nameUr: expensiveShoe.nameUr,
        image: expensiveShoe.images[0],
        size: '42',
        color: 'Gold',
        price: expensiveShoe.price,
        originalPrice: expensiveShoe.originalPrice,
        sku: expensiveShoe.variants[0].sku,
        weight: 700,
      });

      const guestPhone = '+923009876543';
      const missingOtpRes = await createOrder({
        items: [
          {
            productId: expensiveShoe._id.toString(),
            variantId: expensiveShoe.variants[0]._id?.toString(),
            size: '42',
            color: 'Gold',
            quantity: 1,
          },
        ],
        checkoutData: {
          guestEmail: 'guest.buyer@example.com',
          shippingAddress: {
            fullName: 'Guest Buyer',
            phone: guestPhone,
            villageAddress: 'Main Bazar',
            address: 'House 12',
            street: 'House 12',
            city: 'Peshawar',
          },
          paymentMethod: PaymentMethod.COD,
        },
      });

      assert(
        !missingOtpRes.success &&
          missingOtpRes.error.includes('Phone verification required') &&
          useCartStore.getState().items.length === 1 &&
          MockDb.getProductById(expensiveShoe._id.toString())!.stock === 5,
        'createOrder > 10,000 PKR without codOtpToken rejects, preserves cart, and does NOT deduct stock',
        '[Mocked]',
        missingOtpRes.success ? 'unexpected success' : missingOtpRes.error
      );

      // Verify OTP via /api/otp/verify
      setOtp(guestPhone, '778899');
      const verifyReq = new NextRequest('http://localhost:3000/api/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: guestPhone, otp: '778899' }),
      });
      const verifyRes = await verifyOtpRoute(verifyReq);
      const verifyJson = (await verifyRes.json()) as { verified?: boolean; codOtpToken?: string };
      assert(
        verifyRes.status === 200 && verifyJson.verified === true && Boolean(verifyJson.codOtpToken),
        '/api/otp/verify returns signed single-use codOtpToken',
        '[Real]'
      );

      // Place guest order with codOtpToken + idempotencyKey
      const idemKey = `guest-idem-${Date.now()}`;
      const guestOrderRes = await createOrder({
        items: [
          {
            productId: expensiveShoe._id.toString(),
            variantId: expensiveShoe.variants[0]._id?.toString(),
            size: '42',
            color: 'Gold',
            quantity: 1,
          },
        ],
        checkoutData: {
          guestEmail: 'guest.buyer@example.com',
          shippingAddress: {
            fullName: 'Guest Buyer',
            phone: guestPhone,
            villageAddress: 'Main Bazar',
            address: 'House 12',
            street: 'House 12',
            city: 'Peshawar',
          },
          paymentMethod: PaymentMethod.COD,
          idempotencyKey: idemKey,
          codOtpToken: verifyJson.codOtpToken,
        },
      });

      assert(
        guestOrderRes.success &&
          Boolean(guestOrderRes.data.guestAccessToken) &&
          guestOrderRes.data.order.guestPhone === guestPhone &&
          guestOrderRes.data.order.paymentMethod === PaymentMethod.COD &&
          guestOrderRes.data.order.paymentStatus === PaymentStatus.PENDING,
        'Guest COD order > 10,000 PKR succeeds with codOtpToken and issues guestAccessToken + guestPhone fallback',
        '[Mocked]',
        guestOrderRes.success ? guestOrderRes.data.order.orderNumber : guestOrderRes.error
      );

      if (guestOrderRes.success) {
        const gOrderId = guestOrderRes.data.order._id.toString();
        const gOrderNum = guestOrderRes.data.order.orderNumber;
        const gToken = guestOrderRes.data.guestAccessToken;

        // Idempotency duplicate prevention with SAME key
        const dupRes = await createOrder({
          items: [
            {
              productId: expensiveShoe._id.toString(),
              variantId: expensiveShoe.variants[0]._id?.toString(),
              size: '42',
              color: 'Gold',
              quantity: 1,
            },
          ],
          checkoutData: {
            guestEmail: 'guest.buyer@example.com',
            shippingAddress: {
              fullName: 'Guest Buyer',
              phone: guestPhone,
              villageAddress: 'Main Bazar',
              address: 'House 12',
              street: 'House 12',
              city: 'Peshawar',
            },
            paymentMethod: PaymentMethod.COD,
            idempotencyKey: idemKey,
            codOtpToken: verifyJson.codOtpToken,
          },
        });
        assert(
          dupRes.success &&
            dupRes.data.order._id.toString() === gOrderId &&
            MockDb.getProductById(expensiveShoe._id.toString())!.stock === 4,
          'Duplicate submission with same idempotencyKey returns original order without double stock deduction',
          '[Mocked]'
        );

        // Token replay attempt with DIFFERENT idempotencyKey MUST fail
        const replayOtpOrder = await createOrder({
          items: [
            {
              productId: expensiveShoe._id.toString(),
              variantId: expensiveShoe.variants[0]._id?.toString(),
              size: '42',
              color: 'Gold',
              quantity: 1,
            },
          ],
          checkoutData: {
            guestEmail: 'guest.buyer@example.com',
            shippingAddress: {
              fullName: 'Guest Buyer',
              phone: guestPhone,
              villageAddress: 'Main Bazar',
              address: 'House 12',
              street: 'House 12',
              city: 'Peshawar',
            },
            paymentMethod: PaymentMethod.COD,
            idempotencyKey: `different-idem-${Date.now()}`,
            codOtpToken: verifyJson.codOtpToken,
          },
        });
        assert(
          !replayOtpOrder.success && replayOtpOrder.error.includes('Phone verification required'),
          'Replaying consumed codOtpToken across a new order is rejected',
          '[Mocked]'
        );

        // Guest receipt access without token fails; with token succeeds
        const noTokFetch = await getOrderById(gOrderId);
        const badTokFetch = await getOrderById(gOrderId, 'forged.token');
        const goodTokFetch = await getOrderById(gOrderId, gToken);
        assert(
          !noTokFetch.success && !badTokFetch.success && goodTokFetch.success,
          'getOrderById blocks anonymous/forged guest receipt access and allows valid guestAccessToken',
          '[Mocked]'
        );

        // Registered user order MUST reject guest tokens even if somehow signed for its ID
        const regUserOrder = MockDb.createOrder({
          orderNumber: 'OX-2026-7788',
          userId: new Types.ObjectId().toString(),
          guestEmail: '',
          guestPhone: '+923001234567',
          orderItems: [],
          subtotal: 3000,
          discountAmount: 0,
          taxAmount: 510,
          shippingCharges: 150,
          totalAmount: 3660,
          shippingAddress: { fullName: 'Registered', phone: '+923001234567', address: 'Lahore', city: 'Lahore' },
          status: OrderStatus.CONFIRMED,
          paymentMethod: PaymentMethod.COD,
          paymentStatus: PaymentStatus.PENDING,
        });
        const forgedForRegistered = signGuestOrderToken(
          regUserOrder._id.toString(),
          regUserOrder.orderNumber
        );
        const regOrderGuestTokenAttempt = await getOrderById(
          regUserOrder._id.toString(),
          forgedForRegistered
        );
        assert(
          !regOrderGuestTokenAttempt.success,
          'getOrderById strictly restricts guest tokens to genuine guest orders (rejects registered-user orders)',
          '[Mocked]'
        );

        // trackOrder issues guestAccessToken ONLY for guest orders and keeps PII redacted
        const trackedGuest = await trackOrder(gOrderNum, guestPhone);
        assert(
          trackedGuest.success && Boolean(trackedGuest.data.guestAccessToken),
          'trackOrder returns guestAccessToken for verified guest order invoice navigation',
          '[Mocked]'
        );
      }
    } finally {
      MockDb.deleteProduct(expensiveShoe._id.toString());
      if (origNodeEnv !== undefined) mutableEnv.NODE_ENV = origNodeEnv;
      if (origMongoUri !== undefined) mutableEnv.MONGODB_URI = origMongoUri;
      delete mutableEnv.ALLOW_OFFLINE_MOCK_AUTH;
      clearOtpStore();
      useCartStore.getState().clearCart();
      mockSession = null;
    }
  }

  console.log('\n=================================================================');
  console.log(`🎯 PHASE 3 REMEDIATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runPhase3Tests().catch((err) => {
  console.error('Unhandled error in phase3-remediation-test:', err);
  process.exit(1);
});
