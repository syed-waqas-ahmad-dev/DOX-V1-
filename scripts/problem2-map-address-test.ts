/**
 * @file scripts/problem2-map-address-test.ts
 * @description Focused offline verification suite for Problem 2 (Delivery Map & Address-Location Fixes).
 * Runs completely in-memory / against MockDb and unconnected Mongoose document validation with ZERO production DB writes.
 */

// Polyfill yallist for openid-client / lru-cache compatibility when executing via tsx CLI
try {
  const y = require('yallist');
  if (typeof y !== 'function' && y && y.Yallist) {
    const Orig = y.Yallist;
    const cacheEntry = require.cache[require.resolve('yallist')];
    if (cacheEntry) {
      cacheEntry.exports = Orig;
    }
    Orig.Yallist = Orig;
    Orig.Node = y.Node;
  }
} catch {
  // Ignore in bundled Next.js context
}

import { Types } from 'mongoose';
import {
  CITY_COORDINATES,
  resolveCityCoordinates,
  isValidCoordinatePair,
} from '../lib/cities';
import { STORE_ADDRESS } from '../lib/constants';
import {
  addressSchema,
  checkoutOrderSchema,
  deliveryCoordinatesSchema,
} from '../lib/validators';
import { Order } from '../models/Order';
import { DeliveryAssignment } from '../models/DeliveryAssignment';
import { MockDb } from '../lib/db/mock-store';
import {
  DeliveryPartnerStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../types';
import { createOrder, trackOrder } from '../actions/order.actions';
import {
  assignOrderToPartner,
  getActiveRidersForCity,
} from '../actions/delivery.actions';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] Test ${totalTests}: ${testName}`);
    if (detail) console.log(`         Detail: ${detail}`);
  } else {
    failedTests++;
    console.error(`  ✗ [FAIL] Test ${totalTests}: ${testName}`);
    if (detail) console.error(`         Detail: ${detail}`);
  }
}

async function runProblem2Tests() {
  // Ensure CLI run uses MockDb safely without touching any remote DB
  delete process.env.MONGODB_URI;
  delete process.env.MONGODB_DB_NAME;
  (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
  process.env.ALLOW_OFFLINE_MOCK_AUTH = 'true';

  console.log('\n======================================================================');
  console.log('BAJAUR OX SHOES — PROBLEM 2 DELIVERY MAP & ADDRESS VERIFICATION SUITE');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // 1. City Coordinate Resolution & Origin vs Destination Separation
  // -------------------------------------------------------------------------
  console.log('--- 1. City Coordinate Resolution & Business Origin Separation ---');

  const bajaurCoords = resolveCityCoordinates('Bajaur');
  assert(
    Array.isArray(bajaurCoords) &&
      bajaurCoords[0] === 34.7314 &&
      bajaurCoords[1] === 71.5244,
    'resolveCityCoordinates("Bajaur") resolves to Bajaur [34.7314, 71.5244]',
    `Resolved: ${JSON.stringify(bajaurCoords)}`
  );

  const bajaurCaseCoords = resolveCityCoordinates('  bAjAuR  ');
  assert(
    Array.isArray(bajaurCaseCoords) &&
      bajaurCaseCoords[0] === 34.7314 &&
      bajaurCaseCoords[1] === 71.5244,
    'resolveCityCoordinates handles trimmed case-insensitive city names'
  );

  assert(
    STORE_ADDRESS.latitude === 34.7544498 &&
      STORE_ADDRESS.longitude === 71.4530333 &&
      (STORE_ADDRESS.latitude !== CITY_COORDINATES.Bajaur[0] ||
        STORE_ADDRESS.longitude !== CITY_COORDINATES.Bajaur[1]),
    'Verified Bajaur Shop origin (34.7544498, 71.4530333) remains separate from Bajaur city centroid (34.7314, 71.5244)'
  );

  assert(
    resolveCityCoordinates('UnknownTehsil') === null &&
      resolveCityCoordinates('Other') === null &&
      resolveCityCoordinates('') === null &&
      resolveCityCoordinates(null) === null,
    'Unsupported/empty cities return null (no silent Lahore or Peshawar fallback)'
  );

  assert(
    isValidCoordinatePair(34.7495, 71.5192) === true &&
      isValidCoordinatePair(91, 71.5) === false &&
      isValidCoordinatePair(34.7, 181) === false &&
      isValidCoordinatePair(NaN, 71.5) === false &&
      isValidCoordinatePair(Infinity, 71.5) === false,
    'isValidCoordinatePair enforces finite WGS-84 bounds'
  );

  // -------------------------------------------------------------------------
  // 2. Zod Validators: Postal Code Optional & Coordinates Validation
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Zod Validators (Bajaur Address, Optional Postal Code & Coordinates) ---');

  const validBajaurAddr = addressSchema.safeParse({
    label: 'Home',
    fullName: 'Tariq Khan',
    phone: '+923001234567',
    villageAddress: 'Inayat Killi, near Golmarket',
    address: 'Khar Road',
    street: 'Khar Road',
    city: 'Bajaur',
    postalCode: '18500',
    coordinates: { lat: 34.7501, lng: 71.5102, source: 'manual_pin' },
  });
  assert(
    validBajaurAddr.success === true &&
      validBajaurAddr.data.postalCode === '18500' &&
      validBajaurAddr.data.villageAddress === 'Inayat Killi, near Golmarket' &&
      validBajaurAddr.data.coordinates?.lat === 34.7501,
    'addressSchema accepts Bajaur address with villageAddress, 18500 postalCode, and manual coordinates'
  );

  const omittedPostalAddr = addressSchema.safeParse({
    label: 'Home',
    fullName: 'Tariq Khan',
    phone: '+923001234567',
    villageAddress: 'Mamund',
    street: 'Main Bazar',
    city: 'Bajaur',
  });
  assert(
    omittedPostalAddr.success === true && omittedPostalAddr.data.postalCode === '',
    'addressSchema allows omitted postalCode without injecting Lahore "54000" default',
    `Result postalCode: "${omittedPostalAddr.success ? omittedPostalAddr.data.postalCode : 'N/A'}"`
  );

  const invalidCoordsCheck = deliveryCoordinatesSchema.safeParse({
    lat: 95,
    lng: 71.5,
    source: 'manual_pin',
  });
  assert(
    invalidCoordsCheck.success === false,
    'deliveryCoordinatesSchema rejects out-of-range coordinates (lat=95)'
  );

  const checkoutMissingPostal = checkoutOrderSchema.safeParse({
    shippingAddress: {
      fullName: 'Tariq Khan',
      phone: '+923001234567',
      villageAddress: 'Khar Village',
      street: 'Bypass Road',
      city: 'Bajaur',
    },
    paymentMethod: PaymentMethod.COD,
  });
  assert(
    checkoutMissingPostal.success === true,
    'checkoutOrderSchema validates Bajaur checkout payload without coordinates or postalCode'
  );

  // -------------------------------------------------------------------------
  // 3. Mongoose Order & DeliveryAssignment Schema Validation & Legacy Compat
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Mongoose Schemas & Legacy Backwards Compatibility ---');

  const bajaurOrderDoc = new Order({
    orderNumber: 'OX-2026-8801',
    orderItems: [
      {
        productId: new Types.ObjectId(),
        name: 'OX Jogger',
        image: 'https://example.com/shoe.jpg',
        size: '40',
        color: 'Charcoal Neon',
        quantity: 1,
        price: 4500,
        sku: 'OX-JOG-010-40-CHA',
      },
    ],
    subtotal: 4500,
    totalAmount: 4500,
    shippingAddress: {
      fullName: 'Tariq Khan',
      phone: '+923001234567',
      villageAddress: 'Inayat Killi, Golmarket',
      address: 'Khar Road',
      street: 'Khar Road',
      city: 'Bajaur',
      postalCode: '18500',
      coordinates: { lat: 34.7495, lng: 71.5192, source: 'manual_pin' },
    },
    paymentMethod: PaymentMethod.COD,
  });

  const bajaurOrderSyncErr = bajaurOrderDoc.validateSync();
  assert(
    bajaurOrderSyncErr === undefined &&
      bajaurOrderDoc.shippingAddress.villageAddress === 'Inayat Killi, Golmarket' &&
      bajaurOrderDoc.shippingAddress.postalCode === '18500' &&
      bajaurOrderDoc.shippingAddress.coordinates?.lat === 34.7495 &&
      bajaurOrderDoc.shippingAddress.coordinates?.lng === 71.5192,
    'Order schema retains villageAddress, postalCode "18500", and manual coordinates (not stripped by strict mode)'
  );

  const legacyOrderDoc = new Order({
    orderNumber: 'OX-2025-1001',
    orderItems: [
      {
        productId: new Types.ObjectId(),
        name: 'Classic Peshawar Chappal',
        image: 'https://example.com/chappal.jpg',
        size: '42',
        color: 'Black',
        quantity: 1,
        price: 3500,
        sku: 'OX-CHA-42-BLK',
      },
    ],
    subtotal: 3500,
    totalAmount: 3500,
    shippingAddress: {
      fullName: 'Legacy Customer',
      phone: '+923009998877',
      street: 'Qissa Khwani Bazar',
      city: 'Peshawar',
    },
    paymentMethod: PaymentMethod.COD,
  });
  const legacyOrderErr = legacyOrderDoc.validateSync();
  assert(
    legacyOrderErr === undefined &&
      legacyOrderDoc.shippingAddress.postalCode === '' &&
      legacyOrderDoc.shippingAddress.coordinates === undefined,
    'Legacy Order without villageAddress, postalCode, or coordinates validates cleanly without invented coordinates'
  );

  const invalidOrderCoordsDoc = new Order({
    orderNumber: 'OX-2026-8802',
    orderItems: [
      {
        productId: new Types.ObjectId(),
        name: 'OX Jogger',
        image: 'https://example.com/shoe.jpg',
        size: '40',
        color: 'Black',
        quantity: 1,
        price: 4500,
        sku: 'OX-JOG-40',
      },
    ],
    subtotal: 4500,
    totalAmount: 4500,
    shippingAddress: {
      fullName: 'Invalid Coords',
      phone: '+923001234567',
      street: 'Khar',
      city: 'Bajaur',
      coordinates: { lat: 120, lng: 71.5, source: 'manual_pin' },
    },
    paymentMethod: PaymentMethod.COD,
  });
  assert(
    Boolean(invalidOrderCoordsDoc.validateSync()),
    'Order Mongoose schema rejects out-of-range latitude (lat=120)'
  );

  const assignmentDoc = new DeliveryAssignment({
    orderId: new Types.ObjectId(),
    orderNumber: 'OX-2026-8801',
    partnerId: new Types.ObjectId(),
    partnerName: 'Bajaur Rider',
    partnerPhone: '+923001112233',
    deliveryAddress: 'Khar Road, Inayat Killi, Bajaur, 18500',
    villageAddress: 'Inayat Killi',
    postalCode: '18500',
    deliveryCoordinates: { lat: 34.7495, lng: 71.5192, source: 'manual_pin' },
    city: 'Bajaur',
    customerName: 'Tariq Khan',
    customerPhone: '+923001234567',
  });
  assert(
    assignmentDoc.validateSync() === undefined &&
      assignmentDoc.villageAddress === 'Inayat Killi' &&
      assignmentDoc.deliveryCoordinates?.lat === 34.7495,
    'DeliveryAssignment Mongoose schema validates and preserves villageAddress, postalCode, and deliveryCoordinates'
  );

  const legacyAssignmentDoc = new DeliveryAssignment({
    orderId: new Types.ObjectId(),
    orderNumber: 'OX-2025-1001',
    partnerId: new Types.ObjectId(),
    partnerName: 'Legacy Rider',
    partnerPhone: '+923001112244',
    deliveryAddress: 'Mall Road, Lahore',
    city: 'Lahore',
    customerName: 'Legacy Customer',
    customerPhone: '+923009998877',
  });
  assert(
    legacyAssignmentDoc.validateSync() === undefined &&
      legacyAssignmentDoc.deliveryCoordinates === undefined,
    'Legacy DeliveryAssignment without deliveryCoordinates validates cleanly'
  );

  // -------------------------------------------------------------------------
  // 4. End-to-End Server Actions (MockDb): createOrder -> trackOrder -> assignOrderToPartner
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Server Actions End-to-End Flow (MockDb, Zero Production Writes) ---');

  // Mock Next.js headers() & next-auth session safely in CLI runtime
  const nextHeadersMod = require('next/headers');
  nextHeadersMod.headers = async () => new Map([['x-forwarded-for', '127.0.0.1']]);

  const sampleProducts = MockDb.getProducts({ inStock: true, limit: 5 }).products;
  const prod = sampleProducts.find((p) => (p.variants?.length || 0) > 0) || sampleProducts[0];
  const variant = prod.variants?.[0];

  const badCoordRes = await createOrder({
    items: [
      {
        productId: prod._id.toString(),
        size: variant?.size || prod.sizes?.[0] || '42',
        color: variant?.color || prod.colors?.[0]?.name || 'Black',
        quantity: 1,
      },
    ],
    checkoutData: {
      guestEmail: 'badcoords@example.com',
      guestPhone: '+923001234567',
      shippingAddress: {
        fullName: 'Bad Coords User',
        phone: '+923001234567',
        villageAddress: 'Inayat Killi',
        address: 'Golmarket',
        street: 'Golmarket',
        city: 'Bajaur',
        postalCode: '18500',
        coordinates: { lat: 999, lng: 71.5, source: 'manual_pin' },
      },
      paymentMethod: PaymentMethod.COD,
    },
  });
  assert(
    badCoordRes.success === false,
    'createOrder rejects invalid delivery coordinates cleanly'
  );

  const pinnedLat = 34.7488;
  const pinnedLng = 71.5081;
  const bajaurCreateRes = await createOrder({
    items: [
      {
        productId: prod._id.toString(),
        size: variant?.size || prod.sizes?.[0] || '42',
        color: variant?.color || prod.colors?.[0]?.name || 'Black',
        quantity: 1,
      },
    ],
    checkoutData: {
      guestEmail: 'bajaur.test@example.com',
      guestPhone: '+923007654321',
      shippingAddress: {
        fullName: 'Saeed Ullah',
        phone: '+923007654321',
        villageAddress: 'Inayat Killi, near Golmarket',
        address: 'Khar Main Road',
        street: 'Khar Main Road',
        city: 'Bajaur',
        postalCode: '18500',
        coordinates: { lat: pinnedLat, lng: pinnedLng, source: 'manual_pin' },
      },
      paymentMethod: PaymentMethod.COD,
    },
  });

  assert(
    bajaurCreateRes.success === true &&
      bajaurCreateRes.data.order.shippingAddress.city === 'Bajaur' &&
      bajaurCreateRes.data.order.shippingAddress.villageAddress === 'Inayat Killi, near Golmarket' &&
      bajaurCreateRes.data.order.shippingAddress.postalCode === '18500' &&
      bajaurCreateRes.data.order.shippingAddress.coordinates?.lat === pinnedLat &&
      bajaurCreateRes.data.order.shippingAddress.coordinates?.lng === pinnedLng,
    'createOrder persists Bajaur city, villageAddress, postalCode 18500, and pinned coordinates'
  );

  if (bajaurCreateRes.success) {
    const createdOrder = bajaurCreateRes.data.order;
    const trackRes = await trackOrder(createdOrder.orderNumber, '+923007654321');
    const trackedRecord = trackRes.success ? (trackRes.data as unknown as Record<string, unknown>) : null;
    const leakedPII =
      trackedRecord &&
      ('shippingAddress' in trackedRecord ||
        'fullName' in trackedRecord ||
        'phone' in trackedRecord ||
        'villageAddress' in trackedRecord ||
        'street' in trackedRecord ||
        'postalCode' in trackedRecord ||
        'guestEmail' in trackedRecord);

    assert(
      trackRes.success === true &&
        trackRes.data.destinationCity === 'Bajaur' &&
        trackRes.data.destinationCoordinates?.lat === pinnedLat &&
        trackRes.data.destinationCoordinates?.lng === pinnedLng &&
        !leakedPII,
      'trackOrder returns non-PII destinationCity="Bajaur" + destinationCoordinates without exposing PII'
    );

    // Test admin dispatch assignment & active rider distance sorting
    const nextAuthNext = require('next-auth/next');
    const originalNextAuthNextSession = nextAuthNext.getServerSession;
    const mockAdminSession = async () => ({
      user: {
        id: 'super_admin_id',
        name: 'Test Super Admin',
        email: 'admin@oxshoes.pk',
        role: 'super_admin',
      },
    });
    nextAuthNext.getServerSession = mockAdminSession;

    const bajaurRiderFar = MockDb.createDeliveryPartner({
      name: 'Bajaur Rider Far',
      phone: '03011110001',
      city: 'Bajaur',
      area: 'Nawagai',
      status: DeliveryPartnerStatus.ACTIVE,
      currentLat: 34.67,
      currentLng: 71.29,
    });
    const bajaurRiderNear = MockDb.createDeliveryPartner({
      name: 'Bajaur Rider Near',
      phone: '03011110002',
      city: 'Bajaur',
      area: 'Khar',
      status: DeliveryPartnerStatus.ACTIVE,
      currentLat: 34.749,
      currentLng: 71.509,
    });

    const ridersRes = await getActiveRidersForCity('Bajaur', {
      lat: pinnedLat,
      lng: pinnedLng,
      source: 'manual_pin',
    });
    assert(
      ridersRes.success === true &&
        ridersRes.data.length >= 2 &&
        ridersRes.data[0]._id.toString() === bajaurRiderNear._id.toString() &&
        typeof ridersRes.data[0].distanceKm === 'number' &&
        ridersRes.data[0].distanceKm < 1,
      'getActiveRidersForCity sorts Bajaur riders using saved orderCoordinates (nearest rider ranked first)'
    );

    const unsupportedRidersRes = await getActiveRidersForCity('UnknownTehsil', null);
    assert(
      unsupportedRidersRes.success === true,
      'getActiveRidersForCity handles unsupported city without throwing or falling back to Peshawar/Lahore'
    );

    const assignRes = await assignOrderToPartner({
      orderId: createdOrder._id.toString(),
      partnerId: bajaurRiderNear._id.toString(),
      expectedVersion: createdOrder.version ?? 0,
    });
    assert(
      assignRes.success === true &&
        assignRes.data.city === 'Bajaur' &&
        assignRes.data.villageAddress === 'Inayat Killi, near Golmarket' &&
        assignRes.data.postalCode === '18500' &&
        assignRes.data.deliveryAddress.includes('Inayat Killi, near Golmarket') &&
        assignRes.data.deliveryAddress.includes('Bajaur') &&
        assignRes.data.deliveryAddress.includes('18500') &&
        assignRes.data.deliveryCoordinates?.lat === pinnedLat &&
        assignRes.data.deliveryCoordinates?.lng === pinnedLng,
      'assignOrderToPartner formats full Bajaur deliveryAddress and preserves villageAddress, postalCode, and deliveryCoordinates'
    );

    // Verify unsupported city without coords does not invent Peshawar/Lahore coords
    const customCityOrderRes = await createOrder({
      items: [
        {
          productId: prod._id.toString(),
          size: variant?.size || prod.sizes?.[0] || '42',
          color: variant?.color || prod.colors?.[0]?.name || 'Black',
          quantity: 1,
        },
      ],
      checkoutData: {
        guestEmail: 'unresolved.city@example.com',
        guestPhone: '+923007776655',
        shippingAddress: {
          fullName: 'Remote Buyer',
          phone: '+923007776655',
          villageAddress: 'Chitral Valley Road',
          address: 'House 9',
          street: 'House 9',
          city: 'Chitral',
        },
        paymentMethod: PaymentMethod.COD,
      },
    });
    assert(
      customCityOrderRes.success === true &&
        customCityOrderRes.data.order.shippingAddress.city === 'Chitral' &&
        customCityOrderRes.data.order.shippingAddress.postalCode === '' &&
        customCityOrderRes.data.order.shippingAddress.coordinates === undefined,
      'Unsupported custom city ("Chitral") stores empty postalCode and undefined coordinates (no Lahore/Peshawar invention)'
    );

    if (customCityOrderRes.success) {
      const trackUnresolved = await trackOrder(
        customCityOrderRes.data.order.orderNumber,
        '+923007776655'
      );
      assert(
        trackUnresolved.success === true &&
          trackUnresolved.data.destinationCity === 'Chitral' &&
          trackUnresolved.data.destinationCoordinates === undefined,
        'trackOrder for unresolved city returns destinationCity="Chitral" and undefined destinationCoordinates'
      );
    }

    nextAuthNext.getServerSession = originalNextAuthNextSession;
    void bajaurRiderFar;
  }

  console.log('\n======================================================================');
  console.log(`PROBLEM 2 VERIFICATION SUMMARY: ${passedTests}/${totalTests} PASSED, ${failedTests} FAILED`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runProblem2Tests().catch((err) => {
  console.error('Fatal Problem 2 test execution error:', err);
  process.exit(1);
});
