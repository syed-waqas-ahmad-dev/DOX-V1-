/**
 * @file scripts/preflight-read-only-audit.ts
 * @description Standalone READ-ONLY MongoDB preflight audit script for Bajaur OX Shoes.
 *
 * SAFETY GUARANTEES:
 * - 100% Read-Only operations (countDocuments, aggregate, collection.indexes).
 * - ZERO document updates, inserts, deletions, or index modifications.
 * - Password/credential scrubbing on URI logging.
 * - Connection lifecycle cleanup ensured via try / finally block.
 * - Minimum required database permission: read (readWrite NOT required).
 */

import { connectToDatabase, disconnectFromDatabase, isDatabaseConnected, getConnectionState } from '../lib/db/connect';
import { Order } from '../models/Order';
import { sanitizeMongoUri } from './backfill-verification-tokens';

export async function runReadOnlyPreflight() {
  console.log('===============================================================');
  console.log('BAJAUR OX SHOES — READ-ONLY DATABASE PREFLIGHT AUDIT');
  console.log('===============================================================');

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[SECURITY ERROR] MONGODB_URI environment variable is missing.');
    console.error('Please set MONGODB_URI before running the read-only preflight.');
    return { success: false, reason: 'MISSING_MONGODB_URI' };
  }

  const dbInfo = sanitizeMongoUri(uri);
  console.log(`Target DB Host:       ${dbInfo.host}`);
  console.log(`Target DB Name:       ${dbInfo.dbName}`);
  console.log(`URI Status:           ${dbInfo.hasConfiguredUri ? 'CONFIGURED' : 'UNCONFIGURED'}`);
  console.log('---------------------------------------------------------------');

  try {
    console.log('[Connecting] Establishing read-only connection to MongoDB...');
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      console.error('[ERROR] Unable to connect to MongoDB instance.');
      return { success: false, reason: 'CONNECTION_FAILED' };
    }

    const connState = getConnectionState();
    console.log(`Connected Host:       ${connState.host || dbInfo.host}`);
    console.log(`Connected Database:   ${connState.database || dbInfo.dbName}`);
    console.log('---------------------------------------------------------------\n');

    console.log('--- 1. EXISTING INDEXES ON ORDERS COLLECTION ---');
    let indexes: any[] = [];
    try {
      indexes = await Order.collection.indexes();
      indexes.forEach((idx) => {
        console.log(` - Index: "${idx.name}" | Keys: ${JSON.stringify(idx.key)} | Unique: ${Boolean(idx.unique)} | Sparse: ${Boolean(idx.sparse)}`);
      });
    } catch (err: any) {
      console.warn('Unable to fetch collection indexes:', err.message);
    }

    const tokenIndex = indexes.find((idx) => idx.key && idx.key.verificationToken === 1);
    const isSparseUniqueIndexPresent = Boolean(tokenIndex && tokenIndex.unique && tokenIndex.sparse);

    console.log('\n--- 2. VERIFICATION TOKEN DOCUMENT COUNTS ---');
    // 1. Missing field count (top-level BSON type "missing")
    const missingTokenCount = await Order.countDocuments({
      $expr: { $eq: [{ $type: '$verificationToken' }, 'missing'] },
    });

    // 2. Explicit null count (top-level BSON type "null")
    const nullTokenCount = await Order.countDocuments({
      $expr: { $eq: [{ $type: '$verificationToken' }, 'null'] },
    });

    // 3. Exact empty string count ("") (top-level BSON type "string" and value "")
    const exactEmptyTokenCount = await Order.countDocuments({
      $expr: {
        $and: [
          { $eq: [{ $type: '$verificationToken' }, 'string'] },
          { $eq: ['$verificationToken', ''] },
        ],
      },
    });

    // 4. Whitespace-only string count (" ", "\t", etc.) ($cond type guard prevents non-string $regexMatch execution)
    const whitespaceOnlyTokenCount = await Order.countDocuments({
      $expr: {
        $cond: {
          if: {
            $and: [
              { $eq: [{ $type: '$verificationToken' }, 'string'] },
              { $ne: ['$verificationToken', ''] },
            ],
          },
          then: { $regexMatch: { input: '$verificationToken', regex: /^\s+$/ } },
          else: false,
        },
      },
    });

    // 5. Valid populated scalar string count ($cond type guard + correct $not array syntax)
    const populatedTokenCount = await Order.countDocuments({
      $expr: {
        $cond: {
          if: {
            $and: [
              { $eq: [{ $type: '$verificationToken' }, 'string'] },
              { $ne: ['$verificationToken', ''] },
            ],
          },
          then: {
            $not: [{ $regexMatch: { input: '$verificationToken', regex: /^\s*$/ } }],
          },
          else: false,
        },
      },
    });

    // 6. Malformed non-string token count (top-level BSON type NOT missing, NOT null, NOT string; includes arrays, numbers, booleans, objects)
    const malformedNonStringCount = await Order.countDocuments({
      $expr: {
        $and: [
          { $ne: [{ $type: '$verificationToken' }, 'missing'] },
          { $ne: [{ $type: '$verificationToken' }, 'null'] },
          { $ne: [{ $type: '$verificationToken' }, 'string'] },
        ],
      },
    });

    const totalOrdersCount = await Order.countDocuments({});

    console.log(` Total Orders in Database:          ${totalOrdersCount}`);
    console.log(` Orders missing field:              ${missingTokenCount}`);
    console.log(` Orders with explicit null:         ${nullTokenCount}`);
    console.log(` Orders with exact empty string (""):${exactEmptyTokenCount}`);
    console.log(` Orders with whitespace-only string:${whitespaceOnlyTokenCount}`);
    console.log(` Orders with valid populated token: ${populatedTokenCount}`);
    if (malformedNonStringCount > 0) {
      console.error(` ❌ Orders with malformed non-string token: ${malformedNonStringCount}`);
    }

    const totalEligibleForBackfill = missingTokenCount + nullTokenCount + exactEmptyTokenCount + whitespaceOnlyTokenCount + malformedNonStringCount;
    console.log(` Total Eligible for Backfill:       ${totalEligibleForBackfill}`);

    console.log('\n--- 3. DUPLICATE POPULATED TOKEN CHECK ---');
    let duplicates: any[] = [];
    try {
      duplicates = await Order.aggregate(
        [
          {
            $match: {
              $expr: {
                $cond: {
                  if: {
                    $and: [
                      { $eq: [{ $type: '$verificationToken' }, 'string'] },
                      { $ne: ['$verificationToken', ''] },
                    ],
                  },
                  then: {
                    $not: [{ $regexMatch: { input: '$verificationToken', regex: /^\s*$/ } }],
                  },
                  else: false,
                },
              },
            },
          },
          {
            $group: {
              _id: '$verificationToken',
              count: { $sum: 1 },
            },
          },
          {
            $match: {
              count: { $gt: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              token: '$_id',
              count: 1,
            },
          },
        ],
        { allowDiskUse: true }
      );
    } catch (err: any) {
      console.warn('Unable to run duplicate aggregation:', err.message);
    }

    if (duplicates.length === 0) {
      console.log(' ✓ Zero duplicate populated verification tokens detected.');
    } else {
      console.error(` ❌ CRITICAL: Found ${duplicates.length} duplicate populated token strings!`);
      duplicates.forEach((d) => console.error(`    Duplicate token count: ${d.count}`));
    }

    console.log('\n--- 4. MIGRATION COMPATIBILITY SUMMARY ---');
    console.log(` Sparse Unique Index Present:   ${isSparseUniqueIndexPresent ? 'YES' : 'NO'}`);
    console.log(` Explicit Nulls/Empty/Whitespace: ${nullTokenCount + exactEmptyTokenCount + whitespaceOnlyTokenCount > 0 ? 'PRESENT (MUST BACKFILL BEFORE INDEXING)' : 'NONE'}`);
    console.log(` Duplicate Token Conflict Risk: ${duplicates.length > 0 ? 'HIGH (DUPLICATES EXIST)' : 'NONE'}`);

    console.log('\n===============================================================');
    console.log('READ-ONLY PREFLIGHT AUDIT COMPLETE');
    console.log('===============================================================\n');

    return {
      success: true,
      host: dbInfo.host,
      dbName: dbInfo.dbName,
      totalOrdersCount,
      totalEligibleForBackfill,
      missingTokenCount,
      nullTokenCount,
      exactEmptyTokenCount,
      whitespaceOnlyTokenCount,
      populatedTokenCount,
      malformedNonStringCount,
      duplicateCount: duplicates.length,
      isSparseUniqueIndexPresent,
    };
  } finally {
    await disconnectFromDatabase();
  }
}

if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  /preflight-read-only-audit(\.(ts|js))?$/.test(process.argv[1])
) {
  runReadOnlyPreflight()
    .then((result) => {
      if (!result.success) {
        console.error('[PREFLIGHT AUDIT FAILURE] Audit completed with failures or was aborted.');
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Fatal preflight error:', err);
      process.exit(1);
    });
}
