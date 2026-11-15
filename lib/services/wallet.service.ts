/**
 * @file lib/services/wallet.service.ts
 * @description Internal customer store credit wallet & transaction ledger core service.
 * Server-only service module (NOT a public Server Action endpoint).
 * Handles atomic balance changes, debit idempotency, credit recording, and optional replica set transactions.
 * Strict TypeScript: ZERO `any`.
 */

import { canUseMockDatabase, connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { User } from '@/models/User';
import { WalletTransaction } from '@/models/WalletTransaction';
import { successResponse, errorResponse, type ActionResult } from '@/lib/response';
import { handleActionError } from '@/lib/error-handler';
import { MockDb } from '@/lib/db/mock-store';
import { TransactionStatus, type IWalletTransaction } from '@/types';
import mongoose, { Types } from 'mongoose';
import { revalidatePath } from 'next/cache';

export class TransactionUnavailableError extends Error {
  public readonly topologyType: string;
  public readonly reason: string;

  constructor(message: string, topologyType: string, reason: string) {
    super(message);
    this.name = 'TransactionUnavailableError';
    this.topologyType = topologyType;
    this.reason = reason;
  }
}

export interface MongoTransactionSupportStatus {
  supported: boolean;
  topologyType: string;
  reason?:
    | 'NOT_CONNECTED'
    | 'STANDALONE'
    | 'REPLICA_SET_NO_PRIMARY'
    | 'NO_LOGICAL_SESSIONS'
    | 'UNKNOWN';
}

export interface ExecuteTransactionOptions {
  existingSession?: mongoose.ClientSession;
  /**
   * Multi-document operations (e.g., checkout order creation, multi-item restocking)
   * MUST fail closed when MongoDB does not support ACID transactions.
   * Only callers with proven compensating rollback and idempotency keys may opt in.
   */
  allowStandaloneFallback?: boolean;
  maxRetries?: number;
}

interface MongoTopologyDescriptionLike {
  type?: string;
  logicalSessionTimeoutMinutes?: number | null;
}

interface MongoClientLike {
  topology?: {
    description?: MongoTopologyDescriptionLike;
  };
}

interface HelloCommandResponse {
  setName?: string;
  msg?: string;
  isWritablePrimary?: boolean;
  ismaster?: boolean;
  logicalSessionTimeoutMinutes?: number | null;
}

interface MongoErrorLike {
  message?: string;
  code?: number;
  errorLabels?: unknown;
  hasErrorLabel?: (label: string) => boolean;
}

let cachedSingleTopologyResult: {
  clientRef: unknown;
  rawType: string;
  status: MongoTransactionSupportStatus;
} | null = null;

/**
 * Resets cached topology probe results (intended for unit/integration tests).
 */
export function resetTransactionTopologyCache(): void {
  cachedSingleTopologyResult = null;
}

function hasMongoErrorLabel(err: unknown, label: string): boolean {
  if (!err || typeof err !== 'object') return false;
  const candidate = err as MongoErrorLike;
  if (typeof candidate.hasErrorLabel === 'function') {
    try {
      if (candidate.hasErrorLabel(label)) return true;
    } catch {
      // Ignore non-standard error object implementations
    }
  }
  if (Array.isArray(candidate.errorLabels) && candidate.errorLabels.includes(label)) {
    return true;
  }
  return false;
}

export function isTransientTransactionError(err: unknown): boolean {
  return hasMongoErrorLabel(err, 'TransientTransactionError');
}

export function isUnknownCommitResultError(err: unknown): boolean {
  return hasMongoErrorLabel(err, 'UnknownTransactionCommitResult');
}

/**
 * Inspects actual MongoDB client topology and server capabilities (`hello` command for
 * Single/Unknown connections) rather than assuming `readyState === 1` implies ACID support.
 */
export async function detectMongoTransactionSupport(): Promise<MongoTransactionSupportStatus> {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    cachedSingleTopologyResult = null;
    return {
      supported: false,
      topologyType: 'Disconnected',
      reason: 'NOT_CONNECTED',
    };
  }

  const client =
    typeof mongoose.connection.getClient === 'function'
      ? (mongoose.connection.getClient() as unknown as MongoClientLike)
      : null;

  const description = client?.topology?.description;
  const rawType = description?.type || 'Unknown';

  if (
    rawType === 'ReplicaSetWithPrimary' ||
    rawType === 'Sharded' ||
    rawType === 'LoadBalanced'
  ) {
    if (description?.logicalSessionTimeoutMinutes === null) {
      return {
        supported: false,
        topologyType: rawType,
        reason: 'NO_LOGICAL_SESSIONS',
      };
    }
    return {
      supported: true,
      topologyType: rawType,
    };
  }

  if (rawType === 'ReplicaSetNoPrimary') {
    return {
      supported: false,
      topologyType: rawType,
      reason: 'REPLICA_SET_NO_PRIMARY',
    };
  }

  if (
    cachedSingleTopologyResult &&
    cachedSingleTopologyResult.clientRef === client &&
    cachedSingleTopologyResult.rawType === rawType
  ) {
    return cachedSingleTopologyResult.status;
  }

  let status: MongoTransactionSupportStatus = {
    supported: false,
    topologyType: rawType,
    reason: 'UNKNOWN',
  };

  try {
    const admin = mongoose.connection.db?.admin?.();
    if (admin && typeof admin.command === 'function') {
      const hello = (await admin.command({ hello: 1 })) as HelloCommandResponse;
      const isReplOrMongos = Boolean(hello?.setName || hello?.msg === 'isdbgrid');
      const hasLogicalSessions =
        hello?.logicalSessionTimeoutMinutes !== null &&
        hello?.logicalSessionTimeoutMinutes !== undefined;
      const isWritable = hello?.isWritablePrimary === true || hello?.ismaster === true || hello?.msg === 'isdbgrid';

      if (isReplOrMongos && hasLogicalSessions && isWritable) {
        status = {
          supported: true,
          topologyType: hello?.msg === 'isdbgrid' ? 'Sharded' : 'DirectReplicaSet',
        };
      } else if (!isReplOrMongos) {
        status = {
          supported: false,
          topologyType: 'Single',
          reason: 'STANDALONE',
        };
      } else if (!hasLogicalSessions) {
        status = {
          supported: false,
          topologyType: rawType,
          reason: 'NO_LOGICAL_SESSIONS',
        };
      } else {
        status = {
          supported: false,
          topologyType: rawType,
          reason: 'REPLICA_SET_NO_PRIMARY',
        };
      }
    }
  } catch {
    status = {
      supported: false,
      topologyType: rawType,
      reason: 'UNKNOWN',
    };
  }

  cachedSingleTopologyResult = {
    clientRef: client,
    rawType,
    status,
  };

  return status;
}

