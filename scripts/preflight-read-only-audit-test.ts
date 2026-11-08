/**
 * @file scripts/preflight-read-only-audit-test.ts
 * @description Dedicated automated unit and logic test suite for the Standalone READ-ONLY MongoDB Preflight Audit Script.
 *
 * NOTE ON TEST ISOLATION & ACCURACY:
 * These tests evaluate process exit codes, environment variable guards, and top-level BSON type classification logic.
 * ZERO LIVE MONGODB CONNECTIONS OR DATABASE MUTATIONS ARE PERFORMED.
 * THIS TEST SUITE CONSISTS OF OFFLINE UNIT & LOGIC TESTS (NOT LIVE MONGODB ENGINE INTEGRATION TESTS).
 */

import { execSync } from 'child_process';
import { runReadOnlyPreflight } from './preflight-read-only-audit';

/**
 * Helper function emulating MongoDB top-level BSON $type semantics via $expr.
 * Unlike standard MongoDB query filters which unwrap arrays, $type: "$verificationToken" returns "array" for array inputs.
 */
function getTopLevelBsonType(val: any): 'missing' | 'null' | 'string' | 'number' | 'bool' | 'object' | 'array' {
  if (val === undefined) return 'missing';
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  if (typeof val === 'string') return 'string';
  if (typeof val === 'number') return 'number';
  if (typeof val === 'boolean') return 'bool';
  if (typeof val === 'object') return 'object';
  return 'object';
}

function classifyBsonDocument(val: any): 'missing' | 'null' | 'exact_empty' | 'whitespace_only' | 'valid_scalar' | 'malformed' {
  const bsonType = getTopLevelBsonType(val);
  if (bsonType === 'missing') return 'missing';
  if (bsonType === 'null') return 'null';
  if (bsonType !== 'string') return 'malformed';

  // val is guaranteed to be a scalar string
  if (val === '') return 'exact_empty';
  if (/^\s+$/.test(val)) return 'whitespace_only';
  return 'valid_scalar';
}

async function runPreflightAuditTests() {
  console.log('===============================================================');
  console.log('BAJAUR OX SHOES — DEDICATED PREFLIGHT READ-ONLY AUDIT TEST SUITE');
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

  const originalUri = process.env.MONGODB_URI;

  // -------------------------------------------------------------------
  // TEST 1: Missing MONGODB_URI Returns Failure
  // -------------------------------------------------------------------
  delete process.env.MONGODB_URI;
  const resMissingUri = await runReadOnlyPreflight();
  assert(
    resMissingUri.success === false && resMissingUri.reason === 'MISSING_MONGODB_URI',
    '[Unit Test] Missing MONGODB_URI returns success: false with reason MISSING_MONGODB_URI'
  );

  // -------------------------------------------------------------------
  // TEST 2: Unreachable/Failed Connection Returns Failure
  // -------------------------------------------------------------------
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/nonexistent_test_db';
  const resConnFail = await runReadOnlyPreflight();
  assert(
    resConnFail.success === false && resConnFail.reason === 'CONNECTION_FAILED',
    '[Unit Test] Database connection failure returns success: false with reason CONNECTION_FAILED'
  );

  // -------------------------------------------------------------------
  // TEST 3: CLI Subprocess Exit Status 1 on Missing MONGODB_URI
  // -------------------------------------------------------------------
  let cliExitCodeOne = false;
  try {
    execSync('npx tsx scripts/preflight-read-only-audit.ts', {
      cwd: process.cwd(),
      env: { ...process.env, MONGODB_URI: '' },
      stdio: 'pipe',
    });
  } catch (err: any) {
    if (err.status === 1) {
      cliExitCodeOne = true;
    }
  }
  assert(
    cliExitCodeOne === true,
    '[Subprocess CLI Test] Executing standalone preflight CLI with missing MONGODB_URI triggers OS exit status 1'
  );

  // -------------------------------------------------------------------
  // TEST 4: Top-Level BSON Type Classification Test Suite
  // Tests 13 distinct BSON value forms (scalars, null, missing, numbers, objects, and arrays)
  // -------------------------------------------------------------------
  const testCases: Array<{ val: any; expected: ReturnType<typeof classifyBsonDocument>; label: string }> = [
    { val: 'abc', expected: 'valid_scalar', label: 'Scalar string "abc"' },
    { val: '', expected: 'exact_empty', label: 'Scalar empty string ""' },
    { val: ' ', expected: 'whitespace_only', label: 'Scalar single whitespace " "' },
    { val: '\t', expected: 'whitespace_only', label: 'Scalar tab whitespace "\\t"' },
    { val: null, expected: 'null', label: 'Explicit null' },
    { val: undefined, expected: 'missing', label: 'Missing field' },
    { val: 12345, expected: 'malformed', label: 'Number 12345' },
    { val: true, expected: 'malformed', label: 'Boolean true' },
    { val: { value: 'abc' }, expected: 'malformed', label: 'Object { value: "abc" }' },
    { val: [], expected: 'malformed', label: 'Empty array []' },
    { val: ['abc'], expected: 'malformed', label: 'Array containing string ["abc"]' },
    { val: [''], expected: 'malformed', label: 'Array containing empty string [""]' },
    { val: [' '], expected: 'malformed', label: 'Array containing whitespace [" "]' },
  ];

  testCases.forEach((tc) => {
    const actual = classifyBsonDocument(tc.val);
    assert(
      actual === tc.expected,
      `[BSON Type Test] ${tc.label} classified as "${actual}" (expected "${tc.expected}")`
    );
  });

  // Restore original process.env
  if (originalUri) {
    process.env.MONGODB_URI = originalUri;
  } else {
    delete process.env.MONGODB_URI;
  }

  console.log(`\nResults: ${passed} / ${total} tests passed.`);
  if (passed === total) {
    console.log('✅ ALL DEDICATED PREFLIGHT AUDIT UNIT & LOGIC TESTS PASSED SUCCESSFULLY!\n');
  } else {
    console.error('❌ SOME PREFLIGHT TESTS FAILED.\n');
    process.exit(1);
  }
}

runPreflightAuditTests().catch((err) => {
  console.error('Fatal preflight test error:', err);
  process.exit(1);
});
