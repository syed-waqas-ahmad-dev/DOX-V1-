import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';
import crypto from 'crypto';

/**
 * @file app/api/debug/cloudinary/route.ts
 * @description RESTRICTED forensic diagnostic endpoint to test signed Cloudinary uploads,
 * verify runtime credentials against historical signature parameters, and inspect API errors.
 * SUPER ADMIN ONLY.
 * Includes automatic cleanup of diagnostic assets to prevent accumulation.
 */

export const runtime = 'nodejs';

const EXPECTED_CLOUD_NAME = 'kbh75mm9';
const HISTORICAL_FOLDER = 'dawood-ox/about';
const HISTORICAL_TIMESTAMP = 1794574499;
const HISTORICAL_EXPECTED_SIGNATURE = 'f0ef573ce2078a1936b8c265b2d13e7c8a25cc3b';

function timingSafeHexMatch(actualHex: string, expectedHex: string): boolean {
  if (!actualHex || !expectedHex || actualHex.length !== expectedHex.length) {
    return false;
  }
  return crypto.timingSafeEqual(
    Buffer.from(actualHex, 'utf8'),
    Buffer.from(expectedHex, 'utf8')
  );
}

function sanitizeCloudinaryText(text: string): string {
  return text.replace(/\b(Invalid Signature[:\s]+)[a-fA-F0-9]{32,64}\b/gi, '$1[REDACTED]');
}

/**
 * GET requests are rejected with 405 Method Not Allowed to prevent accidental invocation.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed. Send a POST request with Super Admin authentication to execute Cloudinary diagnostics.' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

/**
 * POST /api/debug/cloudinary
 * Executes:
 * 1. Read-only historical signature verification against runtime CLOUDINARY_API_SECRET.
 * 2. Safe configuration hygiene checks (without exposing secrets).
 * 3. Controlled signed 1x1 test upload with automatic cleanup.
 */
