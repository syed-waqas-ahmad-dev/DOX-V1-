/**
 * @file scripts/coupon-phase3-test.ts
 * @description Comprehensive Phase 3 Transaction Safety & Concurrency Test Suite
 */

import { connectToDatabase } from '../lib/db/connect';
import { Coupon } from '../models/Coupon';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
import { CouponUsage } from '../models/CouponUsage';
import { CouponType, OrderStatus, PaymentMethod, PaymentStatus, ProductCategory, ProductSubCategory, ProductBrand } from '../types';
import { executeWithOptionalTransaction } from '../lib/services/wallet.service';
import { Types } from 'mongoose';

async function runPhase3Tests() {
  await connectToDatabase();
  console.log('\n=============================================================');
  console.log('⚡ OX SHOES - PHASE 3 TRANSACTION & CONCURRENCY TEST SUITE');
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

  // Setup Test Product
  const testProduct = await Product.create({
    name: 'Test Kaptaan Chappal',
    nameUr: 'ٹیسٹ کپتان چپل',
    slug: `test-kaptaan-${Date.now()}`,
    sku: `OX-TEST-${Date.now()}`,
    price: 3500,
    originalPrice: 4500,
    discount: 22,
    category: ProductCategory.MEN,
    subCategory: ProductSubCategory.PESHAWARI_CHAPPAL,
    brand: ProductBrand.LOCAL,
    sizes: ['42'],
    colors: [{ name: 'Black', hex: '#000000' }],
    variants: [{ size: '42', color: 'Black', stock: 1, sku: `OX-TEST-42` }],
    stock: 1, // Only 1 unit in stock for concurrency testing!
    reservedStock: 0,
    lowStockThreshold: 5,
    images: ['https://images.unsplash.com/photo-1549298916-b41d501d3772'],
    description: 'Test footwear for phase 3 concurrency.',
    shortDescription: 'Test item',
    specifications: new Map(),
    weight: 800,
    isFeatured: false,
    isActive: true,
  });

  // Setup Test Coupon with 1 slot remaining (usageLimit: 10, usedCount: 9)
  const testCoupon = await Coupon.create({
    code: `PHASE3-${Date.now()}`,
    type: CouponType.PERCENTAGE,
    value: 15,
    minOrderAmount: 1000,
    maxDiscountAmount: 1000,
    usageLimit: 10,
    usedCount: 9, // Exactly 1 slot left!
    perUserLimit: 1,
    applicableCategories: [],
    applicableBrands: [],
    isFirstOrderOnly: false,
    startsAt: new Date(Date.now() - 10000),
    expiresAt: new Date(Date.now() + 86400000),
    isActive: true,
  });

  // 1. Atomic Global Coupon Capacity Reservation Test (5 Concurrent Claims for 1 Slot)
  {
    console.log('Testing 5 concurrent claims for 1 available coupon slot...');
    const results = await Promise.all(
      Array.from({ length: 5 }).map(async () => {
        try {
          return await executeWithOptionalTransaction(async (dbSession) => {
            const reserved = await Coupon.findOneAndUpdate(
              {
                _id: testCoupon._id,
                isActive: true,
                $expr: { $lt: ['$usedCount', '$usageLimit'] },
              },
              { $inc: { usedCount: 1 } },
              { session: dbSession || undefined, new: true }
            );
            return Boolean(reserved);
          });
        } catch {
          return false;
        }
      })
    );

    const successfulClaims = results.filter(Boolean).length;
    assert(
      successfulClaims === 1,
      '1. Atomic Capacity Reservation (5 Concurrent Claims for 1 Slot)',
      `Exactly ${successfulClaims} claim succeeded out of 5 concurrent requests`
    );

    const reFetchedCoupon = await Coupon.findById(testCoupon._id);
    assert(
      reFetchedCoupon?.usedCount === 10,
      '2. Final Coupon Counter Verification',
      `usedCount is exactly ${reFetchedCoupon?.usedCount} (equals usageLimit 10)`
    );
  }

  // 3. Exhausted Capacity Rejection Test
  {
    const reservedAgain = await Coupon.findOneAndUpdate(
      {
        _id: testCoupon._id,
        isActive: true,
        $expr: { $lt: ['$usedCount', '$usageLimit'] },
      },
      { $inc: { usedCount: 1 } }
    );
    assert(
      reservedAgain === null,
      '3. Exhausted Coupon Capacity Rejection',
      'Attempting to claim an exhausted coupon returned null'
    );
  }

  // 4. Atomic Inventory Decrement Guard (2 Concurrent Purchases for 1 Product Unit)
  {
    console.log('Testing 2 concurrent purchases for 1 product unit in stock...');
    const stockResults = await Promise.all(
      Array.from({ length: 2 }).map(async () => {
        try {
          return await executeWithOptionalTransaction(async (dbSession) => {
            const updated = await Product.findOneAndUpdate(
              { _id: testProduct._id, stock: { $gte: 1 } },
              { $inc: { stock: -1 } },
              { session: dbSession || undefined, new: true }
            );
            return Boolean(updated);
          });
        } catch {
          return false;
        }
      })
    );

    const successfulPurchases = stockResults.filter(Boolean).length;
    assert(
      successfulPurchases === 1,
      '4. Atomic Inventory Reservation Guard (1 Unit Stock)',
      `Exactly ${successfulPurchases} purchase succeeded out of 2 concurrent attempts`
    );

    const reFetchedProduct = await Product.findById(testProduct._id);
    assert(
      reFetchedProduct?.stock === 0,
      '5. Inventory Stock Non-Negative Enforcement',
      `Product stock is ${reFetchedProduct?.stock} (never negative)`
    );
  }

  // 6. Transaction Rollback Verification (Simulated Failure)
  {
    let createdOrderId: Types.ObjectId | null = null;
    try {
      await executeWithOptionalTransaction(async (dbSession) => {
        const createDocs = await Order.create(
          [
            {
              orderNumber: `OX-ROLLBACK-${Date.now()}`,
              guestEmail: 'rollback@oxshoes.pk',
              guestPhone: '+923000000000',
              orderItems: [
                {
                  _id: new Types.ObjectId(),
                  productId: testProduct._id,
                  name: testProduct.name,
                  image: testProduct.images[0],
                  size: '42',
                  color: 'Black',
                  quantity: 1,
                  price: 3500,
                  sku: testProduct.sku,
                },
              ],
              subtotal: 3500,
              totalAmount: 3500,
              shippingAddress: { fullName: 'Rollback Test', phone: '+923000000000', address: 'A', city: 'Lahore', postalCode: '54000' },
              status: OrderStatus.CONFIRMED,
              paymentMethod: PaymentMethod.COD,
              paymentStatus: PaymentStatus.PENDING,
            },
          ],
          { session: dbSession || undefined }
        );
        createdOrderId = createDocs[0]._id;

        // Force intentional transaction failure
        throw new Error('INTENTIONAL_SIMULATED_TRANSACTION_FAILURE');
      });
    } catch {
      // Expected failure catch
    }

    if (createdOrderId) {
      const orphanOrder = await Order.findById(createdOrderId);
      const isRolledBackOrDeleted = !orphanOrder;
      assert(
        isRolledBackOrDeleted,
        '6. Transaction Failure Rollback Safety',
        `Simulated transaction failure result: ${isRolledBackOrDeleted ? 'Order safely rolled back' : 'Order remained in DB'}`
      );
    }
  }

  // Cleanup test documents
  await Product.findByIdAndDelete(testProduct._id);
  await Coupon.findByIdAndDelete(testCoupon._id);

  console.log(`\n=============================================================`);
  console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log(`=============================================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runPhase3Tests().catch(console.error);
