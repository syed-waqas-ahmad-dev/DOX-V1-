import 'server-only';

/**
 * @file lib/delivery-partner-upload.server.ts
 * @description Server-only Cloudinary upload and orphan asset cleanup helpers for delivery partner photos.
 * Reuses the single configured Cloudinary client from lib/cloudinary.ts without exposing credentials.
 * Strict TypeScript: ZERO `any`.
 */

import crypto from 'crypto';
import { cloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';
import { DELIVERY_PARTNER_CLOUDINARY_FOLDER } from '@/lib/delivery-partner-photo-validation';

export interface CloudinaryRiderPhotoResult {
  secureUrl: string;
  publicId: string;
}

/**
 * Uploads a validated image buffer directly to Cloudinary inside the delivery-partners folder
 * using a unique UUID public_id so assets are never accidentally overwritten.
 */
export async function uploadRiderPhotoBufferToCloudinary(
  buffer: Buffer
): Promise<CloudinaryRiderPhotoResult> {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      'Image upload service is not configured on the server. Please verify Cloudinary configuration.'
    );
  }

  const uniquePublicId = `rider-${crypto.randomUUID()}`;

  return new Promise<CloudinaryRiderPhotoResult>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: DELIVERY_PARTNER_CLOUDINARY_FOLDER,
        public_id: uniquePublicId,
        resource_type: 'image',
        overwrite: false,
        unique_filename: true,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      },
      (error, result) => {
        if (error || !result) {
          const errObj = (error || {}) as Record<string, unknown>;
          const httpCode = typeof errObj.http_code === 'number' ? errObj.http_code : undefined;
          const rawMessage = error?.message || 'Empty response received from Cloudinary API';

          console.error('[DeliveryPartner Cloudinary Upload Error]:', {
            message: rawMessage,
            httpCode,
            folder: DELIVERY_PARTNER_CLOUDINARY_FOLDER,
            bufferSizeBytes: buffer.length,
          });

          reject(new Error(`Cloudinary upload failed: ${rawMessage}`));
          return;
        }

        if (
          typeof result.secure_url !== 'string' ||
          !result.secure_url.startsWith('https://') ||
          typeof result.public_id !== 'string' ||
          !result.public_id
        ) {
          reject(new Error('Cloudinary returned an incomplete image URL response.'));
          return;
        }

        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Best-effort cleanup of a Cloudinary rider photo asset (e.g., if DB persistence fails after upload,
 * or after a replacement photo has been persisted in MongoDB). Never throws.
 */
export async function destroyRiderPhotoFromCloudinary(publicId: string): Promise<void> {
  if (!publicId || !isCloudinaryConfigured()) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[DeliveryPartner Cloudinary Cleanup Warning]:', { publicId, message });
  }
}

/**
 * Safely extracts a delivery-partner Cloudinary public_id from an existing hosted URL,
 * scoped strictly to our configured cloud and delivery-partners folder.
 */
export function extractDeliveryPartnerPublicIdFromUrl(url: string | undefined | null): string | null {
  if (!url || typeof url !== 'string') return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') {
      return null;
    }

    const marker = '/image/upload/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex < 0) return null;

    let remainder = parsed.pathname.slice(markerIndex + marker.length);
    // Strip optional version prefix (e.g. v1731800000/)
    remainder = remainder.replace(/^v\d+\//, '');

    if (!remainder.startsWith(`${DELIVERY_PARTNER_CLOUDINARY_FOLDER}/`)) {
      return null;
    }

    // Strip file extension
    const dotIndex = remainder.lastIndexOf('.');
    const publicId = dotIndex > 0 ? remainder.slice(0, dotIndex) : remainder;
    return publicId || null;
  } catch {
    return null;
  }
}
