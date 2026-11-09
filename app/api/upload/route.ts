import { NextRequest, NextResponse } from 'next/server';
import { cloudinary } from '@/lib/cloudinary';
import { verifyDepartmentAuth } from '@/lib/auth-guard';
import { Department } from '@/types';

/**
 * @file app/api/upload/route.ts
 * @description Secure server-side image upload handler using Cloudinary Signed Uploads.
 * Enforces strict authorization and validates file integrity.
 */

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // 1. Authorization Check
    // Managers in INVENTORY department with 'products:write' or SUPER_ADMIN/ADMIN are allowed.
    const auth = await verifyDepartmentAuth({
      requiredDepartment: Department.INVENTORY,
      requiredPermission: 'products:write',
    });

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized: Product write clearance required.' },
        { status: 403 }
      );
    }

    // 2. Parse FormData
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'ox_secure';

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    // 3. Basic File Validation
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit.' },
        { status: 400 }
      );
    }

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and AVIF are allowed.' },
        { status: 400 }
      );
    }

    // 4. Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 5. Secure Signed Upload via SDK
    // Using 'ml_default' signed preset if compatible, otherwise standard signed upload.
    // The Cloudinary SDK automatically handles signature generation on the server.
    return new Promise<NextResponse>((resolve) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          upload_preset: 'ml_default',
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) {
            const errObj = (error || {}) as Record<string, unknown>;
            const httpCode = typeof errObj.http_code === 'number' ? errObj.http_code : undefined;
            const rawMessage = error?.message || 'Empty response received from Cloudinary API';
            const errorName = error?.name || 'CloudinaryError';
            
            const headers = (errObj.headers || {}) as Record<string, unknown>;
            const xCldError =
              (typeof errObj.x_cld_error === 'string' ? errObj.x_cld_error : undefined) ||
              (typeof headers['x-cld-error'] === 'string' ? headers['x-cld-error'] : undefined);

            console.error('[CLOUDINARY UPLOAD ERROR]', {
              message: rawMessage,
              http_code: httpCode,
              name: errorName,
              x_cld_error: xCldError,
              folder,
            });
            
            let userFacingMessage = `Cloudinary upload failed (HTTP ${httpCode || 'unknown'}): ${rawMessage}`;
            if (xCldError) {
              userFacingMessage += ` [Detail: ${xCldError}]`;
            }

            return resolve(
              NextResponse.json(
                { error: userFacingMessage },
                { status: httpCode || 500 }
              )
            );
          }

          resolve(
            NextResponse.json({
              success: true,
              secure_url: result?.secure_url,
              public_id: result?.public_id,
            })
          );
        }
      );

      uploadStream.end(buffer);
    });
  } catch (error: any) {
    console.error('[UPLOAD ROUTE ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error during upload.' },
      { status: 500 }
    );
  }
}
