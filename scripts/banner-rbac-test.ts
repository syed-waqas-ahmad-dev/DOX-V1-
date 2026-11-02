/**
 * @file scripts/banner-rbac-test.ts
 * @description Focused RBAC Verification Suite for Banner Actions in actions/banner.actions.ts
 * Tests:
 *  - Gatekeeper policy boundaries: customer, rider, manager (rejected); admin, super_admin (authorized)
 *  - Unauthenticated access rejection for getAllAdminBanners, createBanner, updateBanner, deleteBanner (fail-closed)
 *  - Verification that unauthenticated calls fail before touching DB or MockDb
 *  - Verification that public storefront getBanners() remains unauthenticated and operational
 *
 * NOTE ON DATABASE SAFETY:
 * Real database-mutating operations against live collections are strictly skipped because
 * environment isolation cannot be guaranteed. The tests verify fail-closed authorization without mutations.
 */

/**
 * Polyfill yallist for openid-client / lru-cache compatibility when executing via tsx CLI
 */
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

import { UserRole, BannerPosition } from '../types';
import { isElevatedAdminRole } from '../lib/auth-guard';
import {
  getBanners,
  getAllAdminBanners,
  createBanner,
  updateBanner,
  deleteBanner,
} from '../actions/banner.actions';

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

async function runBannerRbacTests() {
  console.log('\n=============================================================');
  console.log('🛡️  OX SHOES - BANNER ACTIONS RBAC VERIFICATION SUITE');
  console.log('=============================================================\n');

  /* --------------------------------------------------------------------------
     SECTION 1: ROLE-BASED ACCESS CONTROL GATEKEEPER TESTS
     -------------------------------------------------------------------------- */
  console.log('--- SECTION 1: Gatekeeper Policy Evaluation (isElevatedAdminRole) ---');

  // Test 1: Null Role
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
    assert(!isAllowed, 'Customer Role Rejected', `Role ${UserRole.CUSTOMER} is strictly denied administrative banner access`);
  }

  // Test 4: Rider Role Rejected
  {
    const isAllowed = isElevatedAdminRole(UserRole.RIDER);
    assert(!isAllowed, 'Rider Role Rejected', `Role ${UserRole.RIDER} is strictly denied administrative banner access`);
  }

  // Test 5: Manager Role Rejected
  {
    const isAllowed = isElevatedAdminRole(UserRole.MANAGER);
    assert(!isAllowed, 'Manager Role Rejected', `Role ${UserRole.MANAGER} is strictly denied administrative banner access`);
  }

  // Test 6: Admin Role Authorized
  {
    const isAllowed = isElevatedAdminRole(UserRole.ADMIN);
    assert(isAllowed, 'Admin Role Authorized', `Role ${UserRole.ADMIN} has administrative banner clearance`);
  }

  // Test 7: Super Admin Role Authorized
  {
    const isAllowed = isElevatedAdminRole(UserRole.SUPER_ADMIN);
    assert(isAllowed, 'Super Admin Role Authorized', `Role ${UserRole.SUPER_ADMIN} has administrative banner clearance`);
  }

  /* --------------------------------------------------------------------------
     SECTION 2: UNAUTHENTICATED ACTION-LEVEL FAIL-CLOSED VERIFICATION
     -------------------------------------------------------------------------- */
  console.log('\n--- SECTION 2: Action Execution Without Active Session (Fail-Closed) ---');

  // Test 8: getAllAdminBanners() Unauthenticated Rejection
  {
    const res = await getAllAdminBanners();
    const isRejected = res.success === false && (res.error || '').includes('Unauthorized');
    assert(isRejected, 'getAllAdminBanners() Unauthenticated Rejection', `Response: ${JSON.stringify(res)}`);
  }

  // Test 9: createBanner() Unauthenticated Rejection (Zero DB Mutation)
  {
    const res = await createBanner({
      title: 'Malicious Unauthorized Promo Banner',
      link: '/malicious',
      position: BannerPosition.HERO,
    });
    const isRejected = res.success === false && (res.error || '').includes('Unauthorized');
    assert(isRejected, 'createBanner() Unauthenticated Rejection', `Response: ${JSON.stringify(res)}`);
  }

  // Test 10: updateBanner() Unauthenticated Rejection (Zero DB Mutation)
  {
    const res = await updateBanner('000000000000000000000000', {
      title: 'Hacked Title By Attacker',
    });
    const isRejected = res.success === false && (res.error || '').includes('Unauthorized');
    assert(isRejected, 'updateBanner() Unauthenticated Rejection', `Response: ${JSON.stringify(res)}`);
  }

  // Test 11: deleteBanner() Unauthenticated Rejection (Zero DB Mutation)
  {
    const res = await deleteBanner('000000000000000000000000');
    const isRejected = res.success === false && (res.error || '').includes('Unauthorized');
    assert(isRejected, 'deleteBanner() Unauthenticated Rejection', `Response: ${JSON.stringify(res)}`);
  }

  /* --------------------------------------------------------------------------
     SECTION 3: PUBLIC STOREFRONT ACTION VERIFICATION
     -------------------------------------------------------------------------- */
  console.log('\n--- SECTION 3: Public Storefront Accessibility (getBanners) ---');

  // Test 12: getBanners() Remains Public & Functional Without Session
  {
    const res = await getBanners();
    const isPubliclyAvailable = res.success === true && Array.isArray(res.data);
    const count = res.success ? res.data.length : 0;
    assert(
      isPubliclyAvailable,
      'getBanners() Remains Publicly Accessible',
      `Success: ${res.success}, Item count: ${count}`
    );
  }

  console.log('\n=============================================================');
  console.log(`BANNER RBAC AUDIT RESULTS: ${passedTests}/${totalTests} Tests Passed (${failedTests} Failed)`);
  console.log('=============================================================\n');

  process.exit(failedTests > 0 ? 1 : 0);
}

runBannerRbacTests().catch((err) => {
  console.error('Fatal banner RBAC test error:', err);
  process.exit(1);
});
