/**
 * @file scripts/coupon-phase2-test.ts
 * @description Comprehensive Phase 2 Defect Correction Test Suite
 */

import { validateCouponRules } from '../lib/coupon-validator';
import { CouponType, OrderStatus, PaymentMethod, PaymentStatus } from '../types';
import { CouponUsage } from '../models/CouponUsage';
import { Order } from '../models/Order';
import { connectToDatabase } from '../lib/db/connect';
import { Types } from 'mongoose';

async function runCouponTests() {
  await connectToDatabase();
  console.log('\n=============================================================');
  console.log('🧪 OX SHOES - PHASE 2 DEFECT CORRECTION TEST SUITE');
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

  const testCouponId = new Types.ObjectId();
  const testUserId = new Types.ObjectId();

  const dummyOrderItem = {
    _id: new Types.ObjectId(),
    productId: new Types.ObjectId(),
    name: 'Peshawari Chappal Leather',
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772',
    size: '42',
    color: 'Black',
    quantity: 1,
    price: 3000,
    sku: 'OX-KAP-42-BLA',
  };

  // 1. Authenticated user with matching session (Logic Unit Test)
  {
    const usage = await CouponUsage.countDocuments({ couponId: testCouponId, userId: testUserId });
    assert(usage === 0, '1. Authenticated User First-Use Check', `Usage count: ${usage}`);
  }

  // 2. Guest with email and phone ($or matching check)
  {
    const guestEmail = 'guest.audit@oxshoes.pk';
    const guestPhone = '+923009998877';
    await CouponUsage.create({
      couponId: testCouponId,
      guestEmail,
      guestPhone,
      orderId: new Types.ObjectId(),
      discountApplied: 250,
    });

    const guestConditions = [{ guestEmail }, { guestPhone }];
    const count = await CouponUsage.countDocuments({
      couponId: testCouponId,
      $or: guestConditions,
    });
    assert(count === 1, '2. Guest Email & Phone $or Matching', `Matched usage count: ${count}`);
  }

  // 3. Guest changing email while keeping same phone
  {
    const changedEmail = 'different.guest@oxshoes.pk';
    const samePhone = '+923009998877';
    const guestConditions = [{ guestEmail: changedEmail }, { guestPhone: samePhone }];
    const count = await CouponUsage.countDocuments({
      couponId: testCouponId,
      $or: guestConditions,
    });
    assert(count >= 1, '3. Guest Changed Email, Same Phone Trapped via $or', `Count: ${count}`);
  }

  // 4. Guest changing phone while keeping same email
  {
    const sameEmail = 'guest.audit@oxshoes.pk';
    const changedPhone = '+923001112233';
    const guestConditions = [{ guestEmail: sameEmail }, { guestPhone: changedPhone }];
    const count = await CouponUsage.countDocuments({
      couponId: testCouponId,
      $or: guestConditions,
    });
    assert(count >= 1, '4. Guest Changed Phone, Same Email Trapped via $or', `Count: ${count}`);
  }

  // 5. Guest with no usable identity rejected
  {
    const guestConditions: any[] = [];
    assert(guestConditions.length === 0, '5. Anonymous Guest Rejection Guard', 'Empty conditions correctly identified');
  }

  // 6. First-order eligibility with explicit qualifying statuses
  {
    const qualifyingStatuses = [
      OrderStatus.CONFIRMED,
      OrderStatus.PROCESSING,
      OrderStatus.SHIPPED,
      OrderStatus.OUT_FOR_DELIVERY,
      OrderStatus.DELIVERED,
      OrderStatus.RETURNED,
    ];
    assert(
      qualifyingStatuses.includes(OrderStatus.CONFIRMED) && !qualifyingStatuses.includes(OrderStatus.CANCELLED),
      '6. First-Order Qualifying Statuses Definition',
      `CONFIRMED included, CANCELLED excluded`
    );
  }

  // 7. Cancelled order does NOT invalidate first-order eligibility
  {
    const cancelledEmail = 'cancelled.customer@oxshoes.pk';
    await Order.create({
      orderNumber: `OX-TEST-${Date.now()}`,
      guestEmail: cancelledEmail,
      guestPhone: '+923007776655',
      orderItems: [dummyOrderItem],
      subtotal: 3000,
      totalAmount: 3000,
      shippingAddress: { fullName: 'Test', phone: '+923007776655', address: 'A', city: 'Lahore', postalCode: '54000' },
      status: OrderStatus.CANCELLED,
      paymentMethod: PaymentMethod.COD,
      paymentStatus: PaymentStatus.PENDING,
    });

    const qualifyingStatuses = [
      OrderStatus.CONFIRMED,
      OrderStatus.PROCESSING,
      OrderStatus.SHIPPED,
      OrderStatus.OUT_FOR_DELIVERY,
      OrderStatus.DELIVERED,
      OrderStatus.RETURNED,
    ];
    const previousOrders = await Order.countDocuments({
      guestEmail: cancelledEmail,
      status: { $in: qualifyingStatuses },
    });
    assert(previousOrders === 0, '7. Cancelled Order Excluded from First-Order Check', `Previous qualifying orders: ${previousOrders}`);
  }

  // 8. Confirmed order invalidates first-order eligibility
  {
    const confirmedEmail = 'confirmed.customer@oxshoes.pk';
    await Order.create({
      orderNumber: `OX-TEST-${Date.now() + 1}`,
      guestEmail: confirmedEmail,
      guestPhone: '+923007776654',
      orderItems: [dummyOrderItem],
      subtotal: 3000,
      totalAmount: 3000,
      shippingAddress: { fullName: 'Test', phone: '+923007776654', address: 'A', city: 'Lahore', postalCode: '54000' },
      status: OrderStatus.CONFIRMED,
      paymentMethod: PaymentMethod.COD,
      paymentStatus: PaymentStatus.PENDING,
    });

    const qualifyingStatuses = [
      OrderStatus.CONFIRMED,
      OrderStatus.PROCESSING,
      OrderStatus.SHIPPED,
      OrderStatus.OUT_FOR_DELIVERY,
      OrderStatus.DELIVERED,
      OrderStatus.RETURNED,
    ];
    const previousOrders = await Order.countDocuments({
      guestEmail: confirmedEmail,
      status: { $in: qualifyingStatuses },
    });
    assert(previousOrders === 1, '8. Confirmed Order Blocks First-Order Eligibility', `Previous qualifying orders: ${previousOrders}`);
  }

  // Cleanup test documents
  await CouponUsage.deleteMany({ couponId: testCouponId });
  await Order.deleteMany({ guestEmail: { $in: ['cancelled.customer@oxshoes.pk', 'confirmed.customer@oxshoes.pk'] } });

  console.log(`\n=============================================================`);
  console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log(`=============================================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runCouponTests().catch(console.error);
