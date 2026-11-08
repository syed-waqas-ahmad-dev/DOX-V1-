'use server';

/**
 * @file actions/wallet.actions.ts
 * @description Customer store credit wallet & transaction ledger server actions.
 * Enforces strict role-based authorization (CUSTOMER/MANAGER restricted to self,
 * cross-customer access strictly limited to SUPER_ADMIN/ADMIN).
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
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isElevatedAdminRole, verifyDepartmentAuth } from '@/lib/auth-guard';
import {
  addCreditInternal,
  deductCreditInternal,
} from '@/lib/services/wallet.service';

/**
 * Retrieve user's current wallet balance.
 * Requires authenticated session. Non-elevated roles (CUSTOMER, MANAGER) are strictly
 * restricted to their own wallet balance. Only SUPER_ADMIN and ADMIN may query another user.
 */
export async function getWalletBalance(userId?: string): Promise<ActionResult<{ balance: number }>> {
  let targetUserId = userId;
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    const sessionUser = session?.user as { id?: string; email?: string; role?: string } | undefined;

    if (!sessionUser) {
      return errorResponse('Unauthenticated: Please sign in to view wallet balance.');
    }

    const isElevatedAdmin = isElevatedAdminRole(sessionUser.role);

    // Reject non-elevated callers (CUSTOMER, MANAGER) attempting cross-customer access
    if (userId && !isElevatedAdmin && userId !== sessionUser.id) {
      return errorResponse("Unauthorized: Cannot access another customer's wallet balance.");
    }

    // Admins can query target userId; non-admins strictly default to session user ID
    targetUserId = isElevatedAdmin && userId ? userId.trim() : sessionUser.id;

    if (!targetUserId || typeof targetUserId !== 'string' || !targetUserId.trim()) {
      return errorResponse('Invalid session: Missing user identifier.');
    }

    const cleanTargetId = targetUserId.trim();
    if (!Types.ObjectId.isValid(cleanTargetId)) {
      return errorResponse('Invalid request: Target user identifier must be a valid MongoDB ID.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const balance = MockDb.getWalletBalance(cleanTargetId);
      return successResponse({ balance });
    }

    const user = await User.findById(cleanTargetId).select('walletBalance').lean();
    if (!user) {
      const balance = MockDb.getWalletBalance(cleanTargetId);
      return successResponse({ balance });
    }

    return successResponse({ balance: user.walletBalance || 0 });
  } catch (error: unknown) {
    const balance = MockDb.getWalletBalance(targetUserId || '');
    return successResponse({ balance });
  }
}

/**
 * Add credit to user's wallet and record in transaction ledger.
 * When invoked directly as a Server Action, requires SUPER_ADMIN or ADMIN authorization with live DB verification.
 * Internal server-to-server callers (referrals, orders) use addCreditInternal directly.
 */
