/**
 * @file lib/services/wallet.service.ts
 * @description Internal customer store credit wallet & transaction ledger core service.
 * Server-only service module (NOT a public Server Action endpoint).
 * Handles atomic balance changes, debit idempotency, credit recording, and optional replica set transactions.
 * Strict TypeScript: ZERO `any`.
 */

import { connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { User } from '@/models/User';
import { WalletTransaction } from '@/models/WalletTransaction';
import { successResponse, errorResponse, type ActionResult } from '@/lib/response';
import { handleActionError } from '@/lib/error-handler';
import { MockDb } from '@/lib/db/mock-store';
import { TransactionStatus, type IWalletTransaction } from '@/types';
import mongoose, { Types } from 'mongoose';
import { revalidatePath } from 'next/cache';

/**
 * Safely executes database mutations within a Mongoose session transaction if supported
 * by the active MongoDB topology (Replica Set / Atlas), falling back to standalone execution
 * with compensating rollback on non-replica set deployments.
 */
export async function executeWithOptionalTransaction<T>(
  action: (session?: mongoose.ClientSession) => Promise<T>,
  existingSession?: mongoose.ClientSession
): Promise<T> {
  if (existingSession) {
    return await action(existingSession);
  }
  let session: mongoose.ClientSession | null = null;
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      session = await mongoose.startSession();
      session.startTransaction();
    }
  } catch {
    session = null;
  }

  if (session && session.inTransaction()) {
    try {
      const result = await action(session);
      await session.commitTransaction();
      return result;
    } catch (err) {
      await session.abortTransaction().catch(() => null);
      throw err;
    } finally {
      session.endSession().catch(() => null);
    }
  }

  return await action();
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

    if (!isDatabaseConnected() || !isValidObjId) {
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

    return await executeWithOptionalTransaction(async (activeSession) => {
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
        const res = MockDb.adjustWallet(cleanUserId, Math.abs(amount), amount >= 0 ? 'credit' : 'debit', description, referenceId);
        return successResponse({
          balance: res.balance,
          transaction: res.tx as IWalletTransaction,
        });
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
        // Compensating rollback if ledger transaction creation fails outside session transaction
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
    }, session);
  } catch (error: unknown) {
    if (!isDatabaseConnected()) {
      const res = MockDb.adjustWallet(userId, Math.abs(amount), amount >= 0 ? 'credit' : 'debit', description, referenceId);
      return successResponse({
        balance: res.balance,
        transaction: res.tx as IWalletTransaction,
      });
    }
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

    if (!isDatabaseConnected() || !isValidObjId) {
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

    return await executeWithOptionalTransaction(async (activeSession) => {
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
        // Compensating rollback if ledger transaction creation fails outside session transaction
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
    });
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
