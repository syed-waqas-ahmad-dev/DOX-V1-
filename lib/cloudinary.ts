import { v2 as cloudinary } from 'cloudinary';
import 'server-only';

/**
 * @file lib/cloudinary.ts
 * @description Secure server-side Cloudinary SDK configuration.
 * Strictly enforces signed uploads and prevents credential exposure to the client.
 */

const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

export function isCloudinaryConfigured(): boolean {
  return Boolean(cloudName && apiKey && apiSecret);
}

if (!cloudName || !apiKey || !apiSecret) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[CLOUDINARY] Warning: Cloudinary environment variables are missing.');
  }
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

export { cloudinary };

