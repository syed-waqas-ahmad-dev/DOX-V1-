/**
 * @file scripts/backfill-verification-tokens.ts
 * @description Production-hardened migration script to backfill cryptographically random
 * verification tokens for legacy orders in MongoDB.
 *
 * SAFETY FEATURES:
 * - Default Dry-Run mode (zero DB mutations without explicit --confirm)
 * - Missing MONGODB_URI explicitly rejects write mode (no silent localhost default for writes)
 * - Exact target host (--target-host=<hostname>) AND case-sensitive database name (--target-db=<dbname>) required
 * - Mismatched, unparseable, or partial host/database matches strictly abort before execution
 * - Mandatory --confirm-production confirmation required for ALL write operations
 * - Sanitized target logging (zero credential / URI leakage)
 * - Keyset pagination via deterministic _id sorting (prevents cursor index-mutation skips)
 * - Conditional atomic updates (concurrency & overwrite protection)
 * - Accurate exit status: failed updates trigger success: false & non-zero process exit code
 */

import { connectToDatabase, isDatabaseConnected } from '../lib/db/connect';
import { Order } from '../models/Order';
import { generateVerificationToken } from '../lib/invoice';

export interface BackfillOptions {
  args?: string[];
  uriOverride?: string;
  isTestMode?: boolean;
}

export interface SanitizedDbInfo {
  host: string;
  dbName: string;
  sanitizedUri: string;
  isProduction: boolean;
  isParseable: boolean;
  isFallbackUri: boolean;
  hasConfiguredUri: boolean;
}

/**
 * Sanitizes MongoDB URI and detects production targets safely.
 */
