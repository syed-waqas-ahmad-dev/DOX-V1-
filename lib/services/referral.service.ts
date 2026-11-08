/**
 * @file lib/services/referral.service.ts
 * @description Internal referral engine service for OX Shoes Pakistan.
 * Handles reward distribution, status transitions, and clawbacks.
 * This is a server-side ONLY service module. It is NOT a public Server Action endpoint.
 * Calling these functions requires the caller to have already performed authorization.
 */

import { connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { User } from '@/models/User';
import { Referral } from '@/models/Referral';
import { WalletTransaction } from '@/models/WalletTransaction';
import { Coupon } from '@/models/Coupon';
import { Order } from '@/models/Order';
import { addCreditInternal, executeWithOptionalTransaction } from './wallet.service';
import { MockDb } from '@/lib/db/mock-store';
import { TransactionStatus, ReferralStatus, CouponType, OrderStatus } from '@/types';
import mongoose, { Types } from 'mongoose';

/**
 * Internal: Complete referral on referee's first successful order.
 * This should be called from trusted server-side logic (e.g., order delivery status update).
 */
export async function completeReferralInternal(
  referredUserId: string,
  orderId?: string
): Promise<{
  success: boolean;
  rewardAmount: number;
  referrerId?: string;
  couponCode?: string;
}> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const res = MockDb.completeReferral(referredUserId, orderId);
      return {
        success: res.success,
        rewardAmount: 200,
      };
    }

    // 1. Find referred user to verify referredBy
    const referee = await User.findById(referredUserId);
    if (!referee) {
      return { success: false, rewardAmount: 0 };
    }

    const cleanRefereeEmail = referee.email ? referee.email.toLowerCase().trim() : '';

    if (!referee.referredBy) {
      // Check if there is a pending referral by referee's email
      const refByEmail = cleanRefereeEmail
        ? await Referral.findOne({
            referredEmail: cleanRefereeEmail,
            status: { $in: [ReferralStatus.PENDING] },
          })
        : null;

      if (!refByEmail) {
        return { success: false, rewardAmount: 0 };
      }

      refByEmail.refereeId = referee._id;
      refByEmail.orderId = orderId && Types.ObjectId.isValid(orderId) ? new Types.ObjectId(orderId) : undefined;
      refByEmail.status = ReferralStatus.APPROVED;
      refByEmail.completedAt = new Date();
      await refByEmail.save();

      // Credit referrer internally
      await addCreditInternal(
        refByEmail.referrerId.toString(),
        refByEmail.rewardAmount || 200,
        `Referral Reward: ${referee.name || cleanRefereeEmail || 'Friend'} completed their 1st order!`,
        `REF-${refByEmail._id.toString()}`,
        TransactionStatus.COMPLETED
      );

      return {
        success: true,
        rewardAmount: refByEmail.rewardAmount || 200,
        referrerId: refByEmail.referrerId.toString(),
      };
    }

    // 2. Check if referral was ALREADY approved (Strict Idempotency Guard)
    const existingApproved = await Referral.findOne({
      referrerId: referee.referredBy,
      $or: [
        { refereeId: referee._id },
        ...(cleanRefereeEmail ? [{ referredEmail: cleanRefereeEmail }] : []),
      ],
      status: ReferralStatus.APPROVED,
    });

    if (existingApproved) {
      return {
        success: true,
        rewardAmount: existingApproved.rewardAmount || 200,
        referrerId: referee.referredBy.toString(),
      };
    }

    // 3. Atomically transition referral status from PENDING to APPROVED
    let referralRecord = await Referral.findOneAndUpdate(
      {
        referrerId: referee.referredBy,
        $or: [
          { refereeId: referee._id },
          ...(cleanRefereeEmail ? [{ referredEmail: cleanRefereeEmail }] : []),
        ],
        status: ReferralStatus.PENDING,
      },
      {
        $set: {
          status: ReferralStatus.APPROVED,
          completedAt: new Date(),
          orderId: orderId && Types.ObjectId.isValid(orderId) ? new Types.ObjectId(orderId) : undefined,
          refereeId: referee._id,
        },
      },
      { new: true }
    );

    if (!referralRecord) {
      // Create and approve atomically if no prior pending record existed
      const referrerUser = await User.findById(referee.referredBy);
      referralRecord = await Referral.create({
        referrerId: referee.referredBy,
        refereeId: referee._id,
        referredEmail: referee.email || '',
        referredName: referee.name || '',
        code: referrerUser?.referralCode || 'REF-REWARD',
        rewardAmount: 200,
        status: ReferralStatus.APPROVED,
        completedAt: new Date(),
        orderId: orderId && Types.ObjectId.isValid(orderId) ? new Types.ObjectId(orderId) : undefined,
      });
    }

    // 4. Give Rs. 200 credit to referrer atomically
    await addCreditInternal(
      referee.referredBy.toString(),
      referralRecord.rewardAmount || 200,
      `Referral Reward: ${referee.name || cleanRefereeEmail || 'Friend'} completed 1st shoe purchase!`,
      `REF-${referralRecord._id.toString()}`
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

    return {
      success: true,
      rewardAmount: referralRecord.rewardAmount || 200,
      referrerId: referee.referredBy.toString(),
      couponCode,
    };
  } catch (error) {
    console.error('[Referral Service] completeReferralInternal error:', error);
    return { success: false, rewardAmount: 0 };
  }
}