function isFailedActionResult(val: unknown): boolean {
  return (
    typeof val === 'object' &&
    val !== null &&
    'success' in val &&
    (val as { success?: unknown }).success === false
  );
}

/**
 * Executes database mutations inside a real MongoDB ACID transaction when supported.
 * - Verifies actual cluster topology before opening a transaction.
 * - Fails closed if topology is unsupported unless `allowStandaloneFallback` is explicitly enabled
 *   for proven-safe compensating single-entity operations.
 * - Retries ONLY on genuine MongoDB `TransientTransactionError` / `UnknownTransactionCommitResult`
 *   labels using a fresh session/transaction attempt on each retry.
 * - Never falls back to sessionless execution or MockDb after transaction startup or partial work.
 */
export async function executeWithOptionalTransaction<T>(
  action: (session?: mongoose.ClientSession) => Promise<T>,
  sessionOrOptions?: mongoose.ClientSession | ExecuteTransactionOptions
): Promise<T> {
  const isSessionArg =
    sessionOrOptions &&
    typeof (sessionOrOptions as mongoose.ClientSession).inTransaction === 'function';

  const options: ExecuteTransactionOptions = isSessionArg
    ? { existingSession: sessionOrOptions as mongoose.ClientSession }
    : ((sessionOrOptions as ExecuteTransactionOptions | undefined) ?? {});

  if (options.existingSession) {
    return await action(options.existingSession);
  }

  const topology = await detectMongoTransactionSupport();

  if (!topology.supported) {
    if (topology.reason === 'STANDALONE' && options.allowStandaloneFallback) {
      return await action(undefined);
    }

    throw new TransactionUnavailableError(
      `Multi-document MongoDB transaction unavailable (topology: ${topology.topologyType}, reason: ${topology.reason || 'UNSUPPORTED'}). A Replica Set, mongos, or MongoDB Atlas cluster is required.`,
      topology.topologyType,
      topology.reason || 'UNKNOWN'
    );
  }

  const maxAttempts = Math.max(1, options.maxRetries ?? 3);
  const maxCommitRetries = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let session: mongoose.ClientSession | null = null;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch (startupErr) {
      cachedSingleTopologyResult = null;
      if (session) {
        await session.endSession().catch(() => null);
      }
      throw startupErr;
    }

    try {
      const result = await action(session);

      if (isFailedActionResult(result)) {
        if (session.inTransaction()) {
          await session.abortTransaction().catch(() => null);
        }
        return result;
      }

      for (let commitAttempt = 1; commitAttempt <= maxCommitRetries; commitAttempt++) {
        try {
          await session.commitTransaction();
          return result;
        } catch (commitErr) {
          if (isUnknownCommitResultError(commitErr) && commitAttempt < maxCommitRetries) {
            continue;
          }
          throw commitErr;
        }
      }
    } catch (txErr) {
      if (session.inTransaction()) {
        await session.abortTransaction().catch(() => null);
      }

      if (isTransientTransactionError(txErr) && attempt < maxAttempts) {
        continue;
      }

      throw txErr;
    } finally {
      await session.endSession().catch(() => null);
    }
  }

  throw new Error('Transaction exceeded maximum retry attempts.');
}

