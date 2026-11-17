import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminAuth } from '@/lib/auth-guard';
import { cloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';

/**
 * @file app/api/debug/cloudinary/route.ts
 * @description Hardened diagnostic endpoint for Cloudinary configuration health check.
 * Strictly limited to Super Administrators via database-verified authorization.
 * ZERO disclosure of secrets, keys, signatures, or payload contents.
 * Strict TypeScript: ZERO `any`.
 */

export const runtime = 'nodejs';

/**
 * GET requests are rejected with 405 Method Not Allowed.
 */
export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed. Send a POST request with Super Admin authentication to execute diagnostics.' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

/**
 * POST /api/debug/cloudinary
 * Authenticated Super Admin-only health probe for Cloudinary.
 */
export async function POST(_req: NextRequest) {
  try {
    const auth = await verifySuperAdminAuth();
    if (!auth.authorized) {
      if (auth.error?.includes('Unauthenticated') || auth.error?.includes('Valid session required')) {
        return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required.' }, { status: 401 });
      }
      if (auth.error?.includes('Database')) {
        return NextResponse.json({ success: false, error: 'Database connection unavailable.' }, { status: 503 });
      }
      return NextResponse.json({ success: false, error: 'Forbidden: Super Administrator privilege required.' }, { status: 403 });
    }

    const isConfigured = isCloudinaryConfigured();
    const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
    const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
    const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();

    if (!isConfigured || !cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        {
          success: false,
          isConfigured: false,
          error: 'Cloudinary environment variables are missing or incomplete.',
        },
        { status: 500 }
      );
    }

    // Prepare signed live test parameters
    const timestamp = Math.round(Date.now() / 1000);
    const folder = 'ox_diagnostics';
    const paramsToSign: Record<string, string | number> = {
      folder,
      timestamp,
    };

    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    const formData = new FormData();
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    formData.append('folder', folder);

    // 1x1 transparent pixel test payload
    const pixelBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BvAAMDAgBqA9LzAAAAAElFTkSuQmCC';
    const pixelBlob = await (await fetch(`data:image/png;base64,${pixelBase64}`)).blob();
    formData.append('file', pixelBlob, 'debug_pixel.png');

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    let cleanupSuccess = false;
    let responseBody: Record<string, unknown> | null = null;

    try {
      responseBody = (await response.json()) as Record<string, unknown>;
    } catch {
      responseBody = null;
    }

    if (responseBody && typeof responseBody.public_id === 'string') {
      const publicId = responseBody.public_id;
      try {
        const destroyRes = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
        cleanupSuccess = destroyRes?.result === 'ok' || destroyRes?.result === 'not_found';
      } catch {
        cleanupSuccess = false;
      }
    }

    return NextResponse.json({
      success: response.ok,
      isConfigured: true,
      uploadSuccess: response.ok,
      cleanupSuccess,
      status: response.status,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Diagnostic execution error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}