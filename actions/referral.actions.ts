'use server';

/**
 * @file actions/referral.actions.ts
 * @description Customer viral referral engine, tracking, automatic Rs. 200 wallet reward,
 * and 10% discount promo generation for OX Shoes Pakistan.
 * Enforces strict role-based access control (CUSTOMER/MANAGER restricted to self,
 * cross-customer access strictly limited to SUPER_ADMIN/ADMIN).
 * Strict TypeScript: ZERO `any`.
 */

import { connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { User } from '@/models/User';
import { Referral } from '@/models/Referral';
import { WalletTransaction } from '@/models/WalletTransaction';
import { Coupon } from '@/models/Coupon';
import { Order } from '@/models/Order';
import { getWalletBalance, getWalletTransactions } from './wallet.actions';
import { addCreditInternal } from '@/lib/services/wallet.service';
import { successResponse, errorResponse, type ActionResult } from '@/lib/response';
import { handleActionError } from '@/lib/error-handler';
import { MockDb } from '@/lib/db/mock-store';
import { TransactionStatus, ReferralStatus, CouponType, UserRole, type IReferral, type IWalletTransaction, OrderStatus } from '@/types';
import { Types } from 'mongoose';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isElevatedAdminRole } from '@/lib/auth-guard';
import { completeReferralInternal, cancelReferralInternal } from '@/lib/services/referral.service';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_URL ||
  process.env.NEXTAUTH_URL ||
  'https://oxshoes.pk';

/**
 * Generate user's full viral referral link: https://domain/r/[referralCode]
 * Non-elevated roles (CUSTOMER, MANAGER) are strictly restricted to their own referral link.
 * Unauthenticated requests supplying an arbitrary userId are rejected.
 */
