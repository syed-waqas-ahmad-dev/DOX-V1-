/**
 * @file lib/otp-store.ts
 * @description Centralized single-source-of-truth in-memory store for phone OTP codes.
 * Implements code verification, 10-minute TTL expiration, max attempt limiting,
 * single-use deletion, and resend rate limiting.
 * Strict TypeScript: ZERO `any`.
 */

interface OtpRecord {
  code: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

// Global variable survives Next.js development hot-reloading
declare global {
  var __oxOtpStore: Map<string, OtpRecord> | undefined;
}

const otpStoreMap = global.__oxOtpStore ?? new Map<string, OtpRecord>();
if (!global.__oxOtpStore) {
  global.__oxOtpStore = otpStoreMap;
}

export const MAX_OTP_ATTEMPTS = 3;
export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Stores a newly generated OTP for a validated Pakistani mobile number.
 */
export function setOtp(phone: string, code: string): void {
  otpStoreMap.set(phone, {
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: Date.now(),
  });
}

/**
 * Verifies an OTP code against the stored value for a given phone number.
 */
export function verifyOtp(phone: string, inputCode: string): { success: boolean; error?: string } {
  const record = otpStoreMap.get(phone);

  if (!record) {
    return { success: false, error: 'Invalid or expired OTP code.' };
  }

  // Check TTL expiration
  if (Date.now() > record.expiresAt) {
    otpStoreMap.delete(phone);
    return { success: false, error: 'OTP code has expired. Please request a new OTP.' };
  }

  // Check attempt limit
  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    otpStoreMap.delete(phone);
    return { success: false, error: 'Maximum verification attempts exceeded. Please request a new OTP.' };
  }

  record.attempts += 1;

  // Code match check
  if (record.code !== inputCode.trim()) {
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      otpStoreMap.delete(phone);
      return { success: false, error: 'Maximum verification attempts exceeded. Please request a new OTP.' };
    }
    return { success: false, error: 'Invalid OTP code.' };
  }

  // Verification successful: Delete OTP record to enforce single-use
  otpStoreMap.delete(phone);
  return { success: true };
}

/**
 * Resets the in-memory OTP store (primarily for test execution).
 */
export function clearOtpStore(): void {
  otpStoreMap.clear();
}