export async function addCredit(
  userId: string,
  amount: number,
  description: string,
  referenceId?: string,
  status: TransactionStatus = TransactionStatus.COMPLETED
): Promise<ActionResult<{ balance: number; transaction: IWalletTransaction }>> {
  try {
    const auth = await verifyDepartmentAuth({ allowElevatedAdmin: true });
    if (!auth.authorized) {
      return errorResponse('Unauthorized: Administrative clearance required to credit customer wallets.');
    }

    return await addCreditInternal(userId, amount, description, referenceId, status);
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

/**
 * Deduct credit from user's wallet atomically on checkout.
 * When invoked directly as a Server Action, requires SUPER_ADMIN or ADMIN authorization with live DB verification.
 * Internal server-to-server callers (checkout) use deductCreditInternal directly.
 */
export async function deductCredit(
  userId: string,
  amount: number,
  description: string,
  referenceId?: string
): Promise<ActionResult<{ balance: number; transaction: IWalletTransaction }>> {
  try {
    const auth = await verifyDepartmentAuth({ allowElevatedAdmin: true });
    if (!auth.authorized) {
      return errorResponse('Unauthorized: Administrative clearance required to deduct customer credits.');
    }

    return await deductCreditInternal(userId, amount, description, referenceId);
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

/**
 * Retrieve transaction history for a user.
 * Requires authenticated session. Non-elevated roles (CUSTOMER, MANAGER) are strictly
 * restricted to their own ledger. Only SUPER_ADMIN and ADMIN may inspect another user's ledger.
 */
export async function getWalletTransactions(
  userId?: string
): Promise<ActionResult<IWalletTransaction[]>> {
  let targetUserId = userId;
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    const sessionUser = session?.user as { id?: string; email?: string; role?: string } | undefined;

    if (!sessionUser) {
      return errorResponse('Unauthenticated: Please sign in to view transaction history.');
    }

    const isElevatedAdmin = isElevatedAdminRole(sessionUser.role);

    // Reject non-elevated callers (CUSTOMER, MANAGER) attempting cross-customer access
    if (userId && !isElevatedAdmin && userId !== sessionUser.id) {
      return errorResponse("Unauthorized: Cannot access another customer's transaction ledger.");
    }

    targetUserId = isElevatedAdmin && userId ? userId.trim() : sessionUser.id;

    if (!targetUserId || typeof targetUserId !== 'string' || !targetUserId.trim()) {
      return errorResponse('Invalid session: Missing user identifier.');
    }

    const cleanTargetId = targetUserId.trim();
    if (!Types.ObjectId.isValid(cleanTargetId)) {
      return errorResponse('Invalid request: Target user identifier must be a valid MongoDB ID.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const txs = MockDb.getWalletTransactions(cleanTargetId);
      return successResponse(txs as IWalletTransaction[]);
    }

    const txs = await WalletTransaction.find({
      userId: new Types.ObjectId(cleanTargetId),
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    if (!txs || txs.length === 0) {
      const mockTxs = MockDb.getWalletTransactions(cleanTargetId);
      return successResponse(mockTxs as IWalletTransaction[]);
    }

    return successResponse(JSON.parse(JSON.stringify(txs)));
  } catch (error: unknown) {
    const mockTxs = MockDb.getWalletTransactions(targetUserId || '');
    return successResponse(mockTxs as IWalletTransaction[]);
  }
}

/**
 * Admin: Manually adjust customer wallet credit or debit.
 * Strictly limited to SUPER_ADMIN and ADMIN. Validates amount, target ID, and reason server-side.
 */
export async function adminAdjustWallet(
  userId: string,
  amount: number,
  type: 'credit' | 'debit',
  reason: string
): Promise<ActionResult<{ balance: number; transaction: IWalletTransaction }>> {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    if (!session?.user || !isElevatedAdminRole((session.user as { role?: string }).role)) {
      return errorResponse('Unauthorized: Administrative clearance required.');
    }

    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return errorResponse('Invalid target user identifier.');
    }
    const cleanUserId = userId.trim();
    if (!Types.ObjectId.isValid(cleanUserId)) {
      return errorResponse('Invalid target user identifier: must be a valid MongoDB ID.');
    }

    if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount) || amount <= 0 || amount > 100000) {
      return errorResponse('Invalid adjustment amount: must be a positive number up to PKR 100,000.');
    }

    if (type !== 'credit' && type !== 'debit') {
      return errorResponse("Invalid adjustment type: must be 'credit' or 'debit'.");
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return errorResponse('Adjustment reason must be at least 3 characters.');
    }

    const referenceId = `ADJ-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    if (type === 'credit') {
      return await addCreditInternal(cleanUserId, amount, `Admin adjustment: ${reason.trim()}`, referenceId);
    } else {
      return await deductCreditInternal(cleanUserId, amount, `Admin deduction: ${reason.trim()}`, referenceId);
    }
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

/**
 * Admin: Get overview of all wallet ledger transactions.
 * Strictly limited to SUPER_ADMIN and ADMIN.
 */
export async function getAllWalletOverviewAdmin(): Promise<
  ActionResult<{
    totalCreditsGiven: number;
    totalDebits: number;
    transactions: IWalletTransaction[];
  }>
> {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    if (!session?.user || !isElevatedAdminRole((session.user as { role?: string }).role)) {
      return errorResponse('Unauthorized: Administrative clearance required.');
    }

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
    return handleActionError(error);
  }
}