export async function generateMyReferralLink(
  userId?: string,
  providedCode?: string
): Promise<ActionResult<{ link: string; code: string }>> {
  try {
    let code = providedCode || '';

    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    const sessionUser = session?.user as { id?: string; email?: string; role?: string } | undefined;

    let targetUserId = userId;

    if (sessionUser) {
      const isElevatedAdmin = isElevatedAdminRole(sessionUser.role);
      if (userId && !isElevatedAdmin && userId !== sessionUser.id) {
        return errorResponse("Unauthorized: Cannot inspect another customer's referral link.");
      }
      targetUserId = isElevatedAdmin && userId ? userId.trim() : sessionUser.id;
    } else {
      if (userId && !providedCode) {
        return errorResponse('Unauthenticated: Please sign in to view referral link.');
      }
    }

    if (targetUserId && !providedCode) {
      if (!Types.ObjectId.isValid(targetUserId)) {
        return errorResponse('Invalid user ID format for referral link generation.');
      }

      await connectToDatabase();
      if (isDatabaseConnected()) {
        const user = await User.findById(targetUserId);

        if (user) {
          if (user.referralCode && user.referralCode.trim()) {
            code = user.referralCode.trim().toUpperCase();
          } else {
            // Generate a persistent unique referral code for user if missing
            const hex = user._id ? user._id.toString().slice(-6).toUpperCase() : Math.random().toString(36).substring(2, 8).toUpperCase();
            const newCode = `USR-${hex}`;
            user.referralCode = newCode;
            await user.save();
            code = newCode;
          }
        }
      }
    }

    if (!code) {
      code = 'OX-REFERRAL';
    }

    const domain = APP_URL.replace(/\/+$/, '');
    const link = `${domain}/r/${code}`;

    return successResponse({ link, code });
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

/**
 * Track when a prospective customer visits or registers via referral link
 */
export async function trackReferralClick(
  code: string,
  newUserEmail?: string
): Promise<ActionResult<{ tracked: boolean; referrerName?: string }>> {
  try {
    if (!code || !code.trim()) {
      return successResponse({ tracked: false });
    }

    const normalizedCode = code.trim().toUpperCase();
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      MockDb.addReferral({
        referrerId: 'user-demo-hamza',
        referredEmail: newUserEmail || 'guest-visitor@oxshoes.pk',
        code: normalizedCode,
        rewardAmount: 200,
        status: ReferralStatus.PENDING,
      });
      return successResponse({ tracked: true, referrerName: 'OX Shoes VIP Member' });
    }

    const referrer = await User.findOne({ referralCode: normalizedCode });
    if (!referrer) {
      return successResponse({ tracked: false });
    }

    if (newUserEmail) {
      const cleanEmail = newUserEmail.toLowerCase().trim();
      if (referrer.email.toLowerCase().trim() === cleanEmail) {
        return successResponse({ tracked: false, referrerName: referrer.name });
      }

      const existingRef = await Referral.findOne({
        referredEmail: cleanEmail,
      });

      if (!existingRef) {
        await Referral.create({
          referrerId: referrer._id,
          referredEmail: cleanEmail,
          code: normalizedCode,
          rewardAmount: 200,
          status: ReferralStatus.PENDING,
        });
      }
    }

    return successResponse({
      tracked: true,
      referrerName: referrer.name,
    });
  } catch (error: unknown) {
    return successResponse({ tracked: false });
  }
}

/**
 * Complete referral on referee's first successful order:
 * - Mark referral as ReferralStatus.APPROVED
 * - Credit referrer with Rs. 200 (walletBalance += 200) + ledger log via addCreditInternal
 * - Issue a 10% off thank-you coupon for the referred user if not already generated
 * Strictly limited to SUPER_ADMIN and ADMIN.
 */
export async function completeReferral(
  referredUserId: string,
  orderId?: string
): Promise<
  ActionResult<{
    completed: boolean;
    rewardAmount: number;
    referrerId?: string;
    couponCode?: string;
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
      return errorResponse('Unauthorized: Administrative clearance required to manually complete referrals.');
    }

    const result = await completeReferralInternal(referredUserId, orderId);

    if (result.success) {
      try {
        revalidatePath('/dashboard/referrals');
        revalidatePath('/admin');
      } catch {
        // Ignored
      }
    }

    return successResponse({
      completed: result.success,
      rewardAmount: result.rewardAmount,
      referrerId: result.referrerId,
      couponCode: result.couponCode,
    });
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

/**
 * Authorization policy evaluator for getMyReferrals.
 * Non-elevated roles (CUSTOMER, MANAGER) are strictly restricted to their own referrals.
 * Only SUPER_ADMIN and ADMIN are permitted cross-customer access.
 */
export async function verifyReferralsAuthorization(
  sessionUser: { id?: string; email?: string; role?: string } | undefined,
  userId?: string
): Promise<ActionResult<{ targetUserId: string }>> {
  if (!sessionUser) {
    return errorResponse('Unauthenticated: Please sign in to view referrals.');
  }

  const isElevatedAdmin = isElevatedAdminRole(sessionUser.role);

  // Non-elevated roles (CUSTOMER, MANAGER, etc.) can only access their own referrals
  if (userId && !isElevatedAdmin && userId !== sessionUser.id) {
    return errorResponse("Unauthorized: Cannot access another customer's referrals.");
  }

  // Resolve target user ID: elevated admins can target any valid user ID; non-admins use session ID
  const rawTargetId = isElevatedAdmin && userId ? userId : sessionUser.id;

  // Reject session if ID is missing (never substitute email as a MongoDB user ID)
  if (!rawTargetId || typeof rawTargetId !== 'string' || !rawTargetId.trim()) {
    return errorResponse('Invalid session: Missing user identifier.');
  }

  const cleanTargetId = rawTargetId.trim();

  // Validate that the target ID is a valid MongoDB ObjectId before querying
  if (!Types.ObjectId.isValid(cleanTargetId)) {
    return errorResponse('Invalid request: Target user identifier must be a valid MongoDB ID.');
  }

  return successResponse({ targetUserId: cleanTargetId });
}

/**
 * Get referrals made by the logged-in user
 */
export async function getMyReferrals(
  userId?: string
): Promise<ActionResult<{ referrals: IReferral[]; totalEarned: number }>> {
  let targetUserId = userId;
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    const sessionUser = session?.user as { id?: string; email?: string; role?: string } | undefined;
    const authCheck = await verifyReferralsAuthorization(sessionUser, userId);
    if (!authCheck.success || !authCheck.data) {
      return authCheck as ActionResult<{ referrals: IReferral[]; totalEarned: number }>;
    }

    targetUserId = authCheck.data.targetUserId;

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const refs = MockDb.getReferralsByUser(targetUserId);
      const totalEarned = refs
        .filter((r) => r.status === ReferralStatus.APPROVED)
        .reduce((sum, r) => sum + (r.rewardAmount || 200), 0);
      return successResponse({ referrals: refs as IReferral[], totalEarned });
    }

    const refs = await Referral.find({
      referrerId: new Types.ObjectId(targetUserId),
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!refs || refs.length === 0) {
      const mockRefs = MockDb.getReferralsByUser(targetUserId || '');
      const totalEarned = mockRefs
        .filter((r) => r.status === ReferralStatus.APPROVED)
        .reduce((sum, r) => sum + (r.rewardAmount || 200), 0);
      return successResponse({ referrals: mockRefs as IReferral[], totalEarned });
    }

    const totalEarned = refs
      .filter((r) => r.status === ReferralStatus.APPROVED || (r.status as string) === 'Completed')
      .reduce((sum, r) => sum + (r.rewardAmount || 200), 0);

    return successResponse({
      referrals: JSON.parse(JSON.stringify(refs)),
      totalEarned,
    });
  } catch (error: unknown) {
    const mockRefs = MockDb.getReferralsByUser(targetUserId || '');
    const totalEarned = mockRefs
      .filter((r) => r.status === ReferralStatus.APPROVED)
      .reduce((sum, r) => sum + (r.rewardAmount || 200), 0);
    return successResponse({ referrals: mockRefs as IReferral[], totalEarned });
  }
}

