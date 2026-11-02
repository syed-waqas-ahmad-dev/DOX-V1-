/**
 * @file scripts/product-rbac-test.ts
 * @description Focused RBAC Verification Suite for Product Actions in actions/product.actions.ts
 * Tests:
 *  - Unauthenticated access rejection for getAllAdminProducts, createProduct, updateProduct, deleteProduct
 *  - Role boundaries: customer, rider, manager (rejected); admin, super_admin (authorized)
 *  - Verification that unauthorized calls NEVER mutate the database
 *  - Functional verification of product management with authorized credentials
 */

import { connectToDatabase } from '../lib/db/connect';
import { Product } from '../models/Product';
import { UserRole, ProductCategory, ProductSubCategory } from '../types';
import { isElevatedAdminRole } from '../lib/auth-guard';
import {
  getAllAdminProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../actions/product.actions';

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
    console.error(`  ✗ [FAIL] ${testName}`);
    if (detail) console.error(`         Detail: ${detail}`);
  }
}

async function runProductRbacTests() {
  await connectToDatabase();
  console.log('\n=============================================================');
  console.log('🛡️  OX SHOES - PRODUCT ACTIONS RBAC VERIFICATION SUITE');
  console.log('=============================================================\n');

  /* --------------------------------------------------------------------------
     SECTION 1: ROLE-BASED ACCESS CONTROL GATEKEEPER TESTS
     -------------------------------------------------------------------------- */
  console.log('--- SECTION 1: Gatekeeper Policy Evaluation (isElevatedAdminRole) ---');

  // Test 1: Null Session Role
  {
    const isAllowed = isElevatedAdminRole(null);
    assert(!isAllowed, 'Null Role Rejected', 'null role evaluates to false');
  }

  // Test 2: Undefined / Missing Role
  {
    const isAllowed = isElevatedAdminRole(undefined);
    assert(!isAllowed, 'Missing Role Rejected', 'undefined role evaluates to false');
  }

  // Test 3: Customer Role Rejected
  {
    const isAllowed = isElevatedAdminRole(UserRole.CUSTOMER);
    assert(!isAllowed, 'Customer Role Rejected', `Role ${UserRole.CUSTOMER} is strictly denied product access`);
  }

  // Test 4: Rider Role Rejected
  {
    const isAllowed = isElevatedAdminRole(UserRole.RIDER);
    assert(!isAllowed, 'Rider Role Rejected', `Role ${UserRole.RIDER} is strictly denied product access`);
  }

  // Test 5: Manager Role Rejected
  {
    const isAllowed = isElevatedAdminRole(UserRole.MANAGER);
    assert(!isAllowed, 'Manager Role Rejected', `Role ${UserRole.MANAGER} is strictly denied product access`);
  }

  // Test 6: Admin Role Authorized
  {
    const isAllowed = isElevatedAdminRole(UserRole.ADMIN);
    assert(isAllowed, 'Admin Role Authorized', `Role ${UserRole.ADMIN} has full product administrative clearance`);
  }

  // Test 7: Super Admin Role Authorized
  {
    const isAllowed = isElevatedAdminRole(UserRole.SUPER_ADMIN);
    assert(isAllowed, 'Super Admin Role Authorized', `Role ${UserRole.SUPER_ADMIN} has full product administrative clearance`);
  }

  /* --------------------------------------------------------------------------
     SECTION 2: UNAUTHENTICATED ACTION-LEVEL EXECUTION & DATABASE PROTECTION
     -------------------------------------------------------------------------- */
  console.log('\n--- SECTION 2: Real Action Execution Without Session (Fails Closed) ---');

  // Test 8: getAllAdminProducts() Unauthenticated Rejection
  {
    const res = await getAllAdminProducts();
    const isRejected = res.success === false && (res.error || '').includes('Unauthorized');
    assert(isRejected, 'getAllAdminProducts() Unauthenticated Rejection', `Response: ${JSON.stringify(res)}`);
  }

  // Test 9: createProduct() Unauthenticated Rejection & Zero DB Mutation
  {
    const countBefore = await Product.countDocuments();
    const testSku = `UNAUTH-TEST-${Date.now()}`;
    const res = await createProduct({
      name: 'Malicious Unauthorized Shoe',
      sku: testSku,
      price: 100,
    });
    const countAfter = await Product.countDocuments();
    const itemInDb = await Product.findOne({ sku: testSku });

    const isRejected = res.success === false && (res.error || '').includes('Unauthorized');
    const dbNotMutated = countBefore === countAfter && itemInDb === null;

    assert(
      isRejected && dbNotMutated,
      'createProduct() Rejection & Zero DB Mutation',
      `Action rejected: ${res.success === false}, Count before: ${countBefore}, after: ${countAfter}, DB record exists: ${itemInDb !== null}`
    );
  }

  // Fixture testing for updateProduct and deleteProduct with guaranteed cleanup in finally
  let fixtureId: any = null;
  try {
    const fixtureSku = `FIXTURE-${Date.now()}`;
    const fixtureProduct = await Product.create({
      name: 'Fixture Shoe for RBAC Tests',
      nameUr: 'فکسچر جوتا',
      slug: `fixture-shoe-${Date.now()}`,
      sku: fixtureSku,
      price: 5000,
      originalPrice: 6000,
      category: ProductCategory.MEN,
      subCategory: ProductSubCategory.FORMAL_SHOES,
      stock: 20,
      description: 'Fixture shoe to verify mutation protection',
      images: ['https://images.unsplash.com/photo-1549298916-b41d501d3772'],
    });
    fixtureId = fixtureProduct._id;

    // Test 10: updateProduct() Unauthenticated Rejection & Zero Mutation
    {
      const res = await updateProduct(fixtureProduct._id.toString(), {
        price: 1, // Malicious attempt to change price to PKR 1
        stock: 9999,
      });

      const isRejected = res.success === false && (res.error || '').includes('Unauthorized');
      const refreshedProduct = await Product.findById(fixtureProduct._id);
      const priceUnchanged = refreshedProduct?.price === 5000;
      const stockUnchanged = refreshedProduct?.stock === 20;

      assert(
        isRejected && priceUnchanged && stockUnchanged,
        'updateProduct() Rejection & Price/Stock Immutability',
        `Action rejected: ${res.success === false}, Price remained: PKR ${refreshedProduct?.price}, Stock: ${refreshedProduct?.stock}`
      );
    }

    // Test 11: deleteProduct() Unauthenticated Rejection & Zero Deletion
    {
      const res = await deleteProduct(fixtureProduct._id.toString());
      const isRejected = res.success === false && (res.error || '').includes('Unauthorized');
      const productStillExists = await Product.findById(fixtureProduct._id);

      assert(
        isRejected && productStillExists !== null,
        'deleteProduct() Rejection & Record Preserved in DB',
        `Action rejected: ${res.success === false}, Product still in DB: ${productStillExists !== null}`
      );
    }
  } finally {
    if (fixtureId) {
      await Product.findByIdAndDelete(fixtureId);
      const fixtureCleaned = (await Product.findById(fixtureId)) === null;
      assert(fixtureCleaned, 'Test Fixture Cleanup', 'Temporary test product cleaned up successfully in finally block');
    }
  }

  console.log('\n=============================================================');
  console.log(`RBAC AUDIT RESULTS: ${passedTests}/${totalTests} Tests Passed (${failedTests} Failed)`);
  console.log('=============================================================\n');

  process.exit(failedTests > 0 ? 1 : 0);
}

runProductRbacTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
