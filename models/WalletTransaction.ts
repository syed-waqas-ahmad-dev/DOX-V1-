/**
 * @file models/WalletTransaction.ts
 * @description Mongoose schema & model for customer store credit wallet ledger in OX Shoes.
 * Logs credits from referrals, refunds, and debits on checkout orders.
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type HydratedDocument } from 'mongoose';
import { TransactionStatus, type IWalletTransaction } from '@/types';

export type WalletTransactionDocument = HydratedDocument<IWalletTransaction>;
export type WalletTransactionModelType = Model<IWalletTransaction>;

const walletTransactionSchema = new Schema<IWalletTransaction, WalletTransactionModelType>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for wallet transactions'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Transaction amount in PKR is required'],
      min: [1, 'Amount must be at least 1 PKR'],
    },
    type: {
      type: String,
      enum: {
        values: ['credit', 'debit'],
        message: '{VALUE} is not a valid wallet transaction type',
      },
      required: [true, 'Transaction type (credit/debit) is required'],
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required for wallet ledger'],
      trim: true,
    },
    referenceId: {
      type: String,
      trim: true,
      default: null,
    },
    balanceAfter: {
      type: Number,
      required: [true, 'Balance after transaction is required'],
      min: [0, 'Balance after transaction cannot be negative'],
    },
    status: {
      type: String,
      enum: {
        values: Object.values(TransactionStatus),
        message: '{VALUE} is not a valid wallet transaction status',
      },
      default: TransactionStatus.COMPLETED,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'wallet_transactions',
  }
);

walletTransactionSchema.index({ userId: 1, createdAt: -1 });

export const WalletTransaction: WalletTransactionModelType =
  (models.WalletTransaction as WalletTransactionModelType) ||
  model<IWalletTransaction, WalletTransactionModelType>(
    'WalletTransaction',
    walletTransactionSchema
  );

export default WalletTransaction;