export async function POST(_req: NextRequest) {
  try {
    // 1. Authorization Guard: SUPER ADMIN ONLY
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized. Super Admin only.' }, { status: 403 });
    }

    const rawCloudName = process.env.CLOUDINARY_CLOUD_NAME ?? '';
    const rawApiKey = process.env.CLOUDINARY_API_KEY ?? '';
    const rawApiSecret = process.env.CLOUDINARY_API_SECRET ?? '';
    const rawCloudinaryUrl = process.env.CLOUDINARY_URL ?? '';

    const cloudName = rawCloudName.trim();
    const apiKey = rawApiKey.trim();
    const apiSecret = rawApiSecret.trim();

    const configDiagnostics = {
      cloudNameMatchesExpected: cloudName === EXPECTED_CLOUD_NAME,
      apiKeyExists: Boolean(apiKey),
      apiSecretExists: Boolean(apiSecret),
      secretLength: apiSecret.length,
      secretHasSurroundingQuotes: /^["']|["']$/.test(apiSecret),
      secretHasLeadingOrTrailingWhitespace: rawApiSecret !== apiSecret,
      cloudinaryUrlExists: Boolean(rawCloudinaryUrl.trim()),
    };

    if (!isCloudinaryConfigured() || !cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        {
          success: false,
          runtimeMatchesHistoricalSignature: false,
          liveUploadSuccess: false,
          cleanupSuccess: false,
          configDiagnostics,
          error: 'Cloudinary environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are missing or incomplete.',
        },
        { status: 500 }
      );
    }

    // 2. Historical signature reproduction check (internal only; never return or log computed signature)
    const historicalComputedSignature = cloudinary.utils.api_sign_request(
      {
        folder: HISTORICAL_FOLDER,
        timestamp: HISTORICAL_TIMESTAMP,
      },
      apiSecret
    );
    const runtimeMatchesHistoricalSignature = timingSafeHexMatch(
      historicalComputedSignature,
      HISTORICAL_EXPECTED_SIGNATURE
    );

    // 3. Prepare signed live test parameters without upload_preset
    const timestamp = Math.round(Date.now() / 1000);
    const folder = 'ox_products';
    const paramsToSign: Record<string, string | number> = {
      folder,
      timestamp,
    };

    // 4. Cryptographically sign request using SDK utility
    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    // 5. Construct Multipart FormData payload for raw HTTP inspection
    const formData = new FormData();
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    formData.append('folder', folder);

    // Tiny 1x1 transparent PNG pixel as test payload
    const pixelBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BvAAMDAgBqA9LzAAAAAElFTkSuQmCC';
    const pixelBlob = await (await fetch(`data:image/png;base64,${pixelBase64}`)).blob();
    formData.append('file', pixelBlob, 'debug_pixel.png');

    // 6. Execute raw request to capture unredacted HTTP status & headers
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    console.info('[Cloudinary Forensic Debug]: Executing signed test upload to Cloudinary...');

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    const responseStatus = response.status;
    const responseHeaders = Object.fromEntries(response.headers.entries());
    let responseBody: Record<string, unknown> | string;

    try {
      responseBody = await response.json();
    } catch {
      responseBody = await response.text();
    }

    let publicId: string | null = null;
    let cleanupSuccess = false;
    let cleanupError: string | null = null;

    // 7. Automatic Asset Cleanup
    if (typeof responseBody === 'object' && responseBody !== null && 'public_id' in responseBody) {
      publicId = String(responseBody.public_id);
      try {
        console.info(`[Cloudinary Forensic Debug]: Cleaning up test asset (${publicId})...`);
        const destroyRes = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
        cleanupSuccess = destroyRes?.result === 'ok' || destroyRes?.result === 'not_found';
      } catch (destroyErr: unknown) {
        cleanupError = destroyErr instanceof Error ? destroyErr.message : 'Asset cleanup failed';
        console.warn(`[Cloudinary Forensic Debug]: Cleanup failed for test asset ${publicId}:`, destroyErr);
      }
    }

    // Sanitize responseBody to avoid echoing any signature or key fields
    let sanitizedRawBody: Record<string, unknown> | string =
      typeof responseBody === 'string' ? sanitizeCloudinaryText(responseBody) : responseBody;
    if (typeof responseBody === 'object' && responseBody !== null) {
      const copy: Record<string, unknown> = { ...responseBody };
      delete copy.signature;
      delete copy.api_key;
      if (typeof copy.error === 'object' && copy.error !== null) {
        const errCopy = { ...(copy.error as Record<string, unknown>) };
        if (typeof errCopy.message === 'string') {
          errCopy.message = sanitizeCloudinaryText(errCopy.message);
        }
        copy.error = errCopy;
      }
      sanitizedRawBody = copy;
    }

    const rawErrMsg =
      typeof responseBody === 'object' && responseBody?.error
        ? String((responseBody.error as Record<string, unknown>).message ?? 'None')
        : 'None';

    const rawXCldError = responseHeaders['x-cld-error'];
    const xCldError = rawXCldError ? sanitizeCloudinaryText(rawXCldError) : 'None';

    // 8. Return sanitized forensic report (NO SECRETS OR SIGNATURES EXPOSED)
    const report = {
      success: response.ok,
      runtimeMatchesHistoricalSignature,
      liveUploadSuccess: response.ok,
      cleanupSuccess,
      historicalSignatureCheck: {
        folder: HISTORICAL_FOLDER,
        timestamp: HISTORICAL_TIMESTAMP,
        runtimeMatchesHistoricalSignature,
      },
      configDiagnostics,
      httpStatus: responseStatus,
      cloudinaryError: rawErrMsg === 'None' ? 'None' : sanitizeCloudinaryText(rawErrMsg),
      xCldError,
      rawBody: sanitizedRawBody,
      cleanup: {
        executed: Boolean(publicId),
        testPublicId: publicId,
        cleanedUp: cleanupSuccess,
        cleanupError,
      },
      diagnosticHeaders: {
        'x-request-id': responseHeaders['x-request-id'],
        'content-type': responseHeaders['content-type'],
      },
      requestDetails: {
        cloudName,
        timestamp,
        folder,
        hasSignature: Boolean(signature),
      },
    };

    console.info('[Cloudinary Forensic Debug Report]:', report);
    return NextResponse.json(report, { status: response.ok ? 200 : responseStatus });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Forensic diagnostic failed';
    console.error('[Cloudinary Forensic Debug Error]:', error);
    return NextResponse.json({ error: 'Forensic diagnostic execution error', message: msg }, { status: 500 });
  }
}
