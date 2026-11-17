/**
 * @file lib/guest-order-token.ts
 * @description Cryptographically signed short-lived tokens for guest order verification
 * and COD OTP verification tokens. Uses HMAC-SHA256 with constant-time equality checks.
 * Strict TypeScript: ZERO `any`.
 */

import crypto from 'crypto';
import { canUseMockDatabase } from '@/lib/db/connect';

const GUEST_ORDER_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const COD_OTP_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function getSecretKey(): string {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (secret) {
    return secret;
  }
  if (canUseMockDatabase()) {
    return 'ox_shoes_offline_dev_token_secret_32bytes_min';
  }
  throw new Error('Server configuration error: NEXTAUTH_SECRET is required to sign tokens in production.');
}

export interface GuestOrderTokenPayload {
  orderId: string;
  orderNumber: string;
  iat: number;
  exp: number;
}

export interface CodOtpTokenPayload {
  phone: string;
  jti?: string;
  iat: number;
  exp: number;
}

declare global {
  var __oxUsedCodOtpJtis: Map<string, number> | undefined;
}

const usedCodOtpJtis = global.__oxUsedCodOtpJtis ?? new Map<string, number>();
if (!global.__oxUsedCodOtpJtis) {
  global.__oxUsedCodOtpJtis = usedCodOtpJtis;
}

function pruneExpiredCodOtpJtis(now: number): void {
  for (const [jti, exp] of usedCodOtpJtis.entries()) {
    if (now > exp) {
      usedCodOtpJtis.delete(jti);
    }
  }
}

/**
 * Signs a guest order access token bound to the specific order ID and order number.
 */
export function signGuestOrderToken(orderId: string, orderNumber: string): string {
  const secret = getSecretKey();
  const payload: GuestOrderTokenPayload = {
    orderId: orderId.trim(),
    orderNumber: orderNumber.trim().toUpperCase(),
    iat: Date.now(),
    exp: Date.now() + GUEST_ORDER_TOKEN_TTL_MS,
  };
  const jsonStr = JSON.stringify(payload);
  const dataB64 = Buffer.from(jsonStr, 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');
  return `${dataB64}.${signature}`;
}

/**
 * Verifies a guest order access token against the target order ID and order number.
 * Fails closed if expired, signature mismatch, or order identifier mismatch.
 */
export function verifyGuestOrderToken(
  token: string | undefined | null,
  expectedOrderId: string,
  expectedOrderNumber: string
): boolean {
  if (!token || typeof token !== 'string') return false;
  try {
    const secret = getSecretKey();
    const parts = token.trim().split('.');
    if (parts.length !== 2) return false;
    const [dataB64, signature] = parts;
    if (!dataB64 || !signature) return false;

    const expectedSig = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');
    if (signature.length !== expectedSig.length) return false;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return false;
    }

    const jsonStr = Buffer.from(dataB64, 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr) as GuestOrderTokenPayload;

    if (!payload.orderId || !payload.orderNumber || !payload.exp) return false;
    if (Date.now() > payload.exp) return false;

    const matchesId = payload.orderId.toLowerCase() === expectedOrderId.trim().toLowerCase();
    const matchesNumber = payload.orderNumber.toUpperCase() === expectedOrderNumber.trim().toUpperCase();

    return matchesId && matchesNumber;
  } catch {
    return false;
  }
}

/**
 * Signs an HMAC token certifying that the customer's phone number was verified via OTP.
 * Includes a unique `jti` nonce for replay prevention.
 */
export function signCodOtpToken(phone: string): string {
  const secret = getSecretKey();
  const payload: CodOtpTokenPayload = {
    phone: phone.trim(),
    jti: crypto.randomUUID(),
    iat: Date.now(),
    exp: Date.now() + COD_OTP_TOKEN_TTL_MS,
  };
  const jsonStr = JSON.stringify(payload);
  const dataB64 = Buffer.from(jsonStr, 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');
  return `${dataB64}.${signature}`;
}

function parseVerifiedCodOtpPayload(
  token: string | undefined | null,
  expectedPhone: string
): CodOtpTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  try {
    const secret = getSecretKey();
    const parts = token.trim().split('.');
    if (parts.length !== 2) return null;
    const [dataB64, signature] = parts;
    if (!dataB64 || !signature) return null;

    const expectedSig = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');
    if (signature.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const jsonStr = Buffer.from(dataB64, 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr) as CodOtpTokenPayload;

    const now = Date.now();
    if (!payload.phone || !payload.exp || !payload.jti) return null;
    if (now > payload.exp) return null;

    pruneExpiredCodOtpJtis(now);
    if (usedCodOtpJtis.has(payload.jti)) {
      return null;
    }

    const normTokenPhone = payload.phone.replace(/\D/g, '');
    const normExpectedPhone = expectedPhone.replace(/\D/g, '');
    if (!normTokenPhone || normTokenPhone !== normExpectedPhone) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Verifies that a COD OTP token is valid, unconsumed, unexpired, and belongs to the given phone number.
 */
export function verifyCodOtpToken(token: string | undefined | null, expectedPhone: string): boolean {
  return parseVerifiedCodOtpPayload(token, expectedPhone) !== null;
}

/**
 * Atomically verifies and reserves a COD OTP token for single-use consumption.
 * Prevents concurrent or sequential replay of the same OTP token across orders.
 */
export function consumeCodOtpToken(
  token: string | undefined | null,
  expectedPhone: string
): { valid: boolean; jti?: string } {
  const payload = parseVerifiedCodOtpPayload(token, expectedPhone);
  if (!payload || !payload.jti) {
    return { valid: false };
  }
  usedCodOtpJtis.set(payload.jti, payload.exp);
  return { valid: true, jti: payload.jti };
}

/**
 * Releases a reserved COD OTP token `jti` if the order failed before persistence,
 * allowing the customer to fix a transient error without re-requesting SMS OTP.
 */
export function releaseCodOtpToken(jti: string | undefined | null): void {
  if (jti) {
    usedCodOtpJtis.delete(jti);
  }
}
