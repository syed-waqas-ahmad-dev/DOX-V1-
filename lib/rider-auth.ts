/**
 * @file lib/rider-auth.ts
 * @description Cryptographic session token signing and verification for OX Shoes delivery riders.
 * Uses HMAC-SHA256 with constant-time equality checks and expiration timestamps.
 * Strict TypeScript: ZERO `any`.
 */

import crypto from 'crypto';

export const RIDER_COOKIE_NAME = 'ox_rider_session';
export const RIDER_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface RiderSessionPayload {
  partnerId: string;
  phone: string;
  role: 'rider';
  iat: number;
  exp: number;
}

/**
 * Resolves and validates the HMAC secret for rider session tokens.
 * Fails closed if NEXTAUTH_SECRET is missing, empty, or whitespace-only.
 * Evaluated lazily at call-time so module-level imports during Next.js build-time
 * static analysis do not crash.
 */
export function getRiderSessionSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    throw new Error('Rider authentication configuration error: NEXTAUTH_SECRET is not configured or empty.');
  }
  return secret;
}

/**
 * Cryptographically sign a rider session payload using HMAC-SHA256.
 * Fails closed with an Error if NEXTAUTH_SECRET is not configured.
 */
export function signRiderPayload(payload: RiderSessionPayload): string {
  const secret = getRiderSessionSecret();
  const jsonStr = JSON.stringify(payload);
  const dataB64 = Buffer.from(jsonStr, 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');
  return `${dataB64}.${signature}`;
}

/**
 * Verify a cryptographically signed rider session token.
 * Validates HMAC signature with constant-time equality check, payload completeness, and expiration.
 * Fails closed (returns null) if secret is missing/unconfigured or signature is invalid.
 */
export function verifyRiderToken(token: string): RiderSessionPayload | null {
  try {
    const secret = getRiderSessionSecret();
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [dataB64, signature] = parts;
    if (!dataB64 || !signature) return null;
    const expectedSig = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');
    if (signature.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }
    const jsonStr = Buffer.from(dataB64, 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr) as RiderSessionPayload;
    if (!payload.partnerId || !payload.exp || Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
