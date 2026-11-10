import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';

/**
 * @file app/api/debug/cloudinary/route.ts
 * @description RESTRICTED forensic diagnostic endpoint to test signed Cloudinary uploads and inspect API errors.
 * SUPER ADMIN ONLY.
 * Includes automatic cleanup of diagnostic assets to prevent accumulation.
 */

export const runtime = 'nodejs';

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
 * Executes a controlled signed test upload and automatically destroys the created asset.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authorization Guard: SUPER ADMIN ONLY
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized. Super Admin only.' }, { status: 403 });
    }

    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        { error: 'Cloudinary environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are missing or incomplete.' },
        { status: 500 }
      );
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME!.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY!.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET!.trim();

    // 2. Prepare signed parameters with intended upload_preset (ox_signed)
    const timestamp = Math.round(Date.now() / 1000);
    const folder = 'ox_debug_test';
    const presetName = process.env.CLOUDINARY_UPLOAD_PRESET?.trim() || 'ox_signed';

    const paramsToSign: Record<string, string | number> = {
      folder,
      timestamp,
      ...(presetName ? { upload_preset: presetName } : {}),
    };

    // 3. Cryptographically sign request using SDK utility
    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    // 4. Construct Multipart FormData payload for raw HTTP inspection
    const formData = new FormData();
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    formData.append('folder', folder);
    if (presetName) {
      formData.append('upload_preset', presetName);
    }

    // Tiny 1x1 transparent PNG pixel as test payload
    const pixelBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BvAAMDAgBqA9LzAAAAAElFTkSuQmCC';
    const pixelBlob = await (await fetch(`data:image/png;base64,${pixelBase64}`)).blob();
    formData.append('file', pixelBlob, 'debug_pixel.png');

    // 5. Execute raw request to capture unredacted HTTP status & headers
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

    // 6. Automatic Asset Cleanup
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

    // 7. Return sanitized forensic report (NO SECRETS EXPOSED)
    const report = {
      success: response.ok,
      httpStatus: responseStatus,
      cloudinaryError: typeof responseBody === 'object' && responseBody?.error ? (responseBody.error as Record<string, unknown>).message : 'None',
      xCldError: responseHeaders['x-cld-error'] || 'None',
      rawBody: responseBody,
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
