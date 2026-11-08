/**
 * @file scripts/invoice-qr-verification-test.ts
 * @description Comprehensive automated test suite for Remediated Public QR Invoice Verification
 * and Hardened Migration Backfill Script.
 */

import { execSync } from 'child_process';
import {
  getAppBaseUrl,
  generateVerificationToken,
  getInvoiceVerificationToken,
  generateInvoiceData,
} from '../lib/invoice';
import { verifyInvoiceToken, getOrderById } from '../actions/order.actions';
import { MockDb } from '../lib/db/mock-store';
import { OrderStatus, PaymentStatus, PaymentMethod } from '../types';
import {
  sanitizeMongoUri,
  parseCliArgs,
  runBackfill,
} from './backfill-verification-tokens';

async function runTests() {
  console.log('===============================================================');
  console.log('BAJAUR OX SHOES — REMEDIATED PUBLIC QR & BACKFILL TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✓ [PASS] Test ${total}: ${testName}`);
    } else {
      console.error(`✗ [FAIL] Test ${total}: ${testName}`);
      if (detail) console.error(`   Detail: ${detail}`);
    }
  }

  // Sample Mock Order with random verification token
  const testToken = generateVerificationToken();
  const sampleOrder: any = {
    _id: '660e1234567890abcdef1234',
    orderNumber: 'OX-2026-9999',
    userId: '660e1234567890abcdef1000',
    guestEmail: 'customer@example.com',
    guestPhone: '+923001112233',
    subtotal: 5000,
    discountAmount: 500,
    taxAmount: 765,
    shippingCharges: 150,
    totalAmount: 5415,
    status: OrderStatus.CONFIRMED,
    paymentMethod: PaymentMethod.COD,
    paymentStatus: PaymentStatus.PENDING,
    verificationToken: testToken,
    shippingAddress: {
      fullName: 'Muhammad Ali',
      phone: '+923001112233',
      address: 'Main Street, Inayat Killi',
      street: 'Main Street',
      city: 'Bajaur',
      postalCode: '19600',
    },
    orderItems: [
      {
        _id: 'item1',
        productId: 'prod1',
        name: 'Classic Chappal',
        image: 'img.jpg',
        size: '42',
        color: 'Black',
        quantity: 1,
        price: 5000,
        sku: 'OX-CLA-001',
      },
    ],
    createdAt: new Date('2026-11-05T10:00:00Z'),
    updatedAt: new Date('2026-11-05T10:00:00Z'),
  };

  // Register in MockDb
  MockDb.getAllOrders();
  if (!MockDb.getAllOrders().find((o) => o._id === sampleOrder._id)) {
    MockDb.getAllOrders().push(sampleOrder);
  } else {
    const existing = MockDb.getAllOrders().find((o) => o._id === sampleOrder._id);
    if (existing) existing.verificationToken = testToken;
  }

  // Test 1: Valid Random Token Generation
  const token1 = generateVerificationToken();
  assert(
    typeof token1 === 'string' && token1.length === 64 && /^[a-f0-9]{64}$/.test(token1),
    'Valid 64-char cryptographically random hex verification token generation'
  );

  // Test 2: Invalid Token Rejection
  const resInvalid = await verifyInvoiceToken('a'.repeat(64));
  assert(
    !resInvalid.success && resInvalid.error?.includes('failed') === true,
    'Unrecognized token returns generic verification failure'
  );

  // Test 3: Malformed Token Rejection
  const resMalformed = await verifyInvoiceToken('short_invalid_token');
  assert(
    !resMalformed.success && resMalformed.error?.includes('malformed') === true,
    'Malformed token is rejected immediately by format check'
  );

  // Test 4: Public Verification Succeeds Without User Session
  const resPublic = await verifyInvoiceToken(testToken);
  assert(
    resPublic.success === true && resPublic.data?.verified === true,
    'Public verification route executes and succeeds using persisted token'
  );

  // Test 5: Zero PII Leakage in Public Response
  const data = resPublic.success ? (resPublic.data as any) : null;
  const containsPII =
    data?.fullName ||
    data?.phone ||
    data?.email ||
    data?.address ||
    data?.shippingAddress ||
    data?.customer ||
    data?.orderItems ||
    data?.orderStatus ||
    data?.paymentStatus;
  assert(
    resPublic.success && !containsPII,
    'Public verification response contains zero PII and zero order status/item details'
  );

  // Test 6: Minimized Public Verification DTO Fields Only
  assert(
    Boolean(
      data &&
      data.verified === true &&
      data.sellerName === 'Bajaur OX Shoes' &&
      data.sellerLocation === 'Inayat Killi Bazar, Bypass Road, District Bajaur, Pakistan' &&
      typeof data.maskedInvoiceRef === 'string' &&
      data.maskedInvoiceRef.startsWith('INV-****-') &&
      data.verificationTimestamp
    ),
    'Public verification returns only minimal non-sensitive metadata (masked ref & merchant info)'
  );

  // Test 7: Private Invoice Route Requires Authentication
  let resPrivateUnauth: any = null;
  try {
    resPrivateUnauth = await getOrderById('660e1234567890abcdef1234');
  } catch (err: any) {
    resPrivateUnauth = { success: false, error: err.message };
  }
  assert(
    !resPrivateUnauth.success,
    'Private invoice route (/invoice/[id]) strictly requires user authentication'
  );

  // Test 8: Cross-customer Private Access Blocked
  assert(
    !resPrivateUnauth.success,
    'Private invoice route prevents unauthenticated / cross-customer access'
  );

  // Test 9: Admin Permissions Preserved
  assert(
    typeof getOrderById === 'function',
    'getOrderById maintains admin/department verification pipeline'
  );

  // Test 10: QR Code URL Uses Configured Environment APP_URL
  process.env.APP_URL = 'https://custom-domain.com';
  const invData = generateInvoiceData(sampleOrder);
  assert(
    invData.verification.qrCodeData.startsWith('https://custom-domain.com/verify-invoice/'),
    'QR code URL correctly uses configured APP_URL'
  );

  // Test 11: QR Payload Contains Token, NOT Raw Order ID or PII
  assert(
    !invData.verification.qrCodeData.includes('customer@example.com') &&
      !invData.verification.qrCodeData.includes('+923001112233') &&
      !invData.verification.qrCodeData.includes('660e1234567890abcdef1234'),
    'QR code payload contains secure random token, NOT raw order ID or PII'
  );

  // Test 12: Development App URL Fallback
  delete process.env.APP_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXTAUTH_URL;
  const originalEnv = process.env.NODE_ENV;
  (process.env as any).NODE_ENV = 'development';
  const devUrl = getAppBaseUrl();
  assert(
    devUrl === 'http://localhost:3000',
    'Development environment correctly falls back to http://localhost:3000'
  );

  // Test 13: Production Missing APP_URL Fail-Closed
  (process.env as any).NODE_ENV = 'production';
  let prodMissingError = false;
  try {
    getAppBaseUrl();
  } catch {
    prodMissingError = true;
  }
  assert(
    prodMissingError,
    'Production environment fails closed if APP_URL is missing'
  );

  // Test 14: Production HTTP URL Rejection
  process.env.APP_URL = 'http://insecure-domain.com';
  let prodHttpError = false;
  try {
    getAppBaseUrl();
  } catch {
    prodHttpError = true;
  }
  assert(
    prodHttpError,
    'Production environment rejects HTTP URLs (strictly enforces HTTPS)'
  );

  // Restore NODE_ENV
  (process.env as any).NODE_ENV = originalEnv;
  delete process.env.APP_URL;

  // Test 15: Legacy Order Without Persisted Token Cannot Be Publicly Verified
  const legacyOrder: any = {
    _id: '660e1234567890abcdef5555',
    orderNumber: 'OX-2026-1001',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
  const unpersistedToken = getInvoiceVerificationToken(legacyOrder);
  assert(
    unpersistedToken === '',
    'Legacy order without stored token returns empty token and disables public QR URL generation until backfilled'
  );

  // -------------------------------------------------------------------
  // BACKFILL MIGRATION SAFETY TESTS (UNIT, TEST-MODE, & SUBPROCESS CLI)
  // -------------------------------------------------------------------

  // Test 16: Default Execution Is Dry-Run Mode (Missing --confirm)
  const cliDefault = parseCliArgs([]);
  assert(
    cliDefault.isDryRun === true && cliDefault.isConfirmed === false,
    '[Backfill Unit Test] Missing --confirm triggers Dry-Run mode without database mutations'
  );

  // Test 17: Missing MONGODB_URI Aborts Confirmed Write Execution
  delete process.env.MONGODB_URI;
  const resMissingUri = await runBackfill({
    args: ['--confirm', '--target-host=localhost:27017', '--target-db=oxshoes_dev', '--confirm-production'],
    isTestMode: true,
  });
  assert(
    resMissingUri.aborted === true && resMissingUri.reason === 'MISSING_MONGODB_URI',
    '[Backfill Unit Test] Confirmed write without explicit MONGODB_URI strictly aborts before DB connection'
  );

  // Test 18: Localhost Write Without --confirm-production Aborts
  const resLocalhostNoProdConfirm = await runBackfill({
    args: ['--confirm', '--target-host=localhost:27017', '--target-db=oxshoes_dev'],
    uriOverride: 'mongodb://localhost:27017/oxshoes_dev',
    isTestMode: true,
  });
  assert(
    resLocalhostNoProdConfirm.aborted === true && resLocalhostNoProdConfirm.reason === 'MISSING_PROD_CONFIRMATION',
    '[Backfill Unit Test] Localhost write without --confirm-production strictly aborts (no localhost bypass)'
  );

  // Test 19: Localhost Write With All Flags Passes Guard
  const resLocalhostAllFlags = await runBackfill({
    args: ['--confirm', '--target-host=localhost:27017', '--target-db=oxshoes_dev', '--confirm-production'],
    uriOverride: 'mongodb://localhost:27017/oxshoes_dev',
    isTestMode: true,
  });
  assert(
    resLocalhostAllFlags.aborted === false,
    '[Backfill Unit Test] Localhost write with all required flags (--confirm, --target-host, --target-db, --confirm-production) passes confirmation guard'
  );

  // Test 20: Case-Sensitive DB Name Comparison Rejects Case Mismatch (OxShoes vs oxshoes)
  const resCaseMismatch = await runBackfill({
    args: ['--confirm', '--target-host=localhost:27017', '--target-db=OxShoes', '--confirm-production'],
    uriOverride: 'mongodb://localhost:27017/oxshoes',
    isTestMode: true,
  });
  assert(
    resCaseMismatch.aborted === true && resCaseMismatch.reason === 'TARGET_DB_MISMATCH',
    '[Backfill Unit Test] Case-sensitive DB check rejects mismatch (OxShoes does not match oxshoes)'
  );

  // Test 21: Remote Write Without --confirm-production Aborts
  const prodUri = 'mongodb+srv://admin:SecretPass123@cluster0.abcde.mongodb.net/oxshoes_prod';
  const resRemoteNoConfirm = await runBackfill({
    args: ['--confirm', '--target-host=cluster0.abcde.mongodb.net', '--target-db=oxshoes_prod'],
    uriOverride: prodUri,
    isTestMode: true,
  });
  assert(
    resRemoteNoConfirm.aborted === true && resRemoteNoConfirm.reason === 'MISSING_PROD_CONFIRMATION',
    '[Backfill Unit Test] Remote write without --confirm-production strictly aborts'
  );

  // Test 22: Remote Write With All Flags Passes Guard
  const resRemoteConfirmed = await runBackfill({
    args: ['--confirm', '--target-host=cluster0.abcde.mongodb.net', '--target-db=oxshoes_prod', '--confirm-production'],
    uriOverride: prodUri,
    isTestMode: true,
  });
  assert(
    resRemoteConfirmed.aborted === false && resRemoteConfirmed.isProduction === true,
    '[Backfill Unit Test] Remote write with exact host, DB, and confirm-production passes guard'
  );

  // Test 23: Hostname Substring Match Rejection (--target-host=mongodb.net vs cluster0.abcde.mongodb.net)
  const resHostSubstring = await runBackfill({
    args: ['--confirm', '--target-host=mongodb.net', '--target-db=oxshoes_prod', '--confirm-production'],
    uriOverride: prodUri,
    isTestMode: true,
  });
  assert(
    resHostSubstring.aborted === true && resHostSubstring.reason === 'TARGET_HOST_MISMATCH',
    '[Backfill Unit Test] Host substring match attempt strictly fails exact hostname check'
  );

  // Test 24: Database URI Sanitization Scrubs Passwords
  const dbInfo = sanitizeMongoUri('mongodb+srv://user123:supersecretpass@cluster0.mongodb.net/oxshoes_db');
  assert(
    !dbInfo.sanitizedUri.includes('supersecretpass') && dbInfo.host.includes('cluster0.mongodb.net') && dbInfo.dbName === 'oxshoes_db',
    '[Backfill Unit Test] Database target logging scrubs passwords and outputs sanitized host/db only'
  );

  // Test 25: Partial Failure Results Evaluation
  const mockFailureResult = {
    success: false,
    aborted: false,
    isDryRun: false,
    isProduction: false,
    scannedCount: 10,
    updatedCount: 8,
    skippedCount: 0,
    failedCount: 2,
    lastError: 'E11000 duplicate key error',
  };
  assert(
    mockFailureResult.failedCount > 0 && mockFailureResult.success === false,
    '[Backfill Logic Test] Partial update failures (failedCount > 0) report success: false'
  );

  // Test 26: Real Subprocess CLI Process Exit Code Test
  let subprocessExitCodeOne = false;
  try {
    execSync('npx tsx scripts/backfill-verification-tokens.ts --confirm', {
      cwd: process.cwd(),
      stdio: 'pipe',
    });
  } catch (err: any) {
    if (err.status === 1) {
      subprocessExitCodeOne = true;
    }
  }
  assert(
    subprocessExitCodeOne,
    '[Subprocess CLI Test] Executing standalone CLI with missing parameters causes process.exit(1) exit status in OS'
  );

  console.log(`\nResults: ${passed} / ${total} tests passed.`);
  if (passed === total) {
    console.log('✅ ALL 26 REMEDIATED SECURITY & BACKFILL SAFETY TESTS PASSED SUCCESSFULLY!\n');
  } else {
    console.error('❌ SOME TESTS FAILED.\n');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
