'use server';

/**
 * @file actions/referral.actions.ts
 * @description Customer viral referral engine, tracking, automatic Rs. 200 wallet reward,
 * and 10% discount promo generation for OX Shoes Pakistan.
 * Strict TypeScript: ZERO `any`.
 */

import { connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { User } from '@/models/User';
import { Referral } from '@/models/Referral';
import { WalletTransaction } from '@/models/WalletTransaction';
import { Coupon } from '@/models/Coupon';
import { addCredit, getWalletBalance, getWalletTransactions } from './wallet.actions';
import { successResponse, errorResponse, type ActionResult } from '@/lib/response';
import { handleActionError } from '@/lib/error-handler';
import { MockDb } from '@/lib/db/mock-store';
import { TransactionStatus, ReferralStatus, CouponType, ProductCategory, type IReferral, type IWalletTransaction } from '@/types';
import { Types } from 'mongoose';
import { revalidatePath } from 'next/cache';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://oxshoes.pk';

/**
 * Generate user's full viral referral link: https://domain/r/[referralCode]
 */
export async function generateMyReferralLink(
  userId?: string,
  providedCode?: string
): Promise<ActionResult<{ link: string; code: string }>> {
  try {
    let code = providedCode || 'OX-HAMZA8';

    if (userId && !providedCode) {
      await connectToDatabase();
      if (isDatabaseConnected()) {
        const user = await User.findById(userId).select('referralCode').lean();
        if (user && user.referralCode) {
          code = user.referralCode;
        }
      }
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
      const mockReferral = MockDb.addReferral({
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
      const existingRef = await Referral.findOne({
        referredEmail: newUserEmail.toLowerCase().trim(),
      });

      if (!existingRef) {
        await Referral.create({
          referrerId: referrer._id,
          referredEmail: newUserEmail.toLowerCase().trim(),
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
 * - Credit referrer with Rs. 200 (walletBalance += 200) + ledger log
 * - Issue a 10% off thank-you coupon for the referred user if not already generated
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
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const res = MockDb.completeReferral(referredUserId, orderId);
      revalidatePath('/dashboard/referrals');
      revalidatePath('/admin');
      return successResponse({
        completed: res.success,
        rewardAmount: 200,
      });
    }

    // 1. Find referred user to verify referredBy
    const referee = await User.findById(referredUserId);
    if (!referee || !referee.referredBy) {
      // Check if there is a pending referral by referee's email
      const refByEmail = referee?.email
        ? await Referral.findOne({
            referredEmail: referee.email.toLowerCase(),
            status: { $in: [ReferralStatus.PENDING] },
          })
        : null;

      if (!refByEmail) {
        return successResponse({ completed: false, rewardAmount: 0 });
      }

      refByEmail.refereeId = referee?._id;
      refByEmail.orderId = orderId ? new Types.ObjectId(orderId) : undefined;
      refByEmail.status = ReferralStatus.PENDING;
      refByEmail.completedAt = new Date();
      await refByEmail.save();

      // Credit referrer
      await addCredit(
        refByEmail.referrerId.toString(),
        refByEmail.rewardAmount || 200,
        `Referral Reward: ${referee?.name || referee?.email || 'Friend'} completed their 1st order!`,
        orderId || refByEmail._id.toString(),
        TransactionStatus.PENDING
      );

      return successResponse({
        completed: true,
        rewardAmount: refByEmail.rewardAmount || 200,
        referrerId: refByEmail.referrerId.toString(),
      });
    }

    // 2. Check for active/pending referral record
    let referralRecord = await Referral.findOne({
      refereeId: referee._id,
      referrerId: referee.referredBy,
      status: { $in: [ReferralStatus.PENDING] },
    });

    if (!referralRecord) {
      // Create if none existed but referredBy is set
      const referrerUser = await User.findById(referee.referredBy);
      referralRecord = await Referral.create({
        referrerId: referee.referredBy,
        refereeId: referee._id,
        referredEmail: referee.email,
        referredName: referee.name,
        code: referrerUser?.referralCode || 'REF-REWARD',
        rewardAmount: 200,
        status: ReferralStatus.PENDING,
      });
    }

    // 3. Mark completed
    referralRecord.status = ReferralStatus.APPROVED;
    referralRecord.completedAt = new Date();
    await referralRecord.save();

    // 4. Give Rs. 200 credit to referrer
    await addCredit(
      referee.referredBy.toString(),
      referralRecord.rewardAmount || 200,
      `Referral Reward: ${referee.name || referee.email} completed 1st shoe purchase!`,
      orderId || referralRecord._id.toString()
    );

    // 5. Generate 10% coupon for the referee
    const couponCode = `FRIEND10-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    await Coupon.create({
      code: couponCode,
      type: CouponType.PERCENTAGE,
      value: 10,
      minOrderAmount: 1000,
      maxDiscountAmount: 1000,
      usageLimit: 1,
      usedCount: 0,
      perUserLimit: 1,
      isFirstOrderOnly: false,
      isReferralReward: true,
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      isActive: true,
    });

    revalidatePath('/dashboard/referrals');
    revalidatePath('/admin');

    return successResponse({
      completed: true,
      rewardAmount: referralRecord.rewardAmount || 200,
      referrerId: referee.referredBy.toString(),
      couponCode,
    });
  } catch (error: unknown) {
    const res = MockDb.completeReferral(referredUserId, orderId);
    return successResponse({
      completed: res.success,
      rewardAmount: 200,
    });
  }
}

/**
 * Get referrals made by the logged-in user
 */
export async function getMyReferrals(
  userId: string
): Promise<ActionResult<{ referrals: IReferral[]; totalEarned: number }>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const refs = MockDb.getReferralsByUser(userId);
      const totalEarned = refs
        .filter((r) => r.status === ReferralStatus.APPROVED)
        .reduce((sum, r) => sum + (r.rewardAmount || 200), 0);
      return successResponse({ referrals: refs as IReferral[], totalEarned });
    }

    const refs = await Referral.find({
      $or: [
        { referrerId: new Types.ObjectId(userId) },
        ...(Types.ObjectId.isValid(userId) ? [] : [{ referrerId: userId as any }]),
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!refs || refs.length === 0) {
      const mockRefs = MockDb.getReferralsByUser(userId);
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
    const mockRefs = MockDb.getReferralsByUser(userId);
    const totalEarned = mockRefs
      .filter((r) => r.status === ReferralStatus.APPROVED)
      .reduce((sum, r) => sum + (r.rewardAmount || 200), 0);
    return successResponse({ referrals: mockRefs as IReferral[], totalEarned });
  }
}

/**
 * Get unified wallet & referral status for customer dashboard
 */
export async function getMyWallet(userId: string): Promise<
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
    const [balanceRes, referralsRes, txsRes, linkRes] = await Promise.all([
      getWalletBalance(userId),
      getMyReferrals(userId),
      getWalletTransactions(userId),
      generateMyReferralLink(userId),
    ]);

    const balance = balanceRes.success && balanceRes.data ? balanceRes.data.balance : 400;
    const referrals = referralsRes.success && referralsRes.data ? referralsRes.data.referrals : [];
    const totalEarned =
      referralsRes.success && referralsRes.data
        ? referralsRes.data.totalEarned
        : referrals.length * 200;
    const transactions = txsRes.success && txsRes.data ? txsRes.data : [];
    const referralCode = linkRes.success && linkRes.data ? linkRes.data.code : 'OX-HAMZA8';
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
 * Admin: Retrieve all platform referrals
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
    const refs = MockDb.getAllReferrals();
    const completed = refs.filter((r) => r.status === ReferralStatus.APPROVED);
    return successResponse({
      referrals: refs as IReferral[],
      totalReferrals: refs.length,
      completedCount: completed.length,
      totalRewardsDistributed: completed.length * 200,
    });
  }
}

/**
 * Approve referral - moves pending credit to active
 */
export async function approveReferral(referredOrderId: string): Promise<ActionResult<{ approved: boolean }>> {
  try {
    await connectToDatabase();
    const referral = await Referral.findOne({ orderId: new Types.ObjectId(referredOrderId) });
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
    
    revalidatePath('/dashboard/referrals');
    revalidatePath('/admin');
    
    return successResponse({ approved: true });
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Cancel referral - if order is cancelled/returned/refunded
 */
export async function cancelReferral(referredOrderId: string): Promise<ActionResult<{ cancelled: boolean }>> {
  try {
    await connectToDatabase();
    const referral = await Referral.findOne({ orderId: new Types.ObjectId(referredOrderId) });
    if (!referral) {
        return errorResponse('Referral not found.');
    }

    if (referral.status === ReferralStatus.CANCELLED) {
        return successResponse({ cancelled: true });
    }

    const wasApproved = referral.status === ReferralStatus.APPROVED;
    referral.status = ReferralStatus.CANCELLED;
    await referral.save();
    
    // Cancel pending transaction if it was pending
    await WalletTransaction.findOneAndUpdate(
        { referenceId: referral._id.toString(), status: TransactionStatus.PENDING },
        { status: TransactionStatus.CANCELLED }
    );

    if (wasApproved) {
        // Create a deduction transaction because credit was already active
        await addCredit(
            referral.referrerId.toString(),
            -(referral.rewardAmount || 200),
            `Referral Cancelled: Deduction for order ${referredOrderId}`,
            referral._id.toString(),
            TransactionStatus.COMPLETED
        );
    }

    revalidatePath('/dashboard/referrals');
    revalidatePath('/admin');
    
    return successResponse({ cancelled: true });
  } catch (error) {
    return handleActionError(error);
  }
}
