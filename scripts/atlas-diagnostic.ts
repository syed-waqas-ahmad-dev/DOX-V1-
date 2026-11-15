/**
 * @file scripts/atlas-diagnostic.ts
 * @description Hardened read-only MongoDB Atlas and inventory consistency diagnostic for Bajaur OX Shoes.
 * Strictly non-destructive: ZERO database writes, ZERO stock changes, ZERO order creation.
 * Reuses project connection configuration, driver topology APIs, Mongoose models, and detectMongoTransactionSupport().
 * Strict TypeScript: ZERO `any`.
 */

import mongoose from 'mongoose';
import {
  connectToDatabase,
  disconnectFromDatabase,
  isDatabaseConfigured,
  getConnectionState,
} from '../lib/db/connect';
import {
  detectMongoTransactionSupport,
  resetTransactionTopologyCache,
  type MongoTransactionSupportStatus,
} from '../lib/services/wallet.service';
import { Product } from '../models/Product';
import type { IProduct, IProductVariant } from '../types';

export type DiagnosticStatus = 'PASS' | 'FAIL' | 'NOT VERIFIED' | 'QUERY ERROR' | 'NOT CONFIGURED';

export interface DiagnosticSummary {
  environmentConfig: DiagnosticStatus;
  connection: DiagnosticStatus;
  topologyBaseline: DiagnosticStatus;
  applicationDetector: DiagnosticStatus;
  productStockConsistency: DiagnosticStatus;
  overallStatus: DiagnosticStatus;
  overallSuccess: boolean;
}

/**
 * Masks connection strings completely.
 * Never prints credentials, cluster hostnames, database names, query parameters, or infrastructure identifiers.
 */
function maskConnectionString(raw?: string): string {
  if (!raw || raw.trim().length === 0) return '[NOT CONFIGURED / UNSET]';
  const trimmed = raw.trim();
  if (trimmed.startsWith('mongodb+srv://')) {
    return 'mongodb+srv://[REDACTED_CREDENTIALS_HOSTS_AND_DATABASE]';
  }
  if (trimmed.startsWith('mongodb://')) {
    return 'mongodb://[REDACTED_CREDENTIALS_HOSTS_AND_DATABASE]';
  }
  return '[CONFIGURED: non-standard connection scheme, all infrastructure details masked]';
}

/**
 * Validates whether a value is a valid, safe, non-negative integer stock value.
 * Rejects undefined, null, NaN, Infinity, strings, floats, unsafe integers, and negative numbers.
 */
function isValidStockNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isSafeInteger(val) && val >= 0;
}

/**
 * Formats an invalid stock value safely without serializing arbitrary objects.
 */
function formatInvalidStockValue(val: unknown): string {
  if (typeof val === 'number') {
    return String(val);
  }
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  return `non-number (${typeof val})`;
}

