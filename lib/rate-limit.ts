/**
 * @file lib/rate-limit.ts
 * @description Lightweight in-memory sliding window rate limiter for auth, OTP, and checkout.
 * Strict TypeScript: ZERO `any`.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

export async function rateLimit(
  identifier: string,
  limit = 10,
  windowMs = 60000
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const record = memoryStore.get(identifier);

  if (!record || now > record.resetAt) {
    const newRecord: RateLimitRecord = {
      count: 1,
      resetAt: now + windowMs,
    };
    memoryStore.set(identifier, newRecord);
    return {
      success: true,
      remaining: limit - 1,
      resetAt: newRecord.resetAt,
    };
  }

  if (record.count >= limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: record.resetAt,
    };
  }

  record.count += 1;
  return {
    success: true,
    remaining: limit - record.count,
    resetAt: record.resetAt,
  };
}