/**
 * Internal service: Add credit to user's wallet and record in transaction ledger.
 * Validates target user ID, supports idempotency via referenceId, and applies atomic updates.
 */
export async function addCreditInternal(
  userId: string,
  amount: number,
  description: string,
  referenceId?: string,
  status: TransactionStatus = TransactionStatus.COMPLETED,
  session?: mongoose.ClientSession
): Promise<ActionResult<{ balance: number; transaction: IWalletTransaction }>> {
  try {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return errorResponse('Invalid user ID: identifier is required.');
    }
    const cleanUserId = userId.trim();

    if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
      return errorResponse('Invalid credit amount: amount must be a valid number.');
    }

    await connectToDatabase();

    const isValidObjId = Boolean(cleanUserId && Types.ObjectId.isValid(cleanUserId));

    if (!isDatabaseConnected()) {
      if (!canUseMockDatabase()) {
        return errorResponse('Database connection unavailable. Cannot adjust wallet balance.');
      }
      const res = MockDb.adjustWallet(cleanUserId, Math.abs(amount), amount >= 0 ? 'credit' : 'debit', description, referenceId);
      try {
        revalidatePath('/dashboard/referrals');
        revalidatePath('/admin');
      } catch {
        // Ignored during testing or background execution
      }
      return successResponse({
        balance: res.balance,
        transaction: res.tx as IWalletTransaction,
      });
    }

    if (!isValidObjId) {
      return errorResponse('Invalid user ID format.');
    }

    return await executeWithOptionalTransaction(
      async (activeSession) => {
        const currentSession = session || activeSession;

        // Idempotency check: if referenceId is provided, check for existing ledger entry
        if (referenceId) {
          const existingTx = await WalletTransaction.findOne({
            userId: new Types.ObjectId(cleanUserId),
            referenceId,
            type: amount >= 0 ? 'credit' : 'debit',
          }).session(currentSession || null);
          if (existingTx) {
            const user = await User.findById(cleanUserId).select('walletBalance').session(currentSession || null).lean();
            return successResponse({
              balance: user?.walletBalance || 0,
              transaction: JSON.parse(JSON.stringify(existingTx)),
            });
          }
        }

        const updatedUser = await User.findByIdAndUpdate(
          cleanUserId,
          { $inc: { walletBalance: amount } },
          { returnDocument: 'after', session: currentSession || undefined }
        );

        if (!updatedUser) {
          return errorResponse('User account not found.');
        }

        const newBalance = Math.max(0, updatedUser.walletBalance || 0);

        let transaction;
        try {
          const createdDocs = await WalletTransaction.create(
            [
              {
                userId: new Types.ObjectId(cleanUserId),
                amount: Math.abs(amount),
                type: amount >= 0 ? 'credit' : 'debit',
                description,
                referenceId: referenceId || undefined,
                balanceAfter: newBalance,
                status,
              },
            ],
            currentSession ? { session: currentSession } : {}
          );
          transaction = createdDocs[0];
        } catch (txErr) {
          // Compensating rollback if ledger transaction creation fails in explicit standalone mode
          if (!currentSession) {
            await User.findByIdAndUpdate(cleanUserId, { $inc: { walletBalance: -amount } });
          }
          throw txErr;
        }

        try {
          revalidatePath('/dashboard/referrals');
          revalidatePath('/admin');
        } catch {
          // Ignored during testing or background execution
        }

        return successResponse({
          balance: newBalance,
          transaction: JSON.parse(JSON.stringify(transaction)),
        });
      },
      { existingSession: session, allowStandaloneFallback: true }
    );
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