export function sanitizeMongoUri(rawUri?: string): SanitizedDbInfo {
  const envUri = process.env.MONGODB_URI?.trim();
  const hasConfiguredUri = Boolean(rawUri || envUri);
  const uri = rawUri || envUri || 'mongodb://localhost:27017/oxshoes_dev';
  const isFallbackUri = !hasConfiguredUri;

  let host = 'unknown-host';
  let dbName = 'unknown-db';
  let isProduction = false;
  let isParseable = false;

  try {
    const cleanedUri = uri.replace(/^mongodb\+srv:\/\//, 'http://').replace(/^mongodb:\/\//, 'http://');
    const parsed = new URL(cleanedUri);
    if (parsed.hostname) {
      host = parsed.hostname + (parsed.port ? `:${parsed.port}` : '');
      const rawPath = parsed.pathname.replace(/^\//, '');
      dbName = rawPath.split('?')[0] || 'oxshoes';
      if (host !== 'unknown-host' && dbName !== 'unknown-db' && dbName.length > 0) {
        isParseable = true;
      }
    }
  } catch {
    const match = uri.match(/@([^/]+)\/([^?]+)/);
    if (match) {
      host = match[1];
      dbName = match[2];
      isParseable = true;
    }
  }

  const lowerHost = host.toLowerCase();
  const lowerDb = dbName.toLowerCase();
  const lowerEnv = (process.env.NODE_ENV || '').toLowerCase();

  const isLocalhost =
    lowerHost === 'localhost' ||
    lowerHost === '127.0.0.1' ||
    lowerHost.startsWith('localhost:') ||
    lowerHost.startsWith('127.0.0.1:');

  const isProdHost =
    lowerHost.includes('mongodb.net') ||
    lowerHost.includes('cloud.mongodb.com') ||
    lowerHost.includes('prod');
  const isProdDb = lowerDb.includes('prod') || lowerDb.includes('production');
  const isProdEnv = lowerEnv === 'production';

  isProduction = isProdHost || isProdDb || isProdEnv || !isLocalhost;

  const sanitizedUri = uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');

  return {
    host,
    dbName,
    sanitizedUri,
    isProduction,
    isParseable,
    isFallbackUri,
    hasConfiguredUri,
  };
}

/**
 * Parses command-line arguments safely.
 */
export function parseCliArgs(args: string[]) {
  const isExplicitDryRun = args.includes('--dry-run');
  const isConfirmed = args.includes('--confirm');
  const isProdConfirmed = args.includes('--confirm-production');

  let targetDb: string | undefined = undefined;
  const targetDbArg = args.find((a) => a.startsWith('--target-db='));
  if (targetDbArg) {
    targetDb = targetDbArg.split('=')[1]?.trim();
  }

  let targetHost: string | undefined = undefined;
  const targetHostArg = args.find((a) => a.startsWith('--target-host='));
  if (targetHostArg) {
    targetHost = targetHostArg.split('=')[1]?.trim();
  }

  let batchSize = 100;
  const batchArg = args.find((a) => a.startsWith('--batch-size='));
  if (batchArg) {
    const val = parseInt(batchArg.split('=')[1], 10);
    if (!isNaN(val) && val > 0) {
      batchSize = val;
    }
  }

  // Default behavior is dry-run unless --confirm is explicitly provided
  const isDryRun = isExplicitDryRun || !isConfirmed;

  return {
    isDryRun,
    isConfirmed,
    isProdConfirmed,
    targetDb,
    targetHost,
    batchSize,
  };
}

/**
 * Main backfill execution function.
 */
export async function runBackfill(options: BackfillOptions = {}) {
  const args = options.args || process.argv.slice(2);
  const cli = parseCliArgs(args);
  const dbInfo = sanitizeMongoUri(options.uriOverride);

  console.log('===============================================================');
  console.log('BAJAUR OX SHOES — SAFE VERIFICATION TOKEN BACKFILL');
  console.log('===============================================================');
  console.log(`URI Source:           ${dbInfo.isFallbackUri ? 'UNCONFIGURED FALLBACK (localhost)' : 'CONFIGURED MONGODB_URI'}`);
  console.log(`Target DB Host:       ${dbInfo.host}`);
  console.log(`Target DB Name:       ${dbInfo.dbName}`);
  console.log(`Target Environment:   ${dbInfo.isProduction ? 'PRODUCTION / CLOUD / NON-LOCAL (HIGH SECURITY)' : 'LOCAL DEVELOPMENT'}`);
  console.log(`Batch Size:           ${cli.batchSize}`);
  console.log(`Mode:                 ${cli.isDryRun ? 'DRY-RUN (NO MUTATIONS)' : 'CONFIRMED WRITE MODE'}`);
  if (cli.targetHost) {
    console.log(`Expected Target Host: ${cli.targetHost}`);
  }
  if (cli.targetDb) {
    console.log(`Expected Target DB:   ${cli.targetDb}`);
  }
  console.log('---------------------------------------------------------------');

  // Guard 1: Dry-Run Notice
  if (!cli.isConfirmed) {
    console.log('\n[NOTICE] Running in DRY-RUN mode because --confirm was not specified.');
    console.log('To execute write mutations, re-run with:');
    console.log(
      `  MONGODB_URI=<uri> npx tsx scripts/backfill-verification-tokens.ts --confirm --target-host=${dbInfo.host} --target-db=${dbInfo.dbName} --confirm-production\n`
    );
  } else {
    // Guard 2: Reject write mode if MONGODB_URI is not explicitly configured
    if (!dbInfo.hasConfiguredUri) {
      console.error('\n[SECURITY ERROR] Confirmed write execution requires an explicitly configured MONGODB_URI.');
      console.error('The default localhost fallback is NOT permitted for write operations.');
      console.error('Please set process.env.MONGODB_URI before running in write mode.');
      console.error('Aborting backfill. Zero database mutations were performed.\n');
      return {
        success: false,
        aborted: true,
        reason: 'MISSING_MONGODB_URI',
        scannedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        failedCount: 0,
      };
    }

    // Guard 3: Missing --target-host or --target-db flag for write execution
    if (!cli.targetHost) {
      console.error('\n[SECURITY ERROR] Write execution (--confirm) requires an explicit target hostname.');
      console.error(`Please provide: --target-host=${dbInfo.host || '<expected_hostname>'}`);
      console.error('Aborting backfill. Zero database mutations were performed.\n');
      return {
        success: false,
        aborted: true,
        reason: 'MISSING_TARGET_HOST_FLAG',
        scannedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        failedCount: 0,
      };
    }

    if (!cli.targetDb) {
      console.error('\n[SECURITY ERROR] Write execution (--confirm) requires an explicit target database name.');
      console.error(`Please provide: --target-db=${dbInfo.dbName || '<expected_db_name>'}`);
      console.error('Aborting backfill. Zero database mutations were performed.\n');
      return {
        success: false,
        aborted: true,
        reason: 'MISSING_TARGET_DB_FLAG',
        scannedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        failedCount: 0,
      };
    }

    // Guard 4: Target Host/DB Mismatch or Unparseable URI
    if (!dbInfo.isParseable || dbInfo.dbName === 'unknown-db' || dbInfo.host === 'unknown-host') {
      console.error('\n[SECURITY ERROR] Target MongoDB URI could not be parsed reliably.');
      console.error('Aborting backfill. Zero database mutations were performed.\n');
      return {
        success: false,
        aborted: true,
        reason: 'UNPARSEABLE_URI',
        scannedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        failedCount: 0,
      };
    }

    if (cli.targetHost.toLowerCase() !== dbInfo.host.toLowerCase()) {
      console.error('\n[SECURITY ERROR] Target database host mismatch!');
      console.error(`  Expected target host: "${cli.targetHost}"`);
      console.error(`  Actual URI host:        "${dbInfo.host}"`);
      console.error('Aborting backfill. Zero database mutations were performed.\n');
      return {
        success: false,
        aborted: true,
        reason: 'TARGET_HOST_MISMATCH',
        scannedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        failedCount: 0,
      };
    }

    // Exact case-sensitive database name comparison
    if (cli.targetDb !== dbInfo.dbName) {
      console.error('\n[SECURITY ERROR] Target database name mismatch!');
      console.error(`  Expected target DB: "${cli.targetDb}"`);
      console.error(`  Actual URI target DB: "${dbInfo.dbName}"`);
      console.error('Aborting backfill. Zero database mutations were performed.\n');
      return {
        success: false,
        aborted: true,
        reason: 'TARGET_DB_MISMATCH',
        scannedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        failedCount: 0,
      };
    }

    // Guard 5: Require --confirm-production for ALL write operations (including localhost)
    if (!cli.isProdConfirmed) {
      console.error('\n[SECURITY ERROR] Write operations strictly require production confirmation flag!');
      console.error('To execute write mutations, ALL required flags must be provided:');
      console.error(`  --confirm --target-host=${dbInfo.host} --target-db=${dbInfo.dbName} --confirm-production`);
      console.error('Aborting backfill. Zero database mutations were performed.\n');
      return {
        success: false,
        aborted: true,
        reason: 'MISSING_PROD_CONFIRMATION',
        scannedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        failedCount: 0,
      };
    }
  }

  if (options.isTestMode) {
    console.log('[TEST MODE] Skipping live DB connection.');
    return {
      success: true,
      aborted: false,
      isDryRun: cli.isDryRun,
      isProduction: dbInfo.isProduction,
      scannedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
    };
  }

  await connectToDatabase();

  if (!isDatabaseConnected()) {
    console.log('Database not connected. Aborting backfill.');
    return { success: false, aborted: true, reason: 'NO_DB_CONNECTION' };
  }

  let scannedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let batchIndex = 0;
  let lastError: string | null = null;

  // Keyset pagination using deterministic _id ordering
  let lastId: any = null;
  let hasMore = true;

  while (hasMore) {
    const queryFilter: any = {
      $or: [
        { verificationToken: { $exists: false } },
        { verificationToken: null },
        { verificationToken: '' },
      ],
    };

    if (lastId) {
      queryFilter._id = { $gt: lastId };
    }

    const batch = await Order.find(queryFilter)
      .select('_id verificationToken')
      .sort({ _id: 1 })
      .limit(cli.batchSize);

    if (batch.length === 0) {
      hasMore = false;
      break;
    }

    for (const order of batch) {
      scannedCount++;
      lastId = order._id;

      if (cli.isDryRun) {
        // Dry-run: count only
        updatedCount++;
      } else {
        // Write mode: Atomic conditional update
        try {
          const newToken = generateVerificationToken();
          const updateResult = await Order.updateOne(
            {
              _id: order._id,
              $or: [
                { verificationToken: { $exists: false } },
                { verificationToken: null },
                { verificationToken: '' },
              ],
            },
            {
              $set: { verificationToken: newToken },
            }
          );

          if (updateResult.modifiedCount === 1) {
            updatedCount++;
          } else {
            // Token assigned concurrently by another process
            skippedCount++;
          }
        } catch (err: any) {
          failedCount++;
          if (!lastError) {
            lastError = err.message || 'Unknown database update error';
          }
        }
      }
    }

    batchIndex++;
    console.log(
      `[Batch ${batchIndex}] Processed ${scannedCount} legacy orders... (${
        cli.isDryRun ? 'Would update' : 'Updated'
      }: ${updatedCount}, Skipped: ${skippedCount}, Failed: ${failedCount})`
    );

    if (batch.length < cli.batchSize) {
      hasMore = false;
    }
  }

  const isOverallSuccess = failedCount === 0;

  console.log('\n===============================================================');
  console.log('MIGRATION SUMMARY');
  console.log('===============================================================');
  console.log(`Status:                       ${isOverallSuccess ? 'SUCCESS' : 'FAILED WITH ERRORS'}`);
  console.log(`Total Scanned Orders:         ${scannedCount}`);
  console.log(`${cli.isDryRun ? 'Orders Needing Backfill:' : 'Successfully Backfilled:'}      ${updatedCount}`);
  console.log(`Skipped / Concurrently Set:   ${skippedCount}`);
  console.log(`Failed / Update Errors:       ${failedCount}`);
  console.log(`Database Mutations Executed:   ${cli.isDryRun ? 0 : updatedCount}`);
  if (lastError) {
    console.error(`Last Error Message:          ${lastError}`);
  }
  console.log('===============================================================\n');

  return {
    success: isOverallSuccess,
    aborted: false,
    isDryRun: cli.isDryRun,
    isProduction: dbInfo.isProduction,
    scannedCount,
    updatedCount,
    skippedCount,
    failedCount,
    lastError,
  };
}

if (typeof process !== 'undefined' && process.argv[1]?.includes('backfill-verification-tokens')) {
  runBackfill()
    .then((result) => {
      if (!result.success) {
        console.error('[MIGRATION FAILURE] Migration completed with failures or was aborted.');
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Fatal migration error:', err);
      process.exit(1);
    });
}
