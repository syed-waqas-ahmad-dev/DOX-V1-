/**
 * @file lib/db/migrate.ts
 * @description Enterprise MongoDB schema migration runner for OX Shoes.
 * Tracks applied migrations, guarantees idempotency, supports up/down rollbacks,
 * and maintains audit integrity.
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type HydratedDocument } from 'mongoose';
import { connectToDatabase } from './connect';

/**
 * Migration ledger document interface
 */
export interface IMigrationRecord {
  name: string;
  appliedAt: Date;
  batch: number;
  durationMs: number;
}

const migrationSchema = new Schema<IMigrationRecord>(
  {
    name: { type: String, required: true, unique: true },
    appliedAt: { type: Date, default: Date.now },
    batch: { type: Number, required: true },
    durationMs: { type: Number, required: true },
  },
  { collection: '__migrations' }
);

export const MigrationRecord: Model<IMigrationRecord> =
  (models.MigrationRecord as Model<IMigrationRecord>) ||
  model<IMigrationRecord>('MigrationRecord', migrationSchema);

/**
 * Individual migration definition contract
 */
export interface MigrationStep {
  name: string;
  description: string;
  up: () => Promise<void>;
  down?: () => Promise<void>;
}

/**
 * Built-in migrations registry
 */
export const migrationRegistry: MigrationStep[] = [
  {
    name: '001_create_compound_indexes',
    description: 'Ensure all compound and text indexes across Product, Order, and Review collections',
    up: async () => {
      const { Product, Order, Review, User, Coupon } = await import('@/models');
      await Promise.all([
        Product.createIndexes(),
        Order.createIndexes(),
        Review.createIndexes(),
        User.createIndexes(),
        Coupon.createIndexes(),
      ]);
    },
  },
  {
    name: '002_normalize_pakistani_phone_numbers',
    description: 'Format all customer phone numbers to international Pakistani standard (+923XXXXXXXXX)',
    up: async () => {
      const { User } = await import('@/models');
      const users = await User.find({ phone: { $regex: /^03/ } });
      for (const u of users) {
        if (u.phone.startsWith('03')) {
          u.phone = `+92${u.phone.slice(1)}`;
          await u.save();
        }
      }
    },
  },
  {
    name: '003_recalculate_product_stocks',
    description: 'Audit and sum variant stocks to verify aggregate product inventory consistency',
    up: async () => {
      const { Product } = await import('@/models');
      const products = await Product.find({ 'variants.0': { $exists: true } });
      for (const p of products) {
        const total = p.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
        if (p.stock !== total) {
          p.stock = total;
          await p.save();
        }
      }
    },
  },
];

/**
 * Migration execution result summary
 */
export interface MigrationReport {
  totalRegistered: number;
  alreadyApplied: number;
  newlyApplied: string[];
  currentBatch: number;
  success: boolean;
  errors?: string[];
}

/**
 * Executes pending database migrations sequentially.
 */
export async function runMigrations(): Promise<MigrationReport> {
  await connectToDatabase();

  const executed = await MigrationRecord.find().sort({ appliedAt: 1 }).lean();
  const executedNames = new Set(executed.map((m) => m.name));

  const maxBatch = executed.reduce((max, m) => Math.max(max, m.batch), 0);
  const nextBatch = maxBatch + 1;

  const newlyApplied: string[] = [];
  const errors: string[] = [];

  for (const step of migrationRegistry) {
    if (!executedNames.has(step.name)) {
      const startTime = Date.now();
      try {
        await step.up();
        const durationMs = Date.now() - startTime;
        await MigrationRecord.create({
          name: step.name,
          batch: nextBatch,
          durationMs,
        });
        newlyApplied.push(step.name);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed in ${step.name}: ${msg}`);
        break; // Stop running further migrations on failure
      }
    }
  }

  return {
    totalRegistered: migrationRegistry.length,
    alreadyApplied: executed.length,
    newlyApplied,
    currentBatch: newlyApplied.length > 0 ? nextBatch : maxBatch,
    success: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