/**
 * Internal service: Deduct credit from user's wallet atomically on checkout.
 * Validates balance sufficiency with $gte condition and provides debit idempotency.
 */
export async function deductCreditInternal(
  userId: string,
  amount: number,
  description: string,
  referenceId?: string,
  session?: mongoose.ClientSession
): Promise<ActionResult<{ balance: number; transaction: IWalletTransaction }>> {
  try {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return errorResponse('Invalid user ID: identifier is required.');
    }
    const cleanUserId = userId.trim();

    if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount) || amount <= 0) {
      return errorResponse('Deduct amount must be greater than zero.');
    }

    await connectToDatabase();

    const isValidObjId = Boolean(cleanUserId && Types.ObjectId.isValid(cleanUserId));

    if (!isDatabaseConnected()) {
      if (!canUseMockDatabase()) {
        return errorResponse('Database connection unavailable. Cannot deduct wallet balance.');
      }
      const current = MockDb.getWalletBalance(cleanUserId);
      if (current < amount) {
        return errorResponse(`Insufficient wallet balance. Available: PKR ${current}`);
      }
      const res = MockDb.adjustWallet(cleanUserId, amount, 'debit', description, referenceId);
      try {
        revalidatePath('/dashboard/referrals');
        revalidatePath('/admin');
      } catch {
        // Ignored during testing
      }
      return successResponse({
        balance: res.balance,
        transaction: res.tx as IWalletTransaction,
      });
    }

    if (!isValidObjId) {
      return errorResponse('Invalid user ID format.');
    }

    return await executeWithOptionalTransaction(
      async (activeSession) => {
        const currentSession = session || activeSession;

        // Debit Idempotency: prevent double-deduction on retries/concurrent requests with same referenceId
        if (referenceId) {
          const existingTx = await WalletTransaction.findOne({
            userId: new Types.ObjectId(cleanUserId),
            referenceId,
            type: 'debit',
          }).session(currentSession || null);
          if (existingTx) {
            const user = await User.findById(cleanUserId).select('walletBalance').session(currentSession || null).lean();
            return successResponse({
              balance: user?.walletBalance || 0,
              transaction: JSON.parse(JSON.stringify(existingTx)),
            });
          }
        }

        // Atomic Balance Deduction: Update only if walletBalance is sufficient ($gte: amount)
        const updatedUser = await User.findOneAndUpdate(
          { _id: new Types.ObjectId(cleanUserId), walletBalance: { $gte: amount } },
          { $inc: { walletBalance: -amount } },
          { returnDocument: 'after', session: currentSession || undefined }
        );

        if (!updatedUser) {
          const userCheck = await User.findById(cleanUserId).select('walletBalance').session(currentSession || null).lean();
          if (!userCheck) {
            return errorResponse('User account not found.');
          }
          const currentBal = userCheck.walletBalance || 0;
          return errorResponse(`Insufficient wallet balance. Available: PKR ${currentBal}`);
        }

        const newBalance = Math.max(0, updatedUser.walletBalance || 0);

        let transaction;
        try {
          const createdDocs = await WalletTransaction.create(
            [
              {
                userId: new Types.ObjectId(cleanUserId),
                amount,
                type: 'debit',
                description,
                referenceId: referenceId || undefined,
                balanceAfter: newBalance,
              },
            ],
            currentSession ? { session: currentSession } : {}
          );
          transaction = createdDocs[0];
        } catch (txErr) {
          // Compensating rollback if ledger transaction creation fails in explicit standalone mode
          if (!currentSession) {
            await User.findByIdAndUpdate(cleanUserId, { $inc: { walletBalance: amount } });
          }
          throw txErr;
        }

        try {
          revalidatePath('/dashboard/referrals');
          revalidatePath('/admin');
        } catch {
          // Ignored during testing
        }

        return successResponse({
          balance: newBalance,
          transaction: JSON.parse(JSON.stringify(transaction)),
        });
      },
      { existingSession: session, allowStandaloneFallback: true }
    );
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
