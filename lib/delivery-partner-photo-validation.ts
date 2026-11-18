/**
 * @file lib/delivery-partner-photo-validation.ts
 * @description Shared client + server validation rules for Delivery Partner rider photo uploads.
 * Strict TypeScript: ZERO `any`.
 */

export const DELIVERY_PARTNER_PHOTO_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB (matches project upload policy)
export const DELIVERY_PARTNER_PHOTO_MAX_SIZE_LABEL = '10MB';

export const DELIVERY_PARTNER_PHOTO_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedRiderPhotoMimeType = (typeof DELIVERY_PARTNER_PHOTO_ALLOWED_MIME_TYPES)[number];

export const DELIVERY_PARTNER_PHOTO_ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
] as const;

export const DELIVERY_PARTNER_PHOTO_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
export const DELIVERY_PARTNER_CLOUDINARY_FOLDER = 'ox-shoes/delivery-partners';

export const DEFAULT_DELIVERY_PARTNER_PHOTO =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';

export interface RiderPhotoFileMetadata {
  name?: string;
  type?: string;
  size: number;
}

export interface RiderPhotoValidationResult {
  valid: boolean;
  error?: string;
  normalizedMimeType?: AllowedRiderPhotoMimeType;
}

export function normalizeRiderPhotoMimeType(mimeType?: string): AllowedRiderPhotoMimeType | null {
  if (!mimeType || typeof mimeType !== 'string') return null;
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === 'image/jpg' || normalized === 'image/jpeg') {
    return 'image/jpeg';
  }
  if (normalized === 'image/png') {
    return 'image/png';
  }
  if (normalized === 'image/webp') {
    return 'image/webp';
  }
  return null;
}

export function getExtensionFromFilename(filename?: string): string {
  if (!filename || typeof filename !== 'string') return '';
  const trimmed = filename.trim().toLowerCase();
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot < 0) return '';
  return trimmed.slice(lastDot);
}

export function isAllowedRiderPhotoExtension(ext: string): boolean {
  return (DELIVERY_PARTNER_PHOTO_ALLOWED_EXTENSIONS as readonly string[]).includes(ext.toLowerCase());
}

function getExpectedMimeForExtension(ext: string): AllowedRiderPhotoMimeType | null {
  const lower = ext.toLowerCase();
  if (lower === '.jpg' || lower === '.jpeg') return 'image/jpeg';
  if (lower === '.png') return 'image/png';
  if (lower === '.webp') return 'image/webp';
  return null;
}

/**
 * Validates file size, extension, and declared MIME type on both frontend and server.
 */
export function validateRiderPhotoFileMeta(file: RiderPhotoFileMetadata): RiderPhotoValidationResult {
  if (!file || typeof file.size !== 'number' || !Number.isFinite(file.size) || file.size <= 0) {
    return { valid: false, error: 'Selected photo file is empty or invalid.' };
  }

  if (file.size > DELIVERY_PARTNER_PHOTO_MAX_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Rider photo is ${sizeMb}MB. Maximum allowed file size is ${DELIVERY_PARTNER_PHOTO_MAX_SIZE_LABEL}.`,
    };
  }

  const ext = getExtensionFromFilename(file.name);
  if (ext && !isAllowedRiderPhotoExtension(ext)) {
    return {
      valid: false,
      error: 'Unsupported image format. Please select a JPG, JPEG, PNG, or WEBP file.',
    };
  }

  const normalizedMime = normalizeRiderPhotoMimeType(file.type);
  if (file.type && !normalizedMime) {
    return {
      valid: false,
      error: 'Unsupported image format. Only JPG, JPEG, PNG, and WEBP images are allowed.',
    };
  }

  const fallbackFromExt = ext ? getExpectedMimeForExtension(ext) : null;
  const resolvedMime = normalizedMime || fallbackFromExt;

  if (!resolvedMime) {
    return {
      valid: false,
      error: 'Unsupported image format. Only JPG, JPEG, PNG, and WEBP images are allowed.',
    };
  }

  if (normalizedMime && fallbackFromExt && normalizedMime !== fallbackFromExt) {
    return {
      valid: false,
      error: 'Image file extension does not match its content type.',
    };
  }

  return {
    valid: true,
    normalizedMimeType: resolvedMime,
  };
}

/**
 * Inspects binary file header magic bytes to confirm actual image format (JPEG, PNG, or WEBP).
 */
export function detectImageMagicMimeType(bytes: Uint8Array): AllowedRiderPhotoMimeType | null {
  if (!bytes || bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WEBP: "RIFF" + 4 bytes + "WEBP"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Full server-side verification combining metadata checks and binary magic-byte inspection.
 */
export function validateRiderPhotoBuffer(
  file: RiderPhotoFileMetadata,
  bytes: Uint8Array
): RiderPhotoValidationResult {
  const metaResult = validateRiderPhotoFileMeta(file);
  if (!metaResult.valid) {
    return metaResult;
  }

  const detectedMime = detectImageMagicMimeType(bytes);
  if (!detectedMime) {
    return {
      valid: false,
      error: 'Invalid or corrupted image file. Please upload a genuine JPG, JPEG, PNG, or WEBP image.',
    };
  }

  if (metaResult.normalizedMimeType && metaResult.normalizedMimeType !== detectedMime) {
    return {
      valid: false,
      error: 'Uploaded image file contents do not match the declared JPG/PNG/WEBP format.',
    };
  }

  return {
    valid: true,
    normalizedMimeType: detectedMime,
  };
}