/**
 * Internal: Cancel referral - if order is cancelled/returned/refunded.
 * Follows "Financial-First, Status-Last" pattern for resilience in standalone MongoDB.
 */
export async function cancelReferralInternal(
  referredOrderId: string,
  session?: mongoose.ClientSession,
  actorId?: string
): Promise<{ success: boolean; alreadyCancelled?: boolean }> {
  try {
    if (!referredOrderId || typeof referredOrderId !== 'string' || !referredOrderId.trim()) {
      return { success: false };
    }

    const cleanId = referredOrderId.trim();
    const actorInfo = actorId ? ` (Actor: ${actorId})` : '';
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const mockOrder = MockDb.getOrderById(cleanId);
      if (!mockOrder) {
        return { success: false };
      }
      return { success: true };
    }

    return await executeWithOptionalTransaction(async (activeSession) => {
      const currentSession = session || activeSession;

      let orderDoc = null;
      if (Types.ObjectId.isValid(cleanId)) {
        orderDoc = await Order.findById(cleanId).session(currentSession || null).lean();
      }
      if (!orderDoc) {
        orderDoc = await Order.findOne({ orderNumber: cleanId.toUpperCase() }).session(currentSession || null).lean();
      }

      if (!orderDoc) {
        return { success: false };
      }

      // 1. Find the referral record first (without updating it yet)
      const referral = await Referral.findOne({ 
        orderId: (orderDoc as { _id: Types.ObjectId })._id 
      }).session(currentSession || null);

      if (!referral) {
        return { success: false };
      }

      // If already cancelled, return success (Idempotency)
      if (referral.status === ReferralStatus.CANCELLED) {
        return { success: true, alreadyCancelled: true };
      }

      const wasApproved = referral.status === ReferralStatus.APPROVED;
      const refCancelReferenceId = `REF-CANCEL-${referral._id.toString()}`;

      // 2. Perform clawback FIRST (Financial-First)
      // This ensures that if the wallet write succeeds but the status flip fails,
      // a subsequent retry will detect the existing wallet transaction and proceed to flip the status.
      if (wasApproved) {
        const referrerUser = await User.findById(referral.referrerId)
          .select('walletBalance')
          .session(currentSession || null)
          .lean();
        
        const currentBal = referrerUser?.walletBalance || 0;
        const targetReward = referral.rewardAmount || 200;
        const actualDeduction = Math.min(currentBal, targetReward);
        const uncollectedDeficit = targetReward - actualDeduction;

        if (actualDeduction > 0) {
          // addCreditInternal handles its own idempotency check via referenceId
          const creditRes = await addCreditInternal(
            referral.referrerId.toString(),
            -actualDeduction,
            `Referral Cancelled: Clawback PKR ${actualDeduction} for order ${cleanId}${actorInfo}${uncollectedDeficit > 0 ? ` (Uncollected spent reward deficit: PKR ${uncollectedDeficit})` : ''}`,
            refCancelReferenceId,
            TransactionStatus.COMPLETED,
            currentSession
          );
          if (!creditRes.success) {
            throw new Error(`Referral clawback failed: ${creditRes.error}`);
          }
        } else if (uncollectedDeficit > 0) {
          // Record audit ledger entry documenting uncollected spent reward deficit if not already done
          const existingAudit = await WalletTransaction.findOne({
            userId: referral.referrerId,
            referenceId: refCancelReferenceId,
            type: 'debit'
          }).session(currentSession || null);

          if (!existingAudit) {
            try {
              await WalletTransaction.create(
                [
                  {
                    userId: referral.referrerId,
                    amount: 0,
                    type: 'debit',
                    description: `Referral Cancelled for order ${cleanId}${actorInfo}: PKR ${uncollectedDeficit} uncollected deficit (reward already spent)`,
                    referenceId: refCancelReferenceId,
                    balanceAfter: currentBal,
                    status: TransactionStatus.COMPLETED,
                  },
                ],
                currentSession ? { session: currentSession } : {}
              );
            } catch (auditErr) {
              console.warn('[Referral Audit] Failed to record zero-amount uncollected deficit ledger entry:', auditErr);
            }
          }
        }
      }

      // 3. Cancel pending transaction if it exists (Idempotent)
      await WalletTransaction.findOneAndUpdate(
        { referenceId: referral._id.toString(), status: TransactionStatus.PENDING },
        { status: TransactionStatus.CANCELLED },
        { session: currentSession || undefined }
      );

      // 4. Finally, transition referral status to CANCELLED (Status-Last)
      referral.status = ReferralStatus.CANCELLED;
      await (referral as any).save({ session: currentSession || undefined });

      return { success: true };
    }, session);
  } catch (error) {
    if (session) {
      throw error;
    }
    console.error('[Referral Service] cancelReferralInternal error:', error);
    return { success: false };
  }
}