const SAFE_DETECTOR_REASONS: Readonly<Record<string, string>> = {
  NOT_CONNECTED: 'NOT_CONNECTED',
  STANDALONE: 'STANDALONE',
  REPLICA_SET_NO_PRIMARY: 'REPLICA_SET_NO_PRIMARY',
  NO_LOGICAL_SESSIONS: 'NO_LOGICAL_SESSIONS',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Sanitizes transaction detector reason strings using a strict allowlist.
 * Maps unexpected or unapproved values to a generic message.
 */
function sanitizeDetectorReason(reason: unknown, supported: boolean): string {
  if (!reason) {
    return supported ? 'None (Fully Supported)' : 'Additional details withheld';
  }
  if (typeof reason === 'string' && Object.prototype.hasOwnProperty.call(SAFE_DETECTOR_REASONS, reason)) {
    return SAFE_DETECTOR_REASONS[reason];
  }
  return 'Additional details withheld';
}

interface HelloResponse {
  setName?: string;
  msg?: string;
  isWritablePrimary?: boolean;
  ismaster?: boolean;
  logicalSessionTimeoutMinutes?: number | null;
  maxWireVersion?: number;
  hosts?: unknown[];
  ok?: number;
}

interface DriverTopologyDescription {
  type?: string;
  logicalSessionTimeoutMinutes?: number | null;
  servers?: Map<string, unknown> | unknown[];
}

interface DriverClient {
  topology?: {
    description?: DriverTopologyDescription;
  };
}

export async function runAtlasDiagnostic(): Promise<DiagnosticSummary> {
  const hrStart = process.hrtime();

  console.log('================================================================================');
  console.log('       BAJAUR OX SHOES — HARDENED READ-ONLY ATLAS & INVENTORY DIAGNOSTIC         ');
  console.log('================================================================================');
  console.log(`Execution Timestamp: ${new Date().toISOString()}`);
  console.log(`Node.js Version:     ${process.version}`);
  console.log(`NODE_ENV:            ${process.env.NODE_ENV || 'development'}`);
  console.log(`APP_ENV:             ${process.env.APP_ENV || '[UNSET]'}`);
  console.log(`Vercel Environment:  ${process.env.VERCEL_ENV || '[NOT ON VERCEL]'}`);
  console.log('--------------------------------------------------------------------------------\n');

  const summary: DiagnosticSummary = {
    environmentConfig: 'NOT CONFIGURED',
    connection: 'NOT CONFIGURED',
    topologyBaseline: 'NOT VERIFIED',
    applicationDetector: 'NOT VERIFIED',
    productStockConsistency: 'NOT VERIFIED',
    overallStatus: 'NOT CONFIGURED',
    overallSuccess: false,
  };

  let fatalErrorOccurred = false;
  let connectionEstablished = false;

  // ---------------------------------------------------------------------------
  // STEP 1: Environment & Pre-Connection Configuration Check
  // ---------------------------------------------------------------------------
  console.log('1. ENVIRONMENT & CONFIGURATION CHECK:');
  const rawUri = process.env.MONGODB_URI;
  const rawDbName = process.env.MONGODB_DB_NAME;
  const isConfigured = isDatabaseConfigured();

  console.log(`   - MONGODB_URI configured:     ${Boolean(rawUri && rawUri.trim().length > 0)}`);
  console.log(`   - MONGODB_URI (masked):       ${maskConnectionString(rawUri)}`);
  console.log(`   - MONGODB_DB_NAME configured: ${Boolean(rawDbName && rawDbName.trim().length > 0)}`);
  console.log(`   - Database Target Override:   ${rawDbName ? '[CONFIGURED: database name masked]' : '[DEFAULT_FALLBACK]'}`);
  console.log(`   - isDatabaseConfigured():     ${isConfigured}`);

  if (!isConfigured) {
    summary.environmentConfig = 'NOT CONFIGURED';
    summary.connection = 'NOT CONFIGURED';
    console.log('\n   [STATUS: NOT CONFIGURED]');
    console.log('   MONGODB_URI is not set or contains an unconfigured placeholder in process.env.');
    console.log('   The current runtime environment does not have a live MongoDB Atlas connection.');
    console.log('   Skipping connection attempt to prevent false negatives or accidental mock usage.');
  } else {
    summary.environmentConfig = 'PASS';

    // -------------------------------------------------------------------------
    // STEP 2: Establish Read-Only MongoDB Connection with Reliable Cleanup
    // -------------------------------------------------------------------------
    console.log('\n2. ESTABLISHING CONNECTION:');
    console.log('   - Connecting via project singleton connectToDatabase()...');

    try {
      let mongooseConn: typeof mongoose | null = null;
      try {
        mongooseConn = (await connectToDatabase()) as typeof mongoose | null;
      } catch {
        console.error('   [CONNECTION ERROR]: Category=CONNECTION_EXCEPTION - Failed to connect to database.');
      }

      const connState = getConnectionState();
      console.log(`   - Connection Status:          ${connState.status}`);
      console.log(`   - Mongoose readyState:        ${connState.readyState} (1 = connected)`);
      console.log(`   - Database Connection State:  ${connState.readyState === 1 ? '[ESTABLISHED]' : '[UNAVAILABLE]'}`);

      if (!mongooseConn || connState.readyState !== 1 || !mongoose.connection.db) {
        summary.connection = 'FAIL';
        console.log('\n   [STATUS: CONNECTION UNREACHABLE]');
        console.log('   Could not establish an active MongoDB connection with the configured environment.');
        console.log('   Verify network access, cluster availability, and credentials in your environment.');
      } else {
        connectionEstablished = true;
        summary.connection = 'PASS';
        console.log('   [STATUS: CONNECTED SUCCESSFULLY]');

        // ---------------------------------------------------------------------
        // STEP 3: Preliminary Driver/Server Capability Baseline
        // ---------------------------------------------------------------------
        console.log('\n3. PRELIMINARY DRIVER & SERVER CAPABILITY INDICATORS:');
        console.log('   (Baseline topology & session prerequisites; not a guarantee of transaction write success)');

        let clientTopologyType = 'Unknown';
        let clientLogicalSessionTimeout: number | null | undefined = undefined;
        let serverCount = 0;

        try {
          const rawClient =
            typeof mongoose.connection.getClient === 'function'
              ? (mongoose.connection.getClient() as unknown as DriverClient)
              : null;
          const desc = rawClient?.topology?.description;
          clientTopologyType = desc?.type || 'Unknown';
          clientLogicalSessionTimeout = desc?.logicalSessionTimeoutMinutes;
          if (desc?.servers) {
            serverCount =
              desc.servers instanceof Map
                ? desc.servers.size
                : Array.isArray(desc.servers)
                  ? desc.servers.length
                  : 0;
          }
        } catch {
          console.warn('   - Warning: Category=TOPOLOGY_READ_ERROR - Unable to read driver topology metadata.');
        }

        console.log(`   - Driver Topology Type:       ${clientTopologyType}`);
        console.log(`   - Driver Known Server Count:  ${serverCount}`);
        console.log(`   - Driver Session Timeout:     ${clientLogicalSessionTimeout != null ? `${clientLogicalSessionTimeout}m` : '[NONE]'}`);

        let helloResult: HelloResponse | null = null;
        try {
          const admin = mongoose.connection.db.admin();
          helloResult = (await admin.command({ hello: 1 })) as HelloResponse;
        } catch {
          console.warn('   - Warning: Category=HELLO_COMMAND_ERROR - Read-only { hello: 1 } admin probe failed.');
        }

        let isReplicaOrSharded = false;
        let isWritable = false;
        let hasSessions = false;

        if (helloResult) {
          console.log('   - MongoDB Server Command:     { hello: 1 } Succeeded');
          console.log(`   - Replica Set Detected:       ${Boolean(helloResult.setName)}`);
          console.log(`   - Sharded Router (mongos):    ${helloResult.msg === 'isdbgrid'}`);
          console.log(`   - Writable Primary Ready:     ${Boolean(helloResult.isWritablePrimary ?? helloResult.ismaster)}`);
          console.log(`   - Logical Sessions Active:    ${helloResult.logicalSessionTimeoutMinutes != null}`);
          console.log(`   - Server Max Wire Version:    ${helloResult.maxWireVersion ?? 'N/A'}`);
          if (Array.isArray(helloResult.hosts)) {
            console.log(`   - Replica Set Node Count:     ${helloResult.hosts.length}`);
          }

          isReplicaOrSharded = Boolean(helloResult.setName || helloResult.msg === 'isdbgrid');
          isWritable = Boolean(helloResult.isWritablePrimary ?? helloResult.ismaster ?? (helloResult.msg === 'isdbgrid'));
          hasSessions = helloResult.logicalSessionTimeoutMinutes != null;
        } else {
          console.log('   - MongoDB Server Command:     { hello: 1 } FAILED or insufficient privileges');
        }

        const baselinePrerequisitesMet = isReplicaOrSharded && isWritable && hasSessions;
        if (baselinePrerequisitesMet) {
          summary.topologyBaseline = 'PASS';
          console.log('\n   >> Preliminary Indicator:     [PASS: Server meets baseline prerequisites for multi-document transactions]');
          console.log('      (Note: Actual transaction execution safety requires validating the application transaction detector)');
        } else {
          summary.topologyBaseline = 'FAIL';
          console.log('\n   >> Preliminary Indicator:     [FAIL: Cluster does not report replica set / sharded primary with logical sessions]');
        }

        // ---------------------------------------------------------------------
        // STEP 4: Application Transaction Detector Verification
        // ---------------------------------------------------------------------
        console.log('\n4. APPLICATION TRANSACTION DETECTOR (detectMongoTransactionSupport):');
        resetTransactionTopologyCache(); // Reset cached result to force live probe
        let appStatus: MongoTransactionSupportStatus;
        try {
          appStatus = await detectMongoTransactionSupport();
        } catch {
          appStatus = {
            supported: false,
            topologyType: 'Error',
            reason: 'UNKNOWN',
          };
          console.error('   [APPLICATION DETECTOR ERROR]: Category=DETECTOR_EXCEPTION - Transaction support detector failed.');
        }

        console.log(`   - App Detector Supported:     ${appStatus.supported ? 'YES (Transactions Permitted)' : 'NO (Transactions Blocked)'}`);
        console.log(`   - App Topology Classification:${appStatus.topologyType}`);
        console.log(`   - App Detector Reason:        ${sanitizeDetectorReason(appStatus.reason, appStatus.supported)}`);

        if (appStatus.supported) {
          summary.applicationDetector = 'PASS';
        } else {
          summary.applicationDetector = 'FAIL';
        }

        const detectorsAgree = (summary.topologyBaseline === 'PASS') === appStatus.supported;
        console.log(`   - Indicator / Detector Match: ${detectorsAgree ? 'ALIGNED' : 'MISMATCH DETECTED'}`);

        // ---------------------------------------------------------------------
        // STEP 5: Product OX-JOG-010 Inventory Consistency Check
        // ---------------------------------------------------------------------
        console.log('\n5. PRODUCT "OX-JOG-010" STOCK INTEGRITY CHECK:');
        const collectionName = Product.collection.name;
        console.log(`   - Target Collection:          "${collectionName}" (Mongoose model Product)`);

        let targetProduct: IProduct | null = null;
        let queryFailed = false;

        try {
          targetProduct = (await Product.findOne({ sku: 'OX-JOG-010' }).lean()) as IProduct | null;
          if (!targetProduct) {
            targetProduct = (await Product.findOne({ sku: /^OX-JOG-010$/i }).lean()) as IProduct | null;
          }
        } catch {
          queryFailed = true;
          console.error('   [DATABASE QUERY ERROR]: Category=PRODUCT_QUERY_ERROR - Read query failed during product lookup.');
        }

        if (queryFailed) {
          summary.productStockConsistency = 'QUERY ERROR';
          console.log('   - Product Lookup Status:      QUERY ERROR');
          console.log('   - Product Stock Consistency:  QUERY ERROR (Database query failed; stock consistency could not be evaluated)');
        } else if (!targetProduct) {
          summary.productStockConsistency = 'NOT VERIFIED';
          let totalDocs = -1;
          try {
            totalDocs = await Product.countDocuments();
          } catch {
            console.warn('   - Warning: Category=COUNT_QUERY_ERROR - Product count query failed.');
          }
          console.log(`   - Product Lookup Status:      NOT FOUND in collection "${collectionName}"`);
          if (totalDocs >= 0) {
            console.log(`   - Total Products in Database: ${totalDocs}`);
          }
          console.log('   - Product Stock Consistency:  NOT VERIFIED (Product OX-JOG-010 was not found in database)');
        } else {
          console.log('   - Product Record Found:');
          console.log(`     * Name:                     ${targetProduct.name}`);
          console.log(`     * SKU:                      ${targetProduct.sku}`);
          console.log(`     * Category / SubCategory:   ${targetProduct.category} / ${targetProduct.subCategory}`);
          console.log(`     * Brand:                    ${targetProduct.brand}`);
          console.log(`     * Active Status:            ${targetProduct.isActive}`);

          const parentStockRaw: unknown = targetProduct.stock;
          const isParentStockValid = isValidStockNumber(parentStockRaw);
          console.log(
            `     * Parent Stock Field:       ${isParentStockValid ? parentStockRaw : `INVALID (${formatInvalidStockValue(parentStockRaw)})`}`
          );

          const hasVariants = Array.isArray(targetProduct.variants) && targetProduct.variants.length > 0;
          console.log(`     * Product Structure Type:   ${hasVariants ? 'VARIANT-BASED PRODUCT' : 'SIMPLE PRODUCT'}`);

          if (hasVariants) {
            const variants = targetProduct.variants as IProductVariant[];
            console.log(`     * Number of Variants:       ${variants.length}`);
            console.log('\n     * Variant Stock Breakdown:');
            console.log('       -----------------------------------------------------------------');
            console.log('       # | Variant SKU         | Size | Color          | Stock | Variant ID');
            console.log('       -----------------------------------------------------------------');

            let computedVariantSum = 0;
            let hasInvalidVariantStock = false;
            let invalidVariantCount = 0;

            variants.forEach((v, idx) => {
              const rawStock: unknown = v.stock;
              const isVStockValid = isValidStockNumber(rawStock);

              let stockCol: string;
              if (isVStockValid) {
                computedVariantSum += rawStock;
                stockCol = String(rawStock).padStart(5, ' ');
              } else {
                hasInvalidVariantStock = true;
                invalidVariantCount++;
                stockCol = 'INVALID'.padStart(7, ' ');
              }

              const vIdStr = v._id ? String(v._id).slice(-8) : 'no-id';
              const numCol = String(idx + 1).padStart(2, ' ');
              const skuCol = (v.sku || 'NO-SKU').padEnd(19, ' ');
              const sizeCol = (v.size || '-').padEnd(4, ' ');
              const colorCol = (v.color || '-').padEnd(14, ' ');
              console.log(`       ${numCol} | ${skuCol} | ${sizeCol} | ${colorCol} | ${stockCol} | ...${vIdStr}`);
            });
            console.log('       -----------------------------------------------------------------');

            if (!isParentStockValid) {
              summary.productStockConsistency = 'FAIL';
              console.log(
                `     * Consistency Status:       FAIL (Invalid parent stock: ${formatInvalidStockValue(parentStockRaw)}. Must be a safe non-negative integer)`
              );
            } else if (hasInvalidVariantStock) {
              summary.productStockConsistency = 'FAIL';
              console.log(
                `     * Consistency Status:       FAIL (Invalid stock on ${invalidVariantCount} variant(s). All stock values must be safe non-negative integers)`
              );
            } else if (!Number.isSafeInteger(computedVariantSum)) {
              summary.productStockConsistency = 'FAIL';
              console.log(
                '     * Consistency Status:       FAIL (Aggregate variant stock sum exceeds JavaScript safe integer range; consistency cannot be verified)'
              );
            } else {
              console.log(`     * Computed Sum of Variants: ${computedVariantSum}`);
              console.log(`     * Parent Stock Value:       ${parentStockRaw}`);
              const diff = parentStockRaw - computedVariantSum;
              if (diff === 0) {
                summary.productStockConsistency = 'PASS';
                console.log('     * Consistency Status:       PASS (Parent stock exactly matches sum of variant stocks)');
              } else {
                summary.productStockConsistency = 'FAIL';
                console.log(
                  `     * Consistency Status:       FAIL (Discrepancy: ${diff > 0 ? '+' + diff : diff}. Parent stock does NOT equal variant sum)`
                );
              }
            }
          } else {
            console.log('     * Simple Product Note:      Variant aggregation does not apply to simple products.');
            if (isParentStockValid) {
              summary.productStockConsistency = 'PASS';
              console.log(`     * Consistency Status:       PASS (Valid non-negative scalar stock: ${parentStockRaw})`);
            } else {
              summary.productStockConsistency = 'FAIL';
              console.log(
                `     * Consistency Status:       FAIL (Invalid parent stock: ${formatInvalidStockValue(parentStockRaw)}. Must be a safe non-negative integer)`
              );
            }
          }
        }
      }
    } catch {
      fatalErrorOccurred = true;
      console.error('\n   [FATAL DIAGNOSTIC EXCEPTION]: Category=RUNTIME_EXCEPTION - An unexpected error interrupted the diagnostic.');
    } finally {
      if (connectionEstablished || mongoose.connection.readyState !== 0) {
        try {
          await disconnectFromDatabase();
          console.log('\n6. TEARDOWN & AUDIT CONFIRMATION:');
          console.log('   - Database connection closed cleanly via disconnectFromDatabase().');
        } catch {
          fatalErrorOccurred = true;
          console.error('\n6. TEARDOWN & AUDIT CONFIRMATION:');
          console.error('   - [TEARDOWN ERROR]: Category=TEARDOWN_ERROR - Unable to close database connection cleanly.');
        }
      }
    }
  }

  const diffHr = process.hrtime(hrStart);
  const durationMs = (diffHr[0] * 1000 + diffHr[1] / 1e6).toFixed(2);
  console.log(`\n   - Execution Duration:         ${durationMs}ms`);

  const hasFatalFailure =
    fatalErrorOccurred ||
    summary.connection === 'FAIL' ||
    summary.topologyBaseline === 'FAIL' ||
    summary.applicationDetector === 'FAIL' ||
    summary.productStockConsistency === 'FAIL' ||
    summary.productStockConsistency === 'QUERY ERROR';

  summary.overallSuccess =
    !hasFatalFailure &&
    summary.environmentConfig === 'PASS' &&
    summary.connection === 'PASS' &&
    summary.topologyBaseline === 'PASS' &&
    summary.applicationDetector === 'PASS' &&
    summary.productStockConsistency === 'PASS';

  if (summary.overallSuccess) {
    summary.overallStatus = 'PASS';
  } else if (summary.environmentConfig === 'NOT CONFIGURED') {
    summary.overallStatus = 'NOT CONFIGURED';
  } else if (fatalErrorOccurred || summary.connection === 'FAIL' || summary.topologyBaseline === 'FAIL' || summary.applicationDetector === 'FAIL' || summary.productStockConsistency === 'FAIL') {
    summary.overallStatus = 'FAIL';
  } else if (summary.productStockConsistency === 'QUERY ERROR') {
    summary.overallStatus = 'QUERY ERROR';
  } else {
    summary.overallStatus = 'NOT VERIFIED';
  }

  printFinalSummary(summary);
  return summary;
}

function printFinalSummary(summary: DiagnosticSummary): void {
  console.log('\n================================================================================');
  console.log('FINAL EXECUTION SUMMARY:');
  console.log(`   - Environment Configuration:        ${summary.environmentConfig}`);
  console.log(`   - Connection Reachability:          ${summary.connection}`);
  console.log(`   - Topology Capability Baseline:     ${summary.topologyBaseline}`);
  console.log(`   - Application Detector Result:      ${summary.applicationDetector}`);
  console.log(`   - Product Stock Consistency:        ${summary.productStockConsistency}`);
  console.log(`   - Database Mutations Performed:     0 (STRICT READ-ONLY: ZERO writes)`);
  console.log(`   - Overall Diagnostic Outcome:       ${summary.overallStatus}`);
  console.log('================================================================================');
}

// Standalone execution wrapper with safe process exit code assignment
if (require.main === module) {
  runAtlasDiagnostic()
    .then((summary) => {
      process.exitCode = summary.overallSuccess ? 0 : 1;
    })
    .catch(() => {
      console.error('[FATAL DIAGNOSTIC FAILURE]: Category=UNHANDLED_EXCEPTION - Diagnostic terminated unexpectedly.');
      process.exitCode = 1;
    });
}
