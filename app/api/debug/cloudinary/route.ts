import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { v2 as cloudinary } from 'cloudinary';

/**
 * @file app/api/debug/cloudinary/route.ts
 * @description RESTRICTED forensic diagnostic endpoint to capture raw Cloudinary 403 reasons.
 * SUPER ADMIN ONLY.
 */

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    // 1. Authorization: SUPER ADMIN ONLY
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized. Super Admin only.' }, { status: 403 });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Missing Cloudinary environment variables.' }, { status: 500 });
    }

    // 2. Prepare minimal signed upload parameters
    const timestamp = Math.round(new Date().getTime() / 1000);
    const params: Record<string, any> = {
      timestamp,
      folder: 'ox_debug_test',
      // We explicitly include upload_preset if that's what the app uses, 
      // but often for signed uploads it's not strictly required unless forced.
      upload_preset: 'ml_default',
    };

    // 3. Generate signature using SDK utility (safe, does not expose secret)
    const signature = cloudinary.utils.api_sign_request(params, apiSecret);

    // 4. Construct form data for raw fetch
    const formData = new FormData();
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    formData.append('folder', params.folder);
    formData.append('upload_preset', params.upload_preset);
    
    // Tiny 1x1 transparent PNG pixel as test file
    const pixelBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BvAAMDAgBqA9LzAAAAAElFTkSuQmCC';
    const pixelBlob = await (await fetch(`data:image/png;base64,${pixelBase64}`)).blob();
    formData.append('file', pixelBlob, 'debug_pixel.png');

    // 5. Execute raw request to bypass SDK's restrictive 403 handling
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    
    console.info('[Forensic Debug]: Attempting raw authenticated upload to Cloudinary...', { uploadUrl });

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    const responseStatus = response.status;
    const responseHeaders = Object.fromEntries(response.headers.entries());
    let responseBody: any;

    try {
      responseBody = await response.json();
    } catch (e) {
      responseBody = await response.text();
    }

    // 6. Forensic Report (Sanitized: NO SECRET, NO API_KEY in output)
    const report = {
      success: response.ok,
      httpStatus: responseStatus,
      cloudinaryError: responseBody?.error?.message || 'None',
      xCldError: responseHeaders['x-cld-error'] || 'None',
      rawBody: responseBody,
      diagnosticHeaders: {
        'x-request-id': responseHeaders['x-request-id'],
        'content-type': responseHeaders['content-type'],
      },
      requestDetails: {
        cloudName,
        timestamp,
        folder: params.folder,
        hasSignature: !!signature,
      }
    };

    console.info('[Forensic Debug Result]:', report);

    return NextResponse.json(report);

  } catch (error: any) {
    console.error('[Forensic Debug Critical Failure]:', error);
    return NextResponse.json({ 
      error: 'Forensic diagnostic failed', 
      message: error.message 
    }, { status: 500 });
  }
}