/**
 * Get unified wallet & referral status for customer dashboard.
 * Requires authenticated session. Non-elevated roles (CUSTOMER, MANAGER) are strictly
 * restricted to their own wallet data. Nested calls independently enforce their authorization.
 * Any authorization failure fails immediately to prevent partial data leakage.
 */
export async function getMyWallet(userId?: string): Promise<
  ActionResult<{
    walletBalance: number;
    totalEarned: number;
    referrals: IReferral[];
    transactions: IWalletTransaction[];
    referralCode: string;
    referralLink: string;
  }>
> {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    const sessionUser = session?.user as { id?: string; email?: string; role?: string } | undefined;

    if (!sessionUser) {
      return errorResponse('Unauthenticated: Please sign in to view your referral wallet.');
    }

    const isElevatedAdmin = isElevatedAdminRole(sessionUser.role);
    let targetUserId = userId;

    if (userId && !isElevatedAdmin && userId !== sessionUser.id) {
      return errorResponse("Unauthorized: Cannot access another customer's wallet data.");
    }

    targetUserId = isElevatedAdmin && userId ? userId.trim() : sessionUser.id;

    if (!targetUserId || typeof targetUserId !== 'string' || !targetUserId.trim()) {
      return errorResponse('Invalid session: Missing user identifier.');
    }

    const cleanTargetId = targetUserId.trim();
    if (!Types.ObjectId.isValid(cleanTargetId)) {
      return errorResponse('Invalid request: Target user identifier must be a valid MongoDB ID.');
    }

    const [balanceRes, referralsRes, txsRes, linkRes] = await Promise.all([
      getWalletBalance(cleanTargetId),
      getMyReferrals(cleanTargetId),
      getWalletTransactions(cleanTargetId),
      generateMyReferralLink(cleanTargetId),
    ]);

    // Fail closed if any authorization checks failed
    if (!balanceRes.success && (balanceRes.error || '').includes('Unauthorized')) {
      return errorResponse(balanceRes.error || 'Unauthorized');
    }
    if (!referralsRes.success && (referralsRes.error || '').includes('Unauthorized')) {
      return errorResponse(referralsRes.error || 'Unauthorized');
    }
    if (!txsRes.success && (txsRes.error || '').includes('Unauthorized')) {
      return errorResponse(txsRes.error || 'Unauthorized');
    }
    if (!linkRes.success && (linkRes.error || '').includes('Unauthorized')) {
      return errorResponse(linkRes.error || 'Unauthorized');
    }

    const balance = balanceRes.success && balanceRes.data ? balanceRes.data.balance : 0;
    const referrals = referralsRes.success && referralsRes.data ? referralsRes.data.referrals : [];
    const totalEarned =
      referralsRes.success && referralsRes.data
        ? referralsRes.data.totalEarned
        : referrals.filter((r) => r.status === ReferralStatus.APPROVED || (r.status as string) === 'Completed').reduce((sum, r) => sum + (r.rewardAmount || 200), 0);
    const transactions = txsRes.success && txsRes.data ? txsRes.data : [];
    const referralCode = linkRes.success && linkRes.data ? linkRes.data.code : 'OX-REFERRAL';
    const referralLink =
      linkRes.success && linkRes.data
        ? linkRes.data.link
        : `${APP_URL.replace(/\/+$/, '')}/r/${referralCode}`;

    return successResponse({
      walletBalance: balance,
      totalEarned,
      referrals,
      transactions,
      referralCode,
      referralLink,
    });
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

/**
 * Admin: Retrieve all platform referrals.
 * Strictly limited to SUPER_ADMIN and ADMIN.
 */
export async function getAllReferralsAdmin(): Promise<
  ActionResult<{
    referrals: IReferral[];
    totalReferrals: number;
    completedCount: number;
    totalRewardsDistributed: number;
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
      const refs = MockDb.getAllReferrals();
      const completed = refs.filter((r) => r.status === ReferralStatus.APPROVED);
      return successResponse({
        referrals: refs as IReferral[],
        totalReferrals: refs.length,
        completedCount: completed.length,
        totalRewardsDistributed: completed.length * 200,
      });
    }

    const refs = await Referral.find()
      .populate('referrerId', 'name email referralCode')
      .populate('refereeId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const completed = refs.filter(
      (r) => r.status === ReferralStatus.APPROVED || (r.status as string) === 'Completed'
    );

    return successResponse({
      referrals: JSON.parse(JSON.stringify(refs)),
      totalReferrals: refs.length,
      completedCount: completed.length,
      totalRewardsDistributed: completed.reduce((sum, r) => sum + (r.rewardAmount || 200), 0),
    });
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

/**
 * Approve referral - moves pending credit to active.
 * Strictly limited to SUPER_ADMIN and ADMIN.
 */
export async function approveReferral(referredOrderId: string): Promise<ActionResult<{ approved: boolean }>> {
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

    if (!referredOrderId || !referredOrderId.trim()) {
      return errorResponse('Invalid order identifier.');
    }

    await connectToDatabase();

    let referral = null;
    const cleanId = referredOrderId.trim();

    if (Types.ObjectId.isValid(cleanId)) {
      referral = await Referral.findOne({ orderId: new Types.ObjectId(cleanId) });
    }

    if (!referral) {
      // Try searching order by orderNumber
      const order = await Order.findOne({
        orderNumber: cleanId.toUpperCase(),
      }).lean();

      if (order?._id) {
        referral = await Referral.findOne({ orderId: order._id });
      }
    }

    if (!referral || referral.status !== ReferralStatus.PENDING) {
      return errorResponse('Referral not found or already processed.');
    }

    referral.status = ReferralStatus.APPROVED;
    await referral.save();

    // Find the wallet transaction and update status
    await WalletTransaction.findOneAndUpdate(
      { referenceId: referral._id.toString() },
      { status: TransactionStatus.COMPLETED }
    );

    try {
      revalidatePath('/dashboard/referrals');
      revalidatePath('/admin');
    } catch {
      // Ignored in tests
    }

    return successResponse({ approved: true });
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Cancel referral - if order is cancelled/returned/refunded.
 * Strictly limited to SUPER_ADMIN and ADMIN.
 */
export async function cancelReferral(
  referredOrderId: string
): Promise<ActionResult<{ cancelled: boolean }>> {
  try {
    if (!referredOrderId || typeof referredOrderId !== 'string' || !referredOrderId.trim()) {
      return errorResponse('Invalid order identifier: a valid Order ID or Order Number is required.');
    }

    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    if (!session?.user || !isElevatedAdminRole((session.user as { role?: string }).role)) {
      return errorResponse('Unauthorized: Administrative clearance required to cancel referrals.');
    }

    await connectToDatabase();
    const cleanId = referredOrderId.trim();

    // Check if order exists before attempting cancellation to provide better error feedback
    let orderDoc = null;
    if (Types.ObjectId.isValid(cleanId)) {
      orderDoc = await Order.findById(cleanId).lean();
    }
    if (!orderDoc) {
      orderDoc = await Order.findOne({ orderNumber: cleanId.toUpperCase() }).lean();
    }

    if (!orderDoc) {
      return errorResponse(`Order not found: "${cleanId}" does not match any existing record.`);
    }

    const result = await cancelReferralInternal(cleanId);

    if (result.success) {
      try {
        revalidatePath('/dashboard/referrals');
        revalidatePath('/admin');
      } catch {
        // Ignored
      }
    }

    return result.success 
      ? successResponse({ cancelled: true }, result.alreadyCancelled ? 'Referral already cancelled.' : undefined)
      : errorResponse('Failed to cancel referral: internal consistency error.');
  } catch (error) {
    return handleActionError(error);
  }
}
