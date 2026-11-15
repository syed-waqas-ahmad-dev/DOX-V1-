/**
 * @file scripts/test-high-severity-patch.ts
 * @description Focused Verification Suite for Phase 1 High-Severity Corrective Patch (Issues 1-4).
 *
 * Clearly separated test sections:
 *  - SECTION A: Real Application Functions (Checkout Mapper & Intentional MockDb Mode)
 *  - SECTION B: Real Application Functions (Fail-Closed MockDb Guards & Mocked MongoDB Transactions/Concurrency)
 *  - SECTION C: Live MongoDB Verification Status (Honest reporting when MONGODB_URI is absent)
 *
 * Zero production DB writes. Restores all stubs/env vars cleanly in `finally` blocks.
 * Strict TypeScript: ZERO `any`.
 */

import Module from 'node:module';
import mongoose, { Types } from 'mongoose';
import {
  buildCheckoutOrderItems,
  type CartStoreItem,
} from '../lib/store/cart';
import {
  canUseMockDatabase,
  isDatabaseConnected,
} from '../lib/db/connect';
import { MockDb } from '../lib/db/mock-store';
import {
  detectMongoTransactionSupport,
  executeWithOptionalTransaction,
  resetTransactionTopologyCache,
  TransactionUnavailableError,
} from '../lib/services/wallet.service';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
import { Coupon } from '../models/Coupon';
import { CouponUsage } from '../models/CouponUsage';
import { Referral } from '../models/Referral';
import { User } from '../models/User';
import { Notification } from '../models/Notification';
import {
  OrderStatus,
  PaymentMethod,
  ProductBrand,
  ProductCategory,
  ProductSubCategory,
  ReferralStatus,
  UserRole,
} from '../types';

// Intercept `next-auth` getServerSession cleanly for CLI integration tests without adding test hooks to prod files
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

interface MockVariantDoc {
  _id: Types.ObjectId;
  size: string;
  color: string;
  stock: number;
  sku: string;
}

interface MockProductDoc {
  _id: Types.ObjectId;
  name: string;
  nameUr: string;
  slug: string;
  sku: string;
  price: number;
  originalPrice: number;
  weight: number;
  category: ProductCategory;
  subCategory: ProductSubCategory;
  brand: ProductBrand;
  sizes: string[];
  colors: Array<{ name: string; hex: string }>;
  variants: MockVariantDoc[];
  stock: number;
  images: string[];
  isActive: boolean;
  isDeleted: boolean;
}

