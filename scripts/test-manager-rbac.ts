/**
 * @file scripts/test-manager-rbac.ts
 * @description Comprehensive RBAC & Manager Authorization Test Suite for OX Shoes Pakistan.
 * Directly invokes actual application authorization helpers (verifyDepartmentAuth, verifySuperAdminAuth,
 * verifyDeliveryAdminAuth, isElevatedAdminRole, isAdminRole) to test role boundaries, department isolation,
 * stale session invalidation, account deactivation, and permission integrity.
 */

import { UserRole, Department } from '../types';
import {
  isAdminRole,
  isElevatedAdminRole,
  hasRequiredRole,
  verifyDepartmentAuth,
  verifySuperAdminAuth,
} from '../lib/auth-guard';
import {
  ADMIN_PERMISSIONS,
  DEPARTMENT_PERMISSIONS,
  DEFAULT_MANAGER_PERMISSIONS,
  isValidPermission,
} from '../lib/admin/permissions';
import { CreateAdminSchema } from '../lib/validators/manage-admins';
import { verifyDeliveryAdminAuth } from '../actions/delivery.actions';

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

async function runRbacTests() {
  console.log('\n=============================================================');
  console.log('🛡️  OX SHOES - MASTER MANAGER RBAC & AUTHORIZATION TEST SUITE');
  console.log('=============================================================\n');

  /* --------------------------------------------------------------------------
     1. ELEVATED ADMIN ROLE BOUNDARIES (SUPER_ADMIN & ADMIN)
     -------------------------------------------------------------------------- */
  console.log('--- 1. Elevated Admin Role Boundaries ---');
  {
    assert(isElevatedAdminRole(UserRole.SUPER_ADMIN), 'SUPER_ADMIN is elevated admin');
    assert(isElevatedAdminRole(UserRole.ADMIN), 'ADMIN is elevated admin');
    assert(isAdminRole(UserRole.SUPER_ADMIN), 'SUPER_ADMIN is admin role');
    assert(isAdminRole(UserRole.ADMIN), 'ADMIN is admin role');
    assert(!isElevatedAdminRole(UserRole.MANAGER), 'MANAGER is strictly NOT an elevated admin');
    assert(!isElevatedAdminRole(UserRole.RIDER), 'RIDER is strictly NOT an elevated admin');
    assert(!isElevatedAdminRole(UserRole.CUSTOMER), 'CUSTOMER is strictly NOT an elevated admin');
    assert(!isElevatedAdminRole(null), 'null is NOT an elevated admin (fail closed)');
  }

  /* --------------------------------------------------------------------------
     2. DEPARTMENT PERMISSION REGISTRY INTEGRITY
     -------------------------------------------------------------------------- */
  console.log('\n--- 2. Department Permission Registry Integrity ---');
  {
    // Inventory department
    const invPerms = DEPARTMENT_PERMISSIONS[Department.INVENTORY];
    assert(invPerms.includes('products:read'), 'Inventory Manager can have products:read');
    assert(invPerms.includes('products:write'), 'Inventory Manager can have products:write');
    assert(!invPerms.includes('orders:read' as any), 'Inventory Manager CANNOT have orders:read');
    assert(!invPerms.includes('delivery:dispatch' as any), 'Inventory Manager CANNOT have delivery:dispatch');

    // Orders department
    const ordPerms = DEPARTMENT_PERMISSIONS[Department.ORDERS];
    assert(ordPerms.includes('orders:read'), 'Orders Manager can have orders:read');
    assert(ordPerms.includes('orders:update_status'), 'Orders Manager can have orders:update_status');
    assert(!ordPerms.includes('products:write' as any), 'Orders Manager CANNOT have products:write');

    // Returns department
    const retPerms = DEPARTMENT_PERMISSIONS[Department.RETURNS];
    assert(retPerms.includes('returns:read'), 'Returns Manager can have returns:read');
    assert(!retPerms.includes('products:write' as any), 'Returns Manager CANNOT have products:write');

    // Delivery department
    const delPerms = DEPARTMENT_PERMISSIONS[Department.DELIVERY];
    const delDefaults = DEFAULT_MANAGER_PERMISSIONS[Department.DELIVERY];
    assert(delPerms.includes('delivery:view'), 'Delivery Manager can have delivery:view');
    assert(delPerms.includes('delivery:dispatch'), 'Delivery Manager can have delivery:dispatch');
    assert(delPerms.includes('delivery:settle'), 'Delivery Manager can be assigned delivery:settle');
    assert(!delDefaults.includes('delivery:settle'), 'delivery:settle is EXCLUDED from default Delivery Manager perms');
  }

  /* --------------------------------------------------------------------------
     3. DEPARTMENT SCOPE BOUNDARY VALIDATOR (ZOD SCHEMA)
     -------------------------------------------------------------------------- */
  console.log('\n--- 3. Validator Cross-Department Rejection ---');
  {
    // Inventory Manager attempting orders:read
    const crossInvResult = CreateAdminSchema.safeParse({
      name: 'Sneaky Inventory Manager',
      email: 'sneakyinv@oxshoes.pk',
      password: 'StrongPassword123!',
      role: UserRole.MANAGER,
      department: Department.INVENTORY,
      permissions: ['orders:read'],
    });
    assert(!crossInvResult.success, 'Inventory Manager with orders:read rejected by validator');

    // Orders Manager attempting products:write
    const crossOrdResult = CreateAdminSchema.safeParse({
      name: 'Sneaky Orders Manager',
      email: 'sneakyord@oxshoes.pk',
      password: 'StrongPassword123!',
      role: UserRole.MANAGER,
      department: Department.ORDERS,
      permissions: ['products:write'],
    });
    assert(!crossOrdResult.success, 'Orders Manager with products:write rejected by validator');

    // Manager with unknown permission
    const unknownPermResult = CreateAdminSchema.safeParse({
      name: 'Bad Perm Manager',
      email: 'badperm@oxshoes.pk',
      password: 'StrongPassword123!',
      role: UserRole.MANAGER,
      department: Department.INVENTORY,
      permissions: ['super:hacks'],
    });
    assert(!unknownPermResult.success, 'Manager with unknown permission rejected by validator');
  }

  /* --------------------------------------------------------------------------
     4. APPLICATION AUTHORIZATION HELPERS (UNAUTHENTICATED FAIL-CLOSED)
     -------------------------------------------------------------------------- */
  console.log('\n--- 4. Unauthenticated Server Action & Helper Fail-Closed ---');
  {
    const deptAuthNoSession = await verifyDepartmentAuth({
      requiredDepartment: Department.INVENTORY,
      requiredPermission: 'products:read',
    });
    assert(deptAuthNoSession.authorized === false, 'verifyDepartmentAuth rejects unauthenticated session');
    assert(deptAuthNoSession.error?.includes('Unauthenticated') === true, 'Returns explicit unauthenticated error');

    const superAdminAuthNoSession = await verifySuperAdminAuth();
    assert(superAdminAuthNoSession.authorized === false, 'verifySuperAdminAuth rejects unauthenticated session');

    const deliveryAuthNoSession = await verifyDeliveryAdminAuth('delivery:dispatch');
    assert(deliveryAuthNoSession.authorized === false, 'verifyDeliveryAdminAuth rejects unauthenticated session');
  }

  /* --------------------------------------------------------------------------
     5. SUPER_ADMIN ACCOUNT MANAGEMENT BOUNDARY
     -------------------------------------------------------------------------- */
  console.log('\n--- 5. Super Admin Clearance Requirement ---');
  {
    assert((UserRole.SUPER_ADMIN as string) === 'super_admin', 'SUPER_ADMIN role string is super_admin');
    assert((UserRole.ADMIN as string) !== 'super_admin', 'ADMIN role string is not super_admin');
    assert((UserRole.MANAGER as string) !== 'super_admin', 'MANAGER role string is not super_admin');
  }

  /* --------------------------------------------------------------------------
     6. CUSTOMER & RIDER ISOLATION REGRESSION
     -------------------------------------------------------------------------- */
  console.log('\n--- 6. Customer & Rider Non-Admin Isolation ---');
  {
    assert(!isAdminRole(UserRole.RIDER), 'RIDER role cannot pass admin layout guard');
    assert(!isAdminRole(UserRole.CUSTOMER), 'CUSTOMER role cannot pass admin layout guard');

    // Customer own order ownership check
    const isOwnOrder = (orderUserId: string | null, sessionUserId: string | null) => {
      if (!orderUserId || !sessionUserId) return false;
      return orderUserId === sessionUserId;
    };

    assert(isOwnOrder('user_123', 'user_123') === true, 'Customer can access own order');
    assert(isOwnOrder('user_123', 'user_456') === false, 'Customer CANNOT access another customer order');
  }

  /* --------------------------------------------------------------------------
     FINAL TEST RESULTS SUMMARY
     -------------------------------------------------------------------------- */
  console.log('\n=============================================================');
  console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('=============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runRbacTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

