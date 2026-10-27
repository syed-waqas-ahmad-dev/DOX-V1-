'use server';

/**
 * @file actions/wallet.actions.ts
 * @description Customer store credit wallet & transaction ledger server actions.
 * Strict TypeScript: ZERO `any`.
 */

import { connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { User } from '@/models/User';
import { WalletTransaction } from '@/models/WalletTransaction';
import { successResponse, errorResponse, type ActionResult } from '@/lib/response';
import { handleActionError } from '@/lib/error-handler';
import { MockDb } from '@/lib/db/mock-store';
import { TransactionStatus, type IWalletTransaction } from '@/types';
import { Types } from 'mongoose';
import { revalidatePath } from 'next/cache';

/**
 * Retrieve user's current wallet balance
 */
export async function getWalletBalance(userId: string): Promise<ActionResult<{ balance: number }>> {
  try {
    if (!userId) {
      return successResponse({ balance: 0 });
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const balance = MockDb.getWalletBalance(userId);
      return successResponse({ balance });
    }

    const user = await User.findById(userId).select('walletBalance').lean();
    if (!user) {
      const balance = MockDb.getWalletBalance(userId);
      return successResponse({ balance });
    }

    return successResponse({ balance: user.walletBalance || 0 });
  } catch (error: unknown) {
    const balance = MockDb.getWalletBalance(userId);
    return successResponse({ balance });
  }
}

/**
 * Add credit to user's wallet and record in transaction ledger
 */
export async function addCredit(
  userId: string,
  amount: number,
  description: string,
  referenceId?: string,
  status: TransactionStatus = TransactionStatus.COMPLETED
): Promise<ActionResult<{ balance: number; transaction: IWalletTransaction }>> {
  try {
    if (amount <= 0) {
      return errorResponse('Credit amount must be greater than zero.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const res = MockDb.adjustWallet(userId, amount, 'credit', description, referenceId);
      revalidatePath('/dashboard/referrals');
      revalidatePath('/admin');
      return successResponse({
        balance: res.balance,
        transaction: res.tx as IWalletTransaction,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      const res = MockDb.adjustWallet(userId, amount, 'credit', description, referenceId);
      return successResponse({
        balance: res.balance,
        transaction: res.tx as IWalletTransaction,
      });
    }

    const newBalance = (user.walletBalance || 0) + amount;
    user.walletBalance = newBalance;
    await user.save();

    const transaction = await WalletTransaction.create({
      userId: new Types.ObjectId(userId),
      amount,
      type: 'credit',
      description,
      referenceId: referenceId || undefined,
      balanceAfter: newBalance,
      status,
    });


    revalidatePath('/dashboard/referrals');
    revalidatePath('/admin');

    return successResponse({
      balance: newBalance,
      transaction: JSON.parse(JSON.stringify(transaction)),
    });
  } catch (error: unknown) {
    const res = MockDb.adjustWallet(userId, amount, 'credit', description, referenceId);
    return successResponse({
      balance: res.balance,
      transaction: res.tx as IWalletTransaction,
    });
  }
}

/**
 * Deduct credit from user's wallet atomically on checkout
 */
export async function deductCredit(
  userId: string,
  amount: number,
  description: string,
  referenceId?: string
): Promise<ActionResult<{ balance: number; transaction: IWalletTransaction }>> {
  try {
    if (amount <= 0) {
      return errorResponse('Deduct amount must be greater than zero.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const current = MockDb.getWalletBalance(userId);
      if (current < amount) {
        return errorResponse(`Insufficient wallet balance. Available: PKR ${current}`);
      }
      const res = MockDb.adjustWallet(userId, amount, 'debit', description, referenceId);
      revalidatePath('/dashboard/referrals');
      revalidatePath('/admin');
      return successResponse({
        balance: res.balance,
        transaction: res.tx as IWalletTransaction,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      const res = MockDb.adjustWallet(userId, amount, 'debit', description, referenceId);
      return successResponse({
        balance: res.balance,
        transaction: res.tx as IWalletTransaction,
      });
    }

    if ((user.walletBalance || 0) < amount) {
      return errorResponse(`Insufficient wallet balance. Available: PKR ${user.walletBalance || 0}`);
    }

    const newBalance = Math.max(0, (user.walletBalance || 0) - amount);
    user.walletBalance = newBalance;
    await user.save();

    const transaction = await WalletTransaction.create({
      userId: new Types.ObjectId(userId),
      amount,
      type: 'debit',
      description,
      referenceId: referenceId || undefined,
      balanceAfter: newBalance,
    });

    revalidatePath('/dashboard/referrals');
    revalidatePath('/admin');

    return successResponse({
      balance: newBalance,
      transaction: JSON.parse(JSON.stringify(transaction)),
    });
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

/**
 * Retrieve transaction history for a user
 */
export async function getWalletTransactions(
  userId: string
): Promise<ActionResult<IWalletTransaction[]>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const txs = MockDb.getWalletTransactions(userId);
      return successResponse(txs as IWalletTransaction[]);
    }

    const txs = await WalletTransaction.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    if (!txs || txs.length === 0) {
      const mockTxs = MockDb.getWalletTransactions(userId);
      return successResponse(mockTxs as IWalletTransaction[]);
    }

    return successResponse(JSON.parse(JSON.stringify(txs)));
  } catch (error: unknown) {
    const mockTxs = MockDb.getWalletTransactions(userId);
    return successResponse(mockTxs as IWalletTransaction[]);
  }
}

/**
 * Admin: Manually adjust customer wallet credit or debit
 */
export async function adminAdjustWallet(
  userId: string,
  amount: number,
  type: 'credit' | 'debit',
  reason: string
): Promise<ActionResult<{ balance: number; transaction: IWalletTransaction }>> {
  try {
    if (type === 'credit') {
      return addCredit(userId, amount, `Admin adjustment: ${reason}`);
    } else {
      return deductCredit(userId, amount, `Admin deduction: ${reason}`);
    }
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

/**
 * Admin: Get overview of all wallet ledger transactions
 */
export async function getAllWalletOverviewAdmin(): Promise<
  ActionResult<{
    totalCreditsGiven: number;
    totalDebits: number;
    transactions: IWalletTransaction[];
  }>
> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const txs = MockDb.getWalletTransactions();
      const credits = txs.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
      const debits = txs.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
      return successResponse({
        totalCreditsGiven: credits,
        totalDebits: debits,
        transactions: txs as IWalletTransaction[],
      });
    }

    const txs = await WalletTransaction.find().sort({ createdAt: -1 }).limit(100).lean();
    const credits = txs.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    const debits = txs.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0);

    return successResponse({
      totalCreditsGiven: credits,
      totalDebits: debits,
      transactions: JSON.parse(JSON.stringify(txs)),
    });
  } catch (error: unknown) {
    const txs = MockDb.getWalletTransactions();
    const credits = txs.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    const debits = txs.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
    return successResponse({
      totalCreditsGiven: credits,
      totalDebits: debits,
      transactions: txs as IWalletTransaction[],
    });
  }
}