function makeChainableQuery<T>(value: T) {
  const queryObj = {
    session: () => queryObj,
    select: () => queryObj,
    sort: () => queryObj,
    limit: () => queryObj,
    populate: () => queryObj,
    lean: async () => value,
    then: (
      onFulfilled?: (val: T) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(value).then(onFulfilled, onRejected),
  };
  return queryObj;
}

/**
 * Evaluates our exact MongoDB atomic pipeline update (`$map` + `$reduce`) in memory
 * on a MockProductDoc so mocked-MongoDB tests execute real pipeline semantics.
 */
function evaluateMongoStockPipelineOnDoc(
  doc: MockProductDoc,
  filter: Record<string, unknown>,
  updateOrPipeline: unknown
): MockProductDoc | null {
  const elemMatch = (filter.variants as { $elemMatch?: Record<string, unknown> } | undefined)
    ?.$elemMatch;
  if (!elemMatch) return null;

  const targetVarId = elemMatch._id as Types.ObjectId | string | undefined;
  const targetSku = elemMatch.sku as string | undefined;
  const stockCheck = elemMatch.stock as { $gte?: number } | undefined;
  const minRequired = stockCheck?.$gte ?? 0;

  const matchedIndex = doc.variants.findIndex((v) => {
    const idOk = targetVarId ? v._id.toString() === targetVarId.toString() : true;
    const skuOk = targetSku ? v.sku === targetSku : true;
    const stockOk = v.stock >= minRequired;
    return idOk && skuOk && stockOk;
  });

  if (matchedIndex === -1) {
    return null;
  }

  if (!Array.isArray(updateOrPipeline) || updateOrPipeline.length < 2) {
    throw new Error('Expected 2-stage aggregation pipeline update on Product.findOneAndUpdate');
  }

  const stage1 = updateOrPipeline[0] as {
    $set?: {
      variants?: {
        $map?: {
          in?: {
            $cond?: [unknown, { $mergeObjects?: [string, { stock?: { $max?: [number, { $add?: [unknown, number] }] } }] }, string];
          };
        };
      };
    };
  };
  const delta =
    stage1.$set?.variants?.$map?.in?.$cond?.[1]?.$mergeObjects?.[1]?.stock?.$max?.[1]?.$add?.[1];

  if (typeof delta !== 'number') {
    throw new Error('Could not parse numeric stock delta from aggregation pipeline stage 1');
  }

  // Atomic single-write mutation on cloned doc
  doc.variants[matchedIndex] = {
    ...doc.variants[matchedIndex],
    stock: Math.max(0, doc.variants[matchedIndex].stock + delta),
  };
  doc.stock = doc.variants.reduce((sum, v) => sum + Math.max(0, v.stock), 0);

  return {
    ...doc,
    variants: doc.variants.map((v) => ({ ...v })),
  };
}

async function runHighSeverityPatchTests() {
  const {
    createOrder,
    updateOrderStatus,
    getAllOrders,
    archiveOrder,
  } = await import('../actions/order.actions');
  const {
    getProducts,
    getProductBySlug,
    getAllAdminProducts,
    createProduct,
    updateProduct,
    deleteProduct,
  } = await import('../actions/product.actions');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, detail = '') {
    if (condition) {
      passed++;
      console.log(`  ✅ PASS: ${name}${detail ? ` (${detail})` : ''}`);
    } else {
      failed++;
      console.error(`  ❌ FAIL: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  const validCheckoutData = {
    guestEmail: 'patch.tester@oxshoes.pk',
    guestPhone: '+923001112233',
    shippingAddress: {
      fullName: 'Bilal Ahmad',
      phone: '+923001112233',
      villageAddress: 'Khar Bazar Bajaur',
      address: 'Main Road Khar',
      city: 'Lahore',
      postalCode: '54000',
    },
    paymentMethod: PaymentMethod.COD,
  };

  console.log('========================================================================');
  console.log('OX SHOES - PHASE 1 HIGH-SEVERITY CORRECTIVE PATCH VERIFICATION');
  console.log('========================================================================\n');

  /* ==========================================================================
     SECTION A: REAL APPLICATION FUNCTIONS — MOCKDB MODE
     ========================================================================== */
  console.log('--- SECTION A: Real App Functions (MockDb / Offline Dev Mode) ---\n');

  // Scenario 1: Checkout Payload Mapper (Cart -> createOrder payload)
  console.log('[1] Testing buildCheckoutOrderItems (variantId, variantSku, legacy compatibility, no client trust)...');
  {
    const cartItems: CartStoreItem[] = [
      {
        productId: 'prod-123',
        variantId: 'var-999',
        variantSku: 'OX-JOG-41-CHR',
        name: 'Margalla Trail Pro',
        nameUr: 'مارگلہ ٹریل پرو',
        image: 'https://example.com/shoe.jpg',
        size: '41',
        color: 'Charcoal Neon',
        price: 1, // tampered client price must NOT pass through
        originalPrice: 5500,
        quantity: 2,
        sku: 'OX-JOG-41-CHR',
        weight: 800,
      },
      {
        productId: 'prod-legacy',
        name: 'Legacy Peshawar Chappal',
        nameUr: 'پشاوری چپل',
        image: 'https://example.com/chappal.jpg',
        size: '42',
        color: 'Black',
        price: 3500,
        originalPrice: 3500,
        quantity: 1,
        sku: 'OX-CH-42', // legacy item with no variantId / variantSku
        weight: 700,
      },
    ];

    const payloadItems = buildCheckoutOrderItems(cartItems);
    assert(payloadItems.length === 2, 'Mapped exact count of cart items');
    assert(
      payloadItems[0].variantId === 'var-999' && payloadItems[0].variantSku === 'OX-JOG-41-CHR',
      'Preserved variantId and variantSku on variant item'
    );
    assert(
      !('price' in payloadItems[0]) && !('stock' in payloadItems[0]) && !('sku' in payloadItems[0]),
      'Excluded client price, stock, and generic sku from checkout payload'
    );
    assert(
      payloadItems[1].variantId === undefined &&
        payloadItems[1].variantSku === undefined &&
        payloadItems[1].size === '42' &&
        payloadItems[1].color === 'Black',
      'Preserved legacy cart item compatibility without fabricated variantId/variantSku'
    );
  }

  // Scenario 2, 3, 4, 12a, 13a on MockDb
  console.log('\n[2,3,4,12a,13a] Testing createOrder & MockDb concurrency / restock / rejection...');
  {
    const testShoe = MockDb.addProduct({
      name: 'Patch Test Trail Shoe',
      nameUr: 'ٹیسٹ ٹریل شوز',
      slug: `patch-test-trail-${Date.now()}`,
      sku: 'OX-PT-001',
      price: 5500,
      originalPrice: 6500,
      sizes: ['41', '42'],
      colors: [{ name: 'Charcoal Neon', hex: '#222222' }],
      variants: [
        { _id: new Types.ObjectId(), size: '41', color: 'Charcoal Neon', stock: 5, sku: 'OX-PT-41-CHR' },
        { _id: new Types.ObjectId(), size: '42', color: 'Charcoal Neon', stock: 5, sku: 'OX-PT-42-CHR' },
      ],
      stock: 10,
      tags: ['trail', 'running'],
      isActive: true,
      isDeleted: false,
      images: ['https://example.com/shoe.jpg'],
      description: 'Test',
      shortDescription: 'Test',
    });

    const v41 = testShoe.variants.find((v) => v.size === '41')!;
    const v42 = testShoe.variants.find((v) => v.size === '42')!;

    // Scenario 2: Checkout with explicit variantId & variantSku
    const resVariantId = await createOrder({
      items: [
        {
          productId: testShoe._id.toString(),
          variantId: v41._id?.toString(),
          variantSku: v41.sku,
          size: '41',
          color: 'Charcoal Neon',
          quantity: 1,
        },
      ],
      checkoutData: validCheckoutData,
    });
    assert(resVariantId.success === true, 'Scenario 2: createOrder succeeds with variantId + variantSku');
    const afterS2 = MockDb.getProductById(testShoe._id.toString())!;
    assert(
      afterS2.variants.find((v) => v.size === '41')!.stock === 4 && afterS2.stock === 9,
      'Scenario 2: Variant 41 decremented (5->4) and parent stock reconciled (10->9)'
    );

    // Mismatched size vs variantId fails cleanly
    const ordersBeforeMismatch = MockDb.getAllOrders().length;
    const mismatchRes = await createOrder({
      items: [
        {
          productId: testShoe._id.toString(),
          variantId: v41._id?.toString(),
          size: '42',
          color: 'Charcoal Neon',
          quantity: 1,
        },
      ],
      checkoutData: validCheckoutData,
    });
    assert(mismatchRes.success === false, 'Scenario 2: Mismatched size vs variantId rejected cleanly');
    assert(
      MockDb.getAllOrders().length === ordersBeforeMismatch,
      'Scenario 2: Zero orphan order created on variantId/size mismatch'
    );

    // Scenario 3: Legacy cart item without variantId/variantSku
    const legacyRes = await createOrder({
      items: [
        {
          productId: testShoe._id.toString(),
          size: '42',
          color: 'charcoal neon',
          quantity: 1,
        },
      ],
      checkoutData: validCheckoutData,
    });
    assert(legacyRes.success === true, 'Scenario 3: Legacy cart item without variantId succeeds');

    // Scenario 4: Missing Size 40 rejected cleanly
    const margalla = MockDb.getProducts({ search: 'Margalla Trail Pro' }).products.find(
      (p) => p.sku === 'OX-JOG-010'
    );
    assert(Boolean(margalla), 'Scenario 4: OX-JOG-010 located in MockDb catalog');
    if (margalla) {
      const beforeOrders = MockDb.getAllOrders().length;
      const missingRes = await createOrder({
        items: [
          {
            productId: margalla._id.toString(),
            size: '40',
            color: 'Charcoal Neon',
            quantity: 1,
          },
        ],
        checkoutData: validCheckoutData,
      });
      assert(missingRes.success === false, 'Scenario 4: Missing Size 40 on Margalla Joggers rejected');
      assert(MockDb.getAllOrders().length === beforeOrders, 'Scenario 4: Zero orphan order on missing variant');
    }

    // Scenario 12a: Concurrent orders on DIFFERENT variants of the same product in MockDb
    const [concA, concB] = await Promise.all([
      createOrder({
        items: [
          {
            productId: testShoe._id.toString(),
            variantId: v41._id?.toString(),
            variantSku: v41.sku,
            size: '41',
            color: 'Charcoal Neon',
            quantity: 1,
          },
        ],
        checkoutData: validCheckoutData,
      }),
      createOrder({
        items: [
          {
            productId: testShoe._id.toString(),
            variantId: v42._id?.toString(),
            variantSku: v42.sku,
            size: '42',
            color: 'Charcoal Neon',
            quantity: 1,
          },
        ],
        checkoutData: validCheckoutData,
      }),
    ]);
    const afterConcurrent = MockDb.getProductById(testShoe._id.toString())!;
    const sumAfterConcurrent = afterConcurrent.variants.reduce((s, v) => s + v.stock, 0);
    assert(concA.success && concB.success, 'Scenario 12a: Concurrent different-variant MockDb orders both succeeded');
    assert(
      afterConcurrent.variants.find((v) => v.size === '41')!.stock === 3 &&
        afterConcurrent.variants.find((v) => v.size === '42')!.stock === 3 &&
        afterConcurrent.stock === sumAfterConcurrent &&
        afterConcurrent.stock === 6,
      `Scenario 12a: Parent stock (${afterConcurrent.stock}) equals sum of variants (${sumAfterConcurrent})`
    );

    // Scenario 13a: MockDb idempotent cancellation restock
    if (concA.success) {
      const c1 = MockDb.updateOrderStatus(concA.data.order._id.toString(), {
        status: OrderStatus.CANCELLED,
      });
      const c2 = MockDb.updateOrderStatus(concA.data.order._id.toString(), {
        status: OrderStatus.CANCELLED,
      });
      const afterRestock = MockDb.getProductById(testShoe._id.toString())!;
      assert(
        Boolean(c1?.isRestocked) && Boolean(c2?.isRestocked) &&
          afterRestock.variants.find((v) => v.size === '41')!.stock === 4 &&
          afterRestock.stock === afterRestock.variants.reduce((s, v) => s + v.stock, 0),
        'Scenario 13a: MockDb duplicate cancellation is idempotent & preserves parent stock invariant'
      );
    }

    MockDb.deleteProduct(testShoe._id.toString());
  }

  /* ==========================================================================
     SECTION B: REAL APP FUNCTIONS — FAIL-CLOSED GUARDS & MOCKED MONGODB
     ========================================================================== */
  console.log('\n--- SECTION B: Fail-Closed MockDb Guards & Mocked MongoDB Transactions ---\n');

  // Save originals so everything restores cleanly
  const origEnv = { ...process.env };
  const connObj = mongoose.connection as unknown as Record<string, unknown>;
  const origReadyStateDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  const origGetClient = mongoose.connection.getClient;
  const origDbDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'db');
  const origStartSession = mongoose.startSession;
  const origConnect = mongoose.connect;

  const origProduct = {
    find: Product.find,
    findOne: Product.findOne,
    findById: Product.findById,
    create: Product.create,
    findByIdAndUpdate: Product.findByIdAndUpdate,
    findOneAndUpdate: Product.findOneAndUpdate,
    updateOne: Product.updateOne,
    findByIdAndDelete: Product.findByIdAndDelete,
  };
  const origOrder = {
    find: Order.find,
    findById: Order.findById,
    create: Order.create,
    findByIdAndUpdate: Order.findByIdAndUpdate,
    findOneAndUpdate: Order.findOneAndUpdate,
    countDocuments: Order.countDocuments,
  };
  const origCoupon = {
    findOne: Coupon.findOne,
    findOneAndUpdate: Coupon.findOneAndUpdate,
  };
  const origCouponUsage = {
    create: CouponUsage.create,
    countDocuments: CouponUsage.countDocuments,
  };
  const origReferral = {
    findOne: Referral.findOne,
  };
  const origUser = {
    findById: User.findById,
  };
  const origNotification = {
    create: Notification.create,
  };
  const origMockDb = {
    getProducts: MockDb.getProducts,
    getProductBySlug: MockDb.getProductBySlug,
    getProductById: MockDb.getProductById,
    addProduct: MockDb.addProduct,
    updateProduct: MockDb.updateProduct,
    deleteProduct: MockDb.deleteProduct,
    createOrder: MockDb.createOrder,
    updateOrderStatus: MockDb.updateOrderStatus,
    getAllOrders: MockDb.getAllOrders,
    archiveOrder: MockDb.archiveOrder,
  };

  function setMockReadyState(state: number) {
    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      get: () => state,
      set: () => undefined,
    });
    if (state === 1) {
      (mongoose as unknown as { connect: unknown }).connect = async () => mongoose;
    } else {
      (mongoose as unknown as { connect: unknown }).connect = async () => {
        throw new Error('ECONNREFUSED: Simulated unreachable MongoDB');
      };
    }
  }

  function restoreAllMocks() {
    process.env = { ...origEnv };
    mockNextAuthSession = null;
    resetTransactionTopologyCache();

    if (global.mongooseConnectionCache) {
      global.mongooseConnectionCache.conn = null;
      global.mongooseConnectionCache.promise = null;
    }

    if (origReadyStateDescriptor) {
      Object.defineProperty(mongoose.connection, 'readyState', origReadyStateDescriptor);
    } else {
      delete connObj.readyState;
    }
    if (origDbDescriptor) {
      Object.defineProperty(mongoose.connection, 'db', origDbDescriptor);
    }
    mongoose.connection.getClient = origGetClient;
    mongoose.startSession = origStartSession;
    mongoose.connect = origConnect;

    Object.assign(Product, origProduct);
    Object.assign(Order, origOrder);
    Object.assign(Coupon, origCoupon);
    Object.assign(CouponUsage, origCouponUsage);
    Object.assign(Referral, origReferral);
    Object.assign(User, origUser);
    Object.assign(Notification, origNotification);
    Object.assign(MockDb, origMockDb);
  }

  // Helper to enable authorized Super Admin in mocked MongoDB environment
  function mockAuthorizedAdmin() {
    const adminId = new Types.ObjectId().toString();
    mockNextAuthSession = {
      user: {
        id: adminId,
        role: UserRole.SUPER_ADMIN,
        email: 'admin@oxshoes.pk',
        isEmailVerified: true,
      },
    };
    (User as unknown as { findById: unknown }).findById = () =>
      makeChainableQuery({
        _id: adminId,
        role: UserRole.SUPER_ADMIN,
        department: null,
        permissions: [],
        isDeleted: false,
      });
    return adminId;
  }

  try {
    // Scenario 5: Fake/real DB failure does NOT fall back to MockDb
    console.log('[5] Testing DB failure / configured DB / production fail-closed behavior (zero MockDb fallback)...');
    {
      let mockDbSpyHits = 0;
      MockDb.getProducts = (...args) => {
        mockDbSpyHits++;
        return origMockDb.getProducts(...args);
      };
      MockDb.getProductBySlug = (...args) => {
        mockDbSpyHits++;
        return origMockDb.getProductBySlug(...args);
      };
      MockDb.createOrder = (...args) => {
        mockDbSpyHits++;
        return origMockDb.createOrder(...args);
      };
      MockDb.updateOrderStatus = (...args) => {
        mockDbSpyHits++;
        return origMockDb.updateOrderStatus(...args);
      };
      MockDb.addProduct = (...args) => {
        mockDbSpyHits++;
        return origMockDb.addProduct(...args);
      };
      MockDb.updateProduct = (...args) => {
        mockDbSpyHits++;
        return origMockDb.updateProduct(...args);
      };
      MockDb.getAllOrders = (...args) => {
        mockDbSpyHits++;
        return origMockDb.getAllOrders(...args);
      };
      MockDb.archiveOrder = (...args) => {
        mockDbSpyHits++;
        return origMockDb.archiveOrder(...args);
      };

      // 5a: MONGODB_URI configured but DB disconnected
      process.env.MONGODB_URI = 'mongodb://127.0.0.1:27999/unavailable_ox_db';
      setMockReadyState(0);
      assert(canUseMockDatabase() === false, 'Scenario 5a: canUseMockDatabase is FALSE when MONGODB_URI is configured');

      const prodListRes = await getProducts();
      const slugRes = await getProductBySlug('margalla-trail-pro-joggers');
      const createOrdRes = await createOrder({
        items: [{ productId: new Types.ObjectId().toString(), size: '41', color: 'Black', quantity: 1 }],
        checkoutData: validCheckoutData,
      });
      assert(!prodListRes.success, 'Scenario 5a: getProducts fails explicitly when configured DB is disconnected');
      assert(!slugRes.success, 'Scenario 5a: getProductBySlug fails explicitly when configured DB is disconnected');
      assert(!createOrdRes.success, 'Scenario 5a: createOrder fails explicitly when configured DB is disconnected');

      // 5b: NODE_ENV=production or VERCEL_ENV=preview even with MONGODB_URI unset
      delete process.env.MONGODB_URI;
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      assert(canUseMockDatabase() === false, 'Scenario 5b: canUseMockDatabase is FALSE in production even if URI unset');
      const prodEnvGet = await getProducts();
      assert(!prodEnvGet.success, 'Scenario 5b: getProducts fails closed in production when DB disconnected');

      (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
      process.env.VERCEL_ENV = 'preview';
      assert(canUseMockDatabase() === false, 'Scenario 5b: canUseMockDatabase is FALSE in Vercel preview');
      delete process.env.VERCEL_ENV;

      // 5c: MongoDB connected (`readyState=1`) but queries/writes throw errors
      process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/mocked_db';
      setMockReadyState(1);
      mockAuthorizedAdmin();
      (Product as unknown as { find: unknown }).find = () => {
        throw new Error('ECONNRESET: Simulated MongoDB read failure');
      };
      (Product as unknown as { findOne: unknown }).findOne = () => {
        throw new Error('ECONNRESET: Simulated MongoDB read failure');
      };
      (Order as unknown as { find: unknown }).find = () => {
        throw new Error('ECONNRESET: Simulated MongoDB order read failure');
      };
      (Order as unknown as { findByIdAndUpdate: unknown }).findByIdAndUpdate = () => {
        throw new Error('ECONNRESET: Simulated MongoDB archive failure');
      };

      const errProdRes = await getProducts();
      const errSlugRes = await getProductBySlug('margalla-trail-pro-joggers');
      const errOrdersRes = await getAllOrders();
      const errArchiveRes = await archiveOrder(new Types.ObjectId().toString());
      assert(!errProdRes.success, 'Scenario 5c: getProducts returns error on MongoDB exception');
      assert(!errSlugRes.success, 'Scenario 5c: getProductBySlug returns error on MongoDB exception');
      assert(!errOrdersRes.success, 'Scenario 5c: getAllOrders returns error on MongoDB exception');
      assert(!errArchiveRes.success, 'Scenario 5c: archiveOrder returns error on MongoDB exception');
      assert(mockDbSpyHits === 0, `Scenario 5: Zero MockDb fallback hits occurred (${mockDbSpyHits})`);
      restoreAllMocks();
    }

    // Scenario 6 & 7: Auth/Domain/Validation errors + Product mutation isolation (zero MockDb leak/mirror)
    console.log('\n[6,7] Testing auth/validation/MongoDB error isolation & zero unsanitized MockDb writes...');
    {
      let mockAddCalls = 0;
      let mockUpdateCalls = 0;
      let mockDeleteCalls = 0;
      MockDb.addProduct = (...args) => {
        mockAddCalls++;
        return origMockDb.addProduct(...args);
      };
      MockDb.updateProduct = (...args) => {
        mockUpdateCalls++;
        return origMockDb.updateProduct(...args);
      };
      MockDb.deleteProduct = (...args) => {
        mockDeleteCalls++;
        return origMockDb.deleteProduct(...args);
      };

      // Unauthorized calls must fail closed without MockDb
      mockNextAuthSession = null;
      const unauthAdminProducts = await getAllAdminProducts();
      const unauthUpdateStatus = await updateOrderStatus('ord-mock-1', { status: OrderStatus.CANCELLED });
      const unauthDelete = await deleteProduct('prod-mock-1');
      assert(!unauthAdminProducts.success, 'Scenario 6: Unauthenticated getAllAdminProducts rejected');
      assert(!unauthUpdateStatus.success, 'Scenario 6: Unauthenticated updateOrderStatus rejected');
      assert(!unauthDelete.success, 'Scenario 6: Unauthenticated deleteProduct rejected');

      // Live MongoDB createProduct & updateProduct must NOT mirror to MockDb or pass unsanitized payload on failure
      process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/mocked_db';
      setMockReadyState(1);
      mockAuthorizedAdmin();

      const fakeProdId = new Types.ObjectId();
      (Product as unknown as { create: unknown }).create = async (input: Record<string, unknown>) => ({
        toObject: () => ({ _id: fakeProdId, ...input }),
      });
      const createdOk = await createProduct({
        name: 'Khyber Boot',
        nameUr: 'خیبر بوٹ',
        sku: 'OX-KHY-01',
        price: 6000,
        originalPrice: 7000,
        category: ProductCategory.MEN,
        subCategory: ProductSubCategory.SNEAKERS,
        brand: ProductBrand.LOCAL,
        variants: [{ size: '42', color: 'Black', stock: 5, sku: 'OX-KHY-42-BLK' }],
      });
      assert(createdOk.success === true, 'Scenario 7: Live MongoDB createProduct succeeds');

      // Now simulate MongoDB E11000 failure during createProduct & updateProduct
      (Product as unknown as { create: unknown }).create = async () => {
        throw new Error('MongoServerError: E11000 duplicate key error');
      };
      const createFail = await createProduct({
        name: 'Duplicate Key Boot',
        sku: 'OX-DUP-01',
        price: 5000,
        stock: 3,
      });
      assert(createFail.success === false, 'Scenario 7: MongoDB createProduct failure returns error (not MockDb)');

      (Product as unknown as { findById: unknown }).findById = () =>
        makeChainableQuery({ _id: fakeProdId, name: 'Khyber Boot', variants: [] });
      (Product as unknown as { findByIdAndUpdate: unknown }).findByIdAndUpdate = () =>
        makeChainableQuery(null); // missing doc in MongoDB
      const updateMiss = await updateProduct(fakeProdId.toString(), { price: 6200 });
      assert(updateMiss.success === false, 'Scenario 7: Missing MongoDB updateProduct returns error (not MockDb)');

      assert(
        mockAddCalls === 0 && mockUpdateCalls === 0 && mockDeleteCalls === 0,
        `Scenario 6&7: Zero MockDb mutations occurred (add=${mockAddCalls}, update=${mockUpdateCalls}, delete=${mockDeleteCalls})`
      );
      restoreAllMocks();
    }

    // Scenario 8: Topology detection checks
    console.log('\n[8] Testing detectMongoTransactionSupport() cluster topology inspection...');
    {
      // Disconnected
      setMockReadyState(0);
      resetTransactionTopologyCache();
      const s0 = await detectMongoTransactionSupport();
      assert(!s0.supported && s0.reason === 'NOT_CONNECTED', 'Scenario 8a: Disconnected returns NOT_CONNECTED');

      // Standalone Single (hello has no setName)
      setMockReadyState(1);
      resetTransactionTopologyCache();
      (mongoose.connection as unknown as { getClient: unknown }).getClient = () => ({
        topology: { description: { type: 'Single' } },
      });
      Object.defineProperty(mongoose.connection, 'db', {
        configurable: true,
        get: () => ({
          admin: () => ({
            command: async () => ({
              isWritablePrimary: true,
              logicalSessionTimeoutMinutes: 30,
            }),
          }),
        }),
      });
      const sStandalone = await detectMongoTransactionSupport();
      assert(
        !sStandalone.supported && sStandalone.reason === 'STANDALONE',
        'Scenario 8b: readyState=1 Standalone returns supported=false, STANDALONE'
      );

      // ReplicaSetNoPrimary
      resetTransactionTopologyCache();
      (mongoose.connection as unknown as { getClient: unknown }).getClient = () => ({
        topology: { description: { type: 'ReplicaSetNoPrimary', logicalSessionTimeoutMinutes: 30 } },
      });
      const sNoPrimary = await detectMongoTransactionSupport();
      assert(
        !sNoPrimary.supported && sNoPrimary.reason === 'REPLICA_SET_NO_PRIMARY',
        'Scenario 8c: ReplicaSetNoPrimary returns supported=false'
      );

      // ReplicaSetWithPrimary
      resetTransactionTopologyCache();
      (mongoose.connection as unknown as { getClient: unknown }).getClient = () => ({
        topology: { description: { type: 'ReplicaSetWithPrimary', logicalSessionTimeoutMinutes: 30 } },
      });
      const sRepl = await detectMongoTransactionSupport();
      assert(
        sRepl.supported && sRepl.topologyType === 'ReplicaSetWithPrimary',
        'Scenario 8d: ReplicaSetWithPrimary returns supported=true'
      );

      // Sharded (mongos)
      resetTransactionTopologyCache();
      (mongoose.connection as unknown as { getClient: unknown }).getClient = () => ({
        topology: { description: { type: 'Sharded', logicalSessionTimeoutMinutes: 30 } },
      });
      const sSharded = await detectMongoTransactionSupport();
      assert(sSharded.supported && sSharded.topologyType === 'Sharded', 'Scenario 8e: Sharded returns supported=true');

      // DirectConnection to ReplicaSet Primary (type Single + hello.setName)
      resetTransactionTopologyCache();
      (mongoose.connection as unknown as { getClient: unknown }).getClient = () => ({
        topology: { description: { type: 'Single' } },
      });
      Object.defineProperty(mongoose.connection, 'db', {
        configurable: true,
        get: () => ({
          admin: () => ({
            command: async () => ({
              setName: 'atlas-ox-shard-0',
              isWritablePrimary: true,
              logicalSessionTimeoutMinutes: 30,
            }),
          }),
        }),
      });
      const sDirectRs = await detectMongoTransactionSupport();
      assert(
        sDirectRs.supported && sDirectRs.topologyType === 'DirectReplicaSet',
        'Scenario 8f: DirectReplicaSet with setName returns supported=true'
      );
      restoreAllMocks();
    }

    // Scenario 9 & 10 & 11: Transient retry (fresh session), non-transient no-retry, unsupported topology / startup fail-closed
    console.log('\n[9,10,11] Testing transaction retries, non-transient abort, startup failure & standalone fail-closed...');
    {
      setMockReadyState(1);

      // Configure ReplicaSetWithPrimary
      (mongoose.connection as unknown as { getClient: unknown }).getClient = () => ({
        topology: { description: { type: 'ReplicaSetWithPrimary', logicalSessionTimeoutMinutes: 30 } },
      });

      interface TrackedSession {
        id: number;
        inTx: boolean;
        aborted: number;
        committed: number;
        ended: number;
      }

      const trackedSessions: TrackedSession[] = [];
      let nextSessionId = 1;
      let commitThrowOnceUnknown = false;

      (mongoose as unknown as { startSession: unknown }).startSession = async () => {
        const rec: TrackedSession = {
          id: nextSessionId++,
          inTx: false,
          aborted: 0,
          committed: 0,
          ended: 0,
        };
        trackedSessions.push(rec);
        return {
          inTransaction: () => rec.inTx,
          startTransaction: () => {
            rec.inTx = true;
          },
          abortTransaction: async () => {
            rec.aborted++;
            rec.inTx = false;
          },
          commitTransaction: async () => {
            if (commitThrowOnceUnknown) {
              commitThrowOnceUnknown = false;
              const commitErr = Object.assign(new Error('Unknown commit result'), {
                hasErrorLabel: (label: string) => label === 'UnknownTransactionCommitResult',
              });
              throw commitErr;
            }
            rec.committed++;
            rec.inTx = false;
          },
          endSession: async () => {
            rec.ended++;
            rec.inTx = false;
          },
        };
      };

      // Scenario 9a: TransientTransactionError retries with a BRAND-NEW session
      let transientAttempts = 0;
      const seenSessionRefs: unknown[] = [];
      const res9a = await executeWithOptionalTransaction(async (sess) => {
        transientAttempts++;
        seenSessionRefs.push(sess);
        if (transientAttempts === 1) {
          throw Object.assign(new Error('WriteConflict'), {
            hasErrorLabel: (label: string) => label === 'TransientTransactionError',
          });
        }
        return 'TX_OK';
      });
      assert(res9a === 'TX_OK' && transientAttempts === 2, 'Scenario 9a: TransientTransactionError retried and succeeded');
      assert(
        trackedSessions.length === 2 && seenSessionRefs[0] !== seenSessionRefs[1],
        'Scenario 9a: Fresh session created on retry attempt'
      );
      assert(
        trackedSessions[0].aborted === 1 &&
          trackedSessions[0].committed === 0 &&
          trackedSessions[0].ended === 1 &&
          trackedSessions[1].committed === 1 &&
          trackedSessions[1].ended === 1,
        'Scenario 9a: Attempt 1 aborted/ended cleanly; Attempt 2 committed/ended cleanly'
      );

      // Scenario 9b: UnknownTransactionCommitResult retries commit on same session without duplicating action
      trackedSessions.length = 0;
      commitThrowOnceUnknown = true;
      let actionExecCount = 0;
      const res9b = await executeWithOptionalTransaction(async () => {
        actionExecCount++;
        return 'COMMIT_RETRY_OK';
      });
      assert(
        res9b === 'COMMIT_RETRY_OK' && actionExecCount === 1 && trackedSessions[0].committed === 1,
        'Scenario 9b: UnknownTransactionCommitResult retried commit without duplicating action side-effects'
      );

      // Scenario 10: Non-transient error does NOT retry and does NOT run sessionless fallback
      trackedSessions.length = 0;
      let nonTransientCount = 0;
      let threwNonTransient = false;
      try {
        await executeWithOptionalTransaction(async () => {
          nonTransientCount++;
          throw new Error('Insufficient stock for OX-JOG-010');
        });
      } catch (e) {
        threwNonTransient = (e as Error).message.includes('Insufficient stock');
      }
      assert(
        threwNonTransient &&
          nonTransientCount === 1 &&
          trackedSessions.length === 1 &&
          trackedSessions[0].aborted === 1 &&
          trackedSessions[0].committed === 0 &&
          trackedSessions[0].ended === 1,
        'Scenario 10: Non-transient domain error aborted without retry or sessionless fallback'
      );

      // Scenario 11a: Transaction startup failure does NOT execute action without session
      let actionRanOnStartupFail = false;
      (mongoose as unknown as { startSession: unknown }).startSession = async () => ({
        inTransaction: () => false,
        startTransaction: () => {
          throw new Error('IllegalOperation: Transaction numbers are only allowed on a replica set member');
        },
        endSession: async () => undefined,
      });
      let threwStartup = false;
      try {
        await executeWithOptionalTransaction(async () => {
          actionRanOnStartupFail = true;
          return 'SHOULD_NOT_RUN';
        });
      } catch {
        threwStartup = true;
      }
      assert(
        threwStartup && !actionRanOnStartupFail,
        'Scenario 11a: Failed transaction startup fails safely with zero sessionless execution'
      );

      // Scenario 11b: Unsupported standalone topology rejects createOrder & updateOrderStatus cleanly (zero writes, zero MockDb)
      resetTransactionTopologyCache();
      process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/standalone_db';
      (mongoose.connection as unknown as { getClient: unknown }).getClient = () => ({
        topology: { description: { type: 'Single' } },
      });
      Object.defineProperty(mongoose.connection, 'db', {
        configurable: true,
        get: () => ({
          admin: () => ({
            command: async () => ({
              isWritablePrimary: true,
              logicalSessionTimeoutMinutes: 30,
            }),
          }),
        }),
      });

      const fakeProdId = new Types.ObjectId();
      const standaloneVarId = new Types.ObjectId();
      let dbWriteCallsOnStandalone = 0;
      (Product as unknown as { find: unknown }).find = () =>
        makeChainableQuery([
          {
            _id: fakeProdId,
            name: 'Standalone Test Shoe',
            sku: 'OX-ST-1',
            price: 4500,
            weight: 700,
            stock: 5,
            images: ['https://example.com/1.jpg'],
            variants: [{ _id: standaloneVarId, size: '42', color: 'Black', stock: 5, sku: 'OX-ST-42' }],
          },
        ]);
      (Product as unknown as { findOneAndUpdate: unknown }).findOneAndUpdate = () => {
        dbWriteCallsOnStandalone++;
        return null;
      };
      (Order as unknown as { create: unknown }).create = async () => {
        dbWriteCallsOnStandalone++;
        return [];
      };

      let threwStandaloneDirect = false;
      try {
        await executeWithOptionalTransaction(async () => 'NOPE');
      } catch (e) {
        threwStandaloneDirect = e instanceof TransactionUnavailableError;
      }
      const standaloneOrderRes = await createOrder({
        items: [
          {
            productId: fakeProdId.toString(),
            variantId: standaloneVarId.toString(),
            variantSku: 'OX-ST-42',
            size: '42',
            color: 'Black',
            quantity: 1,
          },
        ],
        checkoutData: validCheckoutData,
      });

      assert(threwStandaloneDirect, 'Scenario 11b: executeWithOptionalTransaction rejects Standalone topology with TransactionUnavailableError');
      assert(
        standaloneOrderRes.success === false && dbWriteCallsOnStandalone === 0,
        'Scenario 11b: createOrder fails safely on Standalone topology with ZERO DB writes'
      );

      restoreAllMocks();
    }

    // Scenario 12b & 13b: Mocked MongoDB Concurrent Different-Variant Orders + Restocking Atomic Pipeline & Referral Rollback
    console.log('\n[12b,13b] Testing mocked MongoDB atomic pipeline parent-stock invariant & idempotent restocking...');
    {
      process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/atlas_rs_db';
      setMockReadyState(1);
      mockAuthorizedAdmin();

      (mongoose.connection as unknown as { getClient: unknown }).getClient = () => ({
        topology: { description: { type: 'ReplicaSetWithPrimary', logicalSessionTimeoutMinutes: 30 } },
      });

      const sharedProductDoc: MockProductDoc = {
        _id: new Types.ObjectId(),
        name: 'Atomic RS Trail Jogger',
        nameUr: 'اٹامک جوگر',
        slug: 'atomic-rs-jogger',
        sku: 'OX-ARS-01',
        price: 5500,
        originalPrice: 6500,
        weight: 800,
        category: ProductCategory.MEN,
        subCategory: ProductSubCategory.SNEAKERS,
        brand: ProductBrand.LOCAL,
        sizes: ['41', '42'],
        colors: [{ name: 'Charcoal Neon', hex: '#222222' }],
        variants: [
          { _id: new Types.ObjectId(), size: '41', color: 'Charcoal Neon', stock: 5, sku: 'OX-ARS-41' },
          { _id: new Types.ObjectId(), size: '42', color: 'Charcoal Neon', stock: 7, sku: 'OX-ARS-42' },
        ],
        stock: 99, // intentionally stale initial parent stock to verify atomic healing!
        images: ['https://example.com/shoe.jpg'],
        isActive: true,
        isDeleted: false,
      };

      const persistedOrders = new Map<string, Record<string, unknown>>();
      let separateUpdateOneCalls = 0;
      let sawUpdatePipelineOption = false;
      let pipelineCallCount = 0;

      // In-memory mocked Mongo session
      (mongoose as unknown as { startSession: unknown }).startSession = async () => {
        let active = false;
        return {
          inTransaction: () => active,
          startTransaction: () => {
            active = true;
          },
          commitTransaction: async () => {
            active = false;
          },
          abortTransaction: async () => {
            active = false;
          },
          endSession: async () => {
            active = false;
          },
        };
      };

      (Product as unknown as { find: unknown }).find = () => makeChainableQuery([sharedProductDoc]);
      (Product as unknown as { findById: unknown }).findById = (id: unknown) =>
        makeChainableQuery(
          id?.toString() === sharedProductDoc._id.toString() ? sharedProductDoc : null
        );
      (Product as unknown as { updateOne: unknown }).updateOne = async () => {
        separateUpdateOneCalls++;
        return { acknowledged: true };
      };
      (Product as unknown as { findOneAndUpdate: unknown }).findOneAndUpdate = async (
        filter: Record<string, unknown>,
        update: unknown,
        options?: { updatePipeline?: boolean }
      ) => {
        pipelineCallCount++;
        if (options?.updatePipeline) sawUpdatePipelineOption = true;
        return evaluateMongoStockPipelineOnDoc(sharedProductDoc, filter, update);
      };
      (Order as unknown as { create: unknown }).create = async (docs: Array<Record<string, unknown>>) => {
        const created = docs.map((d) => {
          const id = new Types.ObjectId();
          const row = { ...d, _id: id, isRestocked: false };
          persistedOrders.set(id.toString(), row);
          return row;
        });
        return created;
      };
      (Order as unknown as { findById: unknown }).findById = (id: string) =>
        makeChainableQuery(persistedOrders.get(id.toString()) ?? null);
      (Order as unknown as { findOneAndUpdate: unknown }).findOneAndUpdate = (
        filter: { _id?: string; isRestocked?: { $ne?: boolean } },
        update: { $set?: Record<string, unknown> }
      ) => {
        const existing = filter._id ? persistedOrders.get(filter._id.toString()) : undefined;
        if (!existing) return makeChainableQuery(null);
        if (filter.isRestocked?.$ne === true && existing.isRestocked === true) {
          return makeChainableQuery(null);
        }
        const nextDoc = { ...existing, ...(update.$set || {}) };
        persistedOrders.set(filter._id!.toString(), nextDoc);
        return makeChainableQuery(nextDoc);
      };
      (Order as unknown as { findByIdAndUpdate: unknown }).findByIdAndUpdate = (
        id: string,
        update: { $set?: Record<string, unknown> }
      ) => {
        const existing = persistedOrders.get(id.toString());
        if (!existing) return makeChainableQuery(null);
        const nextDoc = { ...existing, ...(update.$set || {}) };
        persistedOrders.set(id.toString(), nextDoc);
        return makeChainableQuery(nextDoc);
      };
      (Referral as unknown as { findOne: unknown }).findOne = () => makeChainableQuery(null);
      (Notification as unknown as { create: unknown }).create = async () => ({});

      // Concurrent createOrder calls on Size 41 (qty 2) and Size 42 (qty 3)
      const [rsOrderA, rsOrderB] = await Promise.all([
        createOrder({
          items: [
            {
              productId: sharedProductDoc._id.toString(),
              variantId: sharedProductDoc.variants[0]._id.toString(),
              variantSku: sharedProductDoc.variants[0].sku,
              size: '41',
              color: 'Charcoal Neon',
              quantity: 2,
            },
          ],
          checkoutData: validCheckoutData,
        }),
        createOrder({
          items: [
            {
              productId: sharedProductDoc._id.toString(),
              variantId: sharedProductDoc.variants[1]._id.toString(),
              variantSku: sharedProductDoc.variants[1].sku,
              size: '42',
              color: 'Charcoal Neon',
              quantity: 3,
            },
          ],
          checkoutData: validCheckoutData,
        }),
      ]);

      const expectedSumAfterBuy = sharedProductDoc.variants.reduce((s, v) => s + v.stock, 0);
      assert(rsOrderA.success && rsOrderB.success, 'Scenario 12b: Mocked MongoDB concurrent different-variant orders succeeded');
      assert(separateUpdateOneCalls === 0, 'Scenario 12b: ZERO separate Product.updateOne reconciliation calls made');
      assert(
        sawUpdatePipelineOption && pipelineCallCount === 2,
        'Scenario 12b: Atomic updatePipeline used cleanly on both variant deductions'
      );
      assert(
        sharedProductDoc.variants[0].stock === 3 &&
          sharedProductDoc.variants[1].stock === 4 &&
          sharedProductDoc.stock === expectedSumAfterBuy &&
          sharedProductDoc.stock === 7,
        `Scenario 12b: Stale parent stock healed & synced atomically (${sharedProductDoc.stock} === ${expectedSumAfterBuy})`
      );

      // Scenario 13b: Concurrent cancellation + duplicate cancellation restock idempotency
      if (rsOrderA.success) {
        const orderAId = rsOrderA.data.order._id.toString();
        const [cancel1, cancel2] = await Promise.all([
          updateOrderStatus(orderAId, { status: OrderStatus.CANCELLED }),
          updateOrderStatus(orderAId, { status: OrderStatus.CANCELLED }),
        ]);

        const expectedSumAfterCancel = sharedProductDoc.variants.reduce((s, v) => s + v.stock, 0);
        assert(cancel1.success && cancel2.success, 'Scenario 13b: Concurrent cancellations completed without error');
        assert(
          sharedProductDoc.variants[0].stock === 5 &&
            sharedProductDoc.stock === expectedSumAfterCancel &&
            sharedProductDoc.stock === 9,
          `Scenario 13b: Restocked exactly once (v41=5, total=${sharedProductDoc.stock}) via atomic pipeline`
        );
        assert(separateUpdateOneCalls === 0, 'Scenario 13b: ZERO separate Product.updateOne calls during restocking');
      }

      // Verify transaction aborts if cancelReferralInternal fails inside updateOrderStatus TX
      if (rsOrderB.success) {
        const orderBId = rsOrderB.data.order._id.toString();
        const stockBeforeFail = sharedProductDoc.stock;
        // Take snapshot for rollback simulation in mocked TX
        const snapshotVariants = sharedProductDoc.variants.map((v) => ({ ...v }));
        const snapshotOrders = new Map(
          Array.from(persistedOrders.entries()).map(([k, v]) => [k, { ...v }])
        );

        let txAbortedCount = 0;
        let referralSessionPassed = false;
        (mongoose as unknown as { startSession: unknown }).startSession = async () => {
          let active = false;
          return {
            inTransaction: () => active,
            startTransaction: () => {
              active = true;
            },
            commitTransaction: async () => {
              active = false;
            },
            abortTransaction: async () => {
              txAbortedCount++;
              active = false;
              // Simulate WiredTiger TX abort rollback of uncommitted mutations
              sharedProductDoc.variants = snapshotVariants.map((v) => ({ ...v }));
              sharedProductDoc.stock = stockBeforeFail;
              persistedOrders.clear();
              for (const [k, v] of snapshotOrders.entries()) {
                persistedOrders.set(k, { ...v });
              }
            },
            endSession: async () => {
              active = false;
            },
          };
        };

        (Referral as unknown as { findOne: unknown }).findOne = () => ({
          session: (sess: unknown) => {
            referralSessionPassed = Boolean(sess);
            return Promise.resolve({
              _id: new Types.ObjectId(),
              referrerId: new Types.ObjectId(),
              status: ReferralStatus.APPROVED,
              rewardAmount: 200,
              save: async () => {
                throw new Error('Simulated referral save failure inside TX');
              },
            });
          },
        });
        (User as unknown as { findById: unknown }).findById = (id: unknown) => {
          // Return admin for verifyDepartmentAuth vs zero-balance user for referral
          return makeChainableQuery({
            _id: id,
            role: UserRole.SUPER_ADMIN,
            department: null,
            permissions: [],
            isDeleted: false,
            walletBalance: 0,
          });
        };

        const cancelFailRes = await updateOrderStatus(orderBId, {
          status: OrderStatus.CANCELLED,
        });
        const ordBAfter = persistedOrders.get(orderBId);
        assert(!cancelFailRes.success, 'Scenario 13b: updateOrderStatus failed cleanly when referral TX error occurred');
        assert(
          referralSessionPassed &&
            txAbortedCount === 1 &&
            ordBAfter?.isRestocked === false &&
            sharedProductDoc.stock === stockBeforeFail,
          'Scenario 13b: Referral error aborted parent TX, rolled back isRestocked & stock cleanly'
        );
      }

      restoreAllMocks();
    }
  } finally {
    restoreAllMocks();
  }

  /* ==========================================================================
     SECTION C: LIVE MONGODB STATUS (HONEST ENVIRONMENT REPORTING)
     ========================================================================== */
  console.log('\n--- SECTION C: Live MongoDB Verification Status ---\n');
  const hasLiveUri = Boolean(origEnv.MONGODB_URI?.trim());
  console.log(
    `  ℹ️ INFO: Live MongoDB URI configured: ${hasLiveUri ? 'YES' : 'NO'} | Connected: ${isDatabaseConnected() ? 'YES' : 'NO'}`
  );
  if (!hasLiveUri) {
    console.log(
      '  ℹ️ INFO: Live Replica Set / Standalone MongoDB tests SKIPPED (no MONGODB_URI in sandbox).'
    );
  }

  console.log('\n========================================================================');
  console.log(`🎯 HIGH-SEVERITY PATCH TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runHighSeverityPatchTests().catch((err) => {
  console.error('Fatal test suite error:', err);
  process.exit(1);
});
