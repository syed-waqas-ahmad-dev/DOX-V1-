/**
 * @file scripts/create-order-integration-test.ts
 * @description Integration Test Suite executing actual createOrder() Server Action against MongoDB
 */

import { connectToDatabase } from '../lib/db/connect';
import { Coupon } from '../models/Coupon';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
import { CouponUsage } from '../models/CouponUsage';
import { createOrder } from '../actions/order.actions';
import { CouponType, OrderStatus, PaymentMethod, PaymentStatus, ProductCategory, ProductSubCategory, ProductBrand } from '../types';
import { Types } from 'mongoose';

async function runIntegrationTest() {
  await connectToDatabase();
  console.log('\n=============================================================');
  console.log('🧪 REAL CREATEORDER() INTEGRATION TEST SUITE');
  console.log('=============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      passed++;
      console.log(`  ✓ [PASS] ${testName}`);
      if (detail) console.log(`         Detail: ${detail}`);
    } else {
      failed++;
      console.error(`  ✗ [FAIL] ${testName}`);
      if (detail) console.error(`         Detail: ${detail}`);
    }
  }

  // 1. Create Temporary Test Product & Coupon
  const testProduct = await Product.create({
    name: 'Integration Test Footwear',
    nameUr: 'انٹیگریشن ٹیسٹ جوتا',
    slug: `test-integration-${Date.now()}`,
    sku: `OX-INT-${Date.now()}`,
    price: 4000,
    originalPrice: 5000,
    discount: 20,
    category: ProductCategory.MEN,
    subCategory: ProductSubCategory.PESHAWARI_CHAPPAL,
    brand: ProductBrand.LOCAL,
    sizes: ['42'],
    colors: [{ name: 'Black', hex: '#000000' }],
    variants: [{ size: '42', color: 'Black', stock: 10, sku: 'OX-INT-42' }],
    stock: 10,
    reservedStock: 0,
    lowStockThreshold: 5,
    images: ['https://images.unsplash.com/photo-1549298916-b41d501d3772'],
    description: 'Integration test shoe',
    shortDescription: 'Integration test shoe',
    specifications: new Map(),
    weight: 850,
    isFeatured: false,
    isActive: true,
  });

  const testCoupon = await Coupon.create({
    code: `INTCOUPON-${Date.now()}`,
    type: CouponType.PERCENTAGE,
    value: 10,
    minOrderAmount: 1000,
    maxDiscountAmount: 500,
    usageLimit: 5,
    usedCount: 0,
    perUserLimit: 1,
    applicableCategories: [],
    applicableBrands: [],
    isFirstOrderOnly: false,
    startsAt: new Date(Date.now() - 10000),
    expiresAt: new Date(Date.now() + 86400000),
    isActive: true,
  });

  const guestEmail = `e2e.guest.${Date.now()}@oxshoes.pk`;
  const guestPhone = '+923001234567';

  // 2. Invoke real createOrder() action
  console.log('Invoking real createOrder() action...');
  const orderRes = await createOrder({
    items: [
      {
        productId: testProduct._id.toString(),
        size: '42',
        color: 'Black',
        quantity: 2,
      },
    ],
    checkoutData: {
      guestEmail,
      guestPhone,
      shippingAddress: {
        fullName: 'E2E Test Guest',
        phone: guestPhone,
        villageAddress: 'Main Mall Road',
        address: 'Main Mall Road',
        city: 'Lahore',
        postalCode: '54000',
      },
      paymentMethod: PaymentMethod.COD,
      couponCode: testCoupon.code,
      notes: 'Integration test order',
    },
  });

  assert(orderRes.success === true, '1. createOrder() Execution Status', `Returned success: ${orderRes.success}`);

  if (orderRes.success && orderRes.data?.order) {
    const createdOrder = orderRes.data.order;

    // 3. Verify Order Persistence in DB
    const dbOrder = await Order.findById(createdOrder._id);
    assert(dbOrder !== null, '2. Order Document Persistence', `Persisted Order ID: ${dbOrder?._id}`);

    // 4. Verify Coupon Counter Increment
    const dbCoupon = await Coupon.findById(testCoupon._id);
    assert(dbCoupon?.usedCount === 1, '3. Coupon Counter Increment', `usedCount is ${dbCoupon?.usedCount} (expected 1)`);

    // 5. Verify CouponUsage Audit Document Creation
    const dbUsage = await CouponUsage.findOne({ couponId: testCoupon._id, guestEmail });
    assert(dbUsage !== null, '4. CouponUsage Audit Persistence', `Usage Record ID: ${dbUsage?._id}`);

    // 6. Verify Inventory Stock Decrement
    const dbProduct = await Product.findById(testProduct._id);
    assert(dbProduct?.stock === 8, '5. Inventory Stock Decrement (10 - 2 = 8)', `Remaining stock: ${dbProduct?.stock}`);

    // Clean up created order and usage
    await Order.findByIdAndDelete(createdOrder._id);
    await CouponUsage.deleteMany({ couponId: testCoupon._id });
  }

  // 7. Insufficient Stock Failure Test via createOrder()
  console.log('Testing createOrder() with quantity exceeding stock...');
  const overStockRes = await createOrder({
    items: [
      {
        productId: testProduct._id.toString(),
        size: '42',
        color: 'Black',
        quantity: 999, // Exceeds stock (10)
      },
    ],
    checkoutData: {
      guestEmail: `overstock.${Date.now()}@oxshoes.pk`,
      guestPhone: '+923001234568',
      shippingAddress: {
        fullName: 'Overstock Guest',
        phone: '+923001234568',
        villageAddress: 'Main Road',
        address: 'Main Road',
        city: 'Lahore',
        postalCode: '54000',
      },
      paymentMethod: PaymentMethod.COD,
      couponCode: testCoupon.code,
    },
  });

  assert(
    !overStockRes.success,
    '6. Insufficient Stock Rejection',
    `Error message: ${!overStockRes.success ? overStockRes.error : 'Unexpected success'}`
  );

  // Cleanup Test Fixtures
  await Product.findByIdAndDelete(testProduct._id);
  await Coupon.findByIdAndDelete(testCoupon._id);

  console.log(`\n=============================================================`);
  console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log(`=============================================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runIntegrationTest().catch(console.error);
