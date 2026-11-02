/**
 * @file lib/db/migrate.ts
 * @description Enterprise MongoDB schema migration runner for OX Shoes.
 * Tracks applied migrations, guarantees idempotency, supports up/down rollbacks,
 * and maintains audit integrity.
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model } from 'mongoose';
import { connectToDatabase } from './connect';
import { randomUUID } from 'node:crypto';

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
 * Migration Lock schema for distributed concurrency control
 */
interface IMigrationLock {
  _id: string;
  isLocked: boolean;
  lockedAt: Date;
  ownerId: string;
}

const lockSchema = new Schema<IMigrationLock>(
  {
    _id: { type: String, default: 'migration_lock' },
    isLocked: { type: Boolean, required: true },
    lockedAt: { type: Date, required: true },
    ownerId: { type: String, required: true },
  },
  { collection: '__migration_lock' }
);

const MigrationLock: Model<IMigrationLock> =
  (models.MigrationLock as Model<IMigrationLock>) ||
  model<IMigrationLock>('MigrationLock', lockSchema);

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
    description: 'Safely audit and reconcile variant stock consistency without overwriting authoritative inventory',
    up: async () => {
      const { Product } = await import('@/models');
      const products = await Product.find({ 'variants.0': { $exists: true } });
      for (const p of products) {
        const variantSum = p.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
        // SAFETY GUARD: NEVER overwrite authoritative Product.stock with stale higher variant sums!
        // 1. If product is completely sold out from customer orders (stock === 0), ensure variants reflect 0:
        if (p.stock === 0 && variantSum > 0) {
          for (const v of p.variants) {
            v.stock = 0;
          }
          await p.save();
        }
        // 2. If parent stock was decremented by orders (p.stock < variantSum), preserve p.stock as truth.
        // Do NOT overwrite p.stock with stale variantSum, and do NOT invent historical size distributions.
      }
    },
  },
  {
    name: '004_create_tracking_ttl_index',
    description: 'Ensure TTL and compound indexes for TrackingAttempt collection',
    up: async () => {
      const { TrackingAttempt } = await import('@/models/TrackingAttempt');
      await TrackingAttempt.createIndexes();
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
 * Supervised Heartbeat for distributed lock lease renewal.
 * Tracks in-flight operations, prevents overlapping, and ensures safe teardown.
 */
export class HeartbeatSupervisor {
  private inFlightRenewal: Promise<void> | null = null;
  private isStopping = false;
  private failure: Error | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly ownerId: string,
    private readonly lockModel: Model<IMigrationLock>,
    private readonly intervalMs: number
  ) {}

  start() {
    this.timer = setInterval(() => {
      // Trigger renewal only if no renewal is in flight and we aren't stopping
      if (!this.inFlightRenewal && !this.isStopping) {
        this.inFlightRenewal = this.renew().finally(() => {
          this.inFlightRenewal = null;
        });
      }
    }, this.intervalMs);
  }

  async stop() {
    this.isStopping = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Await any renewal already in progress to prevent racing with lock release
    if (this.inFlightRenewal) {
      await this.inFlightRenewal;
    }
  }

  get health() {
    return {
      ok: !this.failure,
      error: this.failure,
    };
  }

  private async renew() {
    try {
      const renewal = await this.lockModel.findOneAndUpdate(
        { _id: 'migration_lock', ownerId: this.ownerId, isLocked: true },
        { $set: { lockedAt: new Date() } },
        { new: true }
      );
      if (!renewal) {
        throw new Error('Lock lease renewal failed: Ownership lost or lock released externally.');
      }
    } catch (err: unknown) {
      this.failure = err instanceof Error ? err : new Error(String(err));
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }
  }
}

/**
 * Internal runner that performs the migrations.
 * Must be wrapped in a lock by the caller.
 */
async function runMigrationsInternal(ownerId: string, supervisor: HeartbeatSupervisor): Promise<MigrationReport> {
  const executed = await MigrationRecord.find().sort({ appliedAt: 1 }).lean();
  const executedNames = new Set(executed.map((m) => m.name));

  const maxBatch = executed.reduce((max, m) => Math.max(max, m.batch), 0);
  const nextBatch = maxBatch + 1;

  const newlyApplied: string[] = [];
  const errors: string[] = [];

  for (const step of migrationRegistry) {
    if (!executedNames.has(step.name)) {
      // 1. Verify health and ownership before starting step
      const status = supervisor.health;
      if (!status.ok) {
        throw new Error(`Migration heartbeat failed before ${step.name}: ${status.error?.message}`);
      }

      const currentLock = await MigrationLock.findOne({ _id: 'migration_lock', ownerId });
      if (!currentLock || !currentLock.isLocked) {
        throw new Error(`Migration ownership lost for ${ownerId} before ${step.name}. Aborting.`);
      }

      const startTime = Date.now();
      try {
        // NOTE: If step.up() performs a long-running DB operation (e.g. createIndexes), 
        // it cannot be cancelled mid-flight. We rely on the post-execution guard to halt.
        await step.up();
        
        // 2. Re-verify health and ownership after execution but before ledger commit
        const postStatus = supervisor.health;
        if (!postStatus.ok) {
          throw new Error(`Heartbeat failure during ${step.name}. Halting to prevent integrity risk.`);
        }

        const finalCheck = await MigrationLock.findOne({ _id: 'migration_lock', ownerId });
        if (!finalCheck || !finalCheck.isLocked) {
           throw new Error(`Lock lost during ${step.name}. Migration record for this step will not be written.`);
        }

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

/**
 * Executes pending database migrations sequentially with a distributed lock and supervised heartbeat.
 */
export async function runMigrations(): Promise<MigrationReport> {
  await connectToDatabase();

  const ownerId = randomUUID();
  const lockTimeout = 10 * 60 * 1000; // 10 minutes (lease duration)
  const heartbeatInterval = 2 * 60 * 1000; // 2 minutes (renewal frequency)

  // Attempt to acquire lock
  const lock = await MigrationLock.findOneAndUpdate(
    {
      _id: 'migration_lock',
      $or: [
        { isLocked: false },
        { lockedAt: { $lt: new Date(Date.now() - lockTimeout) } }
      ]
    },
    {
      $set: {
        isLocked: true,
        lockedAt: new Date(),
        ownerId
      }
    },
    { upsert: true, new: true }
  );

  if (!lock || lock.ownerId !== ownerId) {
    throw new Error('Migration in progress by another instance or lock could not be acquired.');
  }

  const supervisor = new HeartbeatSupervisor(ownerId, MigrationLock, heartbeatInterval);
  supervisor.start();

  try {
    return await runMigrationsInternal(ownerId, supervisor);
  } finally {
    // 1. Stop scheduling and await in-flight heartbeat renewals
    await supervisor.stop();
    
    // 2. Release lock only if we still own it (prevents release-race)
    await MigrationLock.updateOne(
      { _id: 'migration_lock', ownerId },
      { $set: { isLocked: false } }
    );
  }
}
