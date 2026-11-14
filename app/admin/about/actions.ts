'use server';

/**
 * @file app/admin/about/actions.ts
 * @description Server actions for About Us content and Gallery management with Cloudinary buffer streaming.
 * Strict RBAC: only super_admin can mutate data.
 * Zero filesystem writes (no public/ or /tmp usage).
 * Strict TypeScript: ZERO `any`.
 */

import { cloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db/connect';
import { AboutPage, type IAboutPage, type IAboutHeroImage, type IAboutTeamCategory } from '@/models/AboutPage';
import { GalleryItem, type IGalleryItem, type GalleryMediaType } from '@/models/GalleryItem';
import { revalidatePath } from 'next/cache';
import mongoose from 'mongoose';

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
const GALLERY_FOLDER = 'dawood-ox/gallery' as const;
const MAX_GALLERY_TITLE_LENGTH = 300;
const MAX_GALLERY_DESCRIPTION_LENGTH = 2000;

export interface GalleryVideoUploadSignature {
  cloudName: string;
  apiKey: string;
  signature: string;
  timestamp: number;
  folder: typeof GALLERY_FOLDER;
}

/**
 * Helper to validate if a string is a valid 24-char hex MongoDB ObjectId
 */
function isValidObjectId(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-fA-F]{24}$/.test(id.trim());
}

/**
 * Helper to upload buffer directly to Cloudinary without disk persistence.
 * Strictly streams media to Cloudinary and returns hosted asset URLs.
 * Throws controlled errors with secure diagnostic server logging if Cloudinary API upload fails.
 */
async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: 'dawood-ox/about' | 'dawood-ox/gallery',
  resourceType: 'auto' | 'image' | 'video' = 'auto',
  mimeType: string = 'image/jpeg'
): Promise<{ secure_url: string; public_id: string }> {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are missing or incomplete.');
  }

  return new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },
      (error, res) => {
        if (error || !res) {
          const errObj = (error || {}) as Record<string, unknown>;
          const httpCode = typeof errObj.http_code === 'number' ? errObj.http_code : undefined;
          const rawMessage = error?.message || 'Empty response received from Cloudinary API';
          const errorName = error?.name || 'CloudinaryError';
          
          // Safely extract Cloudinary's custom error response header if present
          const headers = (errObj.headers || {}) as Record<string, unknown>;
          const xCldError =
            (typeof errObj.x_cld_error === 'string' ? errObj.x_cld_error : undefined) ||
            (typeof headers['x-cld-error'] === 'string' ? headers['x-cld-error'] : undefined);

          // SECURE SERVER-SIDE DIAGNOSTIC LOGGING
          console.error('[Cloudinary SDK Error Diagnostic]:', {
            message: rawMessage,
            http_code: httpCode,
            name: errorName,
            x_cld_error: xCldError,
            folder,
            resourceType,
            mimeType,
            bufferSizeBytes: buffer.length,
          });

          let userFacingMessage = `Cloudinary upload failed (HTTP ${httpCode || 'unknown'}): ${rawMessage}`;
          if (xCldError) {
            userFacingMessage += ` [Detail: ${xCldError}]`;
          }

          reject(new Error(userFacingMessage));
          return;
        }

        resolve({
          secure_url: res.secure_url,
          public_id: res.public_id,
        });
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Enforces strict super_admin session check.
 */
async function requireSuperAdminSession(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error('Authentication required. Please sign in as Super Admin.');
  }
  if (session.user.role !== 'super_admin') {
    throw new Error('Access denied. Only Super Admin can modify the About page and Gallery.');
  }
  return session.user.id || '';
}

/**
 * Isolated, read-only diagnostic action (Super Admin only).
 * Executes a 100% read-only Cloudinary Admin API ping (`cloudinary.api.ping()`).
 * Distinguishes general API authentication failure from upload-specific stream rejection.
 * Strictly sanitizes output; NEVER logs or returns keys, secrets, or headers.
 */
export async function diagnoseCloudinaryConnection(): Promise<{
  success: boolean;
  pingStatus?: string;
  httpCode?: number;
  error?: string;
}> {
  try {
    await requireSuperAdminSession();

    const pingResult = await cloudinary.api.ping();

    console.info('[Cloudinary Read-Only Diagnostic]: Ping succeeded.', {
      status: pingResult?.status,
    });

    return {
      success: true,
      pingStatus: pingResult?.status || 'ok',
    };
  } catch (err: unknown) {
    const errObj = (err || {}) as Record<string, unknown>;
    const httpCode = typeof errObj.http_code === 'number' ? errObj.http_code : undefined;
    const msg = err instanceof Error ? err.message : 'Cloudinary ping failed';

    console.error('[Cloudinary Read-Only Diagnostic Failed]:', {
      http_code: httpCode,
      message: msg,
    });

    return {
      success: false,
      httpCode,
      error: `Cloudinary read-only API ping failed (HTTP ${httpCode || 'unknown'}): ${msg}`,
    };
  }
}

/**
 * Default About page seed data
 */
const DEFAULT_ABOUT_PAGE: Partial<IAboutPage> = {
  heroImages: [
    {
      url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=1400&auto=format&fit=crop',
      alt: 'OX Shoes Flagship Atelier Storefront',
    },
    {
      url: 'https://images.unsplash.com/photo-1449505278894-297fdb3edbc1?q=80&w=600&auto=format&fit=crop',
      alt: 'Artisan Workshop Interior',
    },
    {
      url: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?q=80&w=600&auto=format&fit=crop',
      alt: 'Handcrafted Bovine Leather Stitching',
    },
  ],
  manager: {
    name: 'Dawood Khan',
    description:
      'Master craftsman with over 20 years of bespoke handmade footwear excellence. Directing OX Shoes with unwavering devotion to pure Pakistani cobbler heritage.',
    phone: '+92-300-1234567',
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
  },
  teamCategories: [
    { role: 'Super Admin', count: 1 },
    { role: 'Managers', count: 1 },
    { role: 'Master Craftsmen', count: 12 },
    { role: 'Delivery Partners', count: 5 },
  ],
};

/**
 * Default Gallery placeholder seed data
 */
const DEFAULT_GALLERY_ITEMS: Array<Partial<IGalleryItem>> = [
  {
    url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    type: 'image',
    title: 'Heritage Leatherwork',
    description: 'Precision cutting of full-grain cowhide leather.',
  },
  {
    url: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?q=80&w=800&auto=format&fit=crop',
    type: 'image',
    title: 'Hand-Welted Soles',
    description: 'Reinforced tyre soles prepared for durable wear.',
  },
  {
    url: 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?q=80&w=800&auto=format&fit=crop',
    type: 'image',
    title: 'Waxed Thread Detailing',
    description: 'Traditional artisan cross-stitching on Peshawari chappals.',
  },
  {
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    type: 'video',
    title: 'Atelier Workshop Tour',
    description: 'A glimpse into our daily handcrafted shoemaking process.',
  },
];

/**
 * Fetch single AboutPage document. Creates and returns default if none exists.
 * Publicly callable without authentication.
 */
export async function getAboutPageData(): Promise<{
  success: boolean;
  data?: IAboutPage;
  error?: string;
}> {
  try {
    await connectToDatabase();
    let about = await AboutPage.findOne().lean();

    if (!about) {
      const created = await AboutPage.create(DEFAULT_ABOUT_PAGE);
      about = created.toObject();
    }

    return {
      success: true,
      data: JSON.parse(JSON.stringify(about)),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch About Page data';
    return { success: false, error: message };
  }
}

/**
 * Update About Page data (Super Admin only).
 * Handles manager text, manager photo upload to 'dawood-ox/about',
 * hero imagery uploads, and team counts.
 */
export async function updateAboutPage(formData: FormData): Promise<{
  success: boolean;
  data?: IAboutPage;
  error?: string;
}> {
  try {
    const userId = await requireSuperAdminSession();
    await connectToDatabase();

    const managerName = (formData.get('managerName') as string)?.trim() || 'Dawood Khan';
    const managerDescription = (formData.get('managerDescription') as string)?.trim() || '';
    const managerPhone = (formData.get('managerPhone') as string)?.trim() || '+92-300-1234567';

    // Parse team categories JSON
    const teamCategoriesJson = formData.get('teamCategories') as string;
    let teamCategories: IAboutTeamCategory[] = DEFAULT_ABOUT_PAGE.teamCategories || [];
    if (teamCategoriesJson) {
      try {
        teamCategories = JSON.parse(teamCategoriesJson);
      } catch {
        // Fallback to default if invalid JSON
      }
    }

    // Existing about page doc
    let aboutDoc = await AboutPage.findOne();
    if (!aboutDoc) {
      aboutDoc = await AboutPage.create(DEFAULT_ABOUT_PAGE);
    }

    // Handle optional manager image upload
    const managerImageFile = formData.get('managerImage') as File | null;
    let managerImageUrl = aboutDoc.manager?.imageUrl || DEFAULT_ABOUT_PAGE.manager!.imageUrl;
    let managerPublicId = aboutDoc.manager?.publicId;

    if (managerImageFile && managerImageFile.size > 0) {
      if (managerImageFile.size > MAX_IMAGE_SIZE_BYTES) {
        throw new Error('Manager image exceeds maximum allowed size of 10MB.');
      }
      if (!managerImageFile.type.startsWith('image/')) {
        throw new Error('Manager image must be a valid image file.');
      }

      const buffer = Buffer.from(await managerImageFile.arrayBuffer());
      const uploadResult = await uploadBufferToCloudinary(
        buffer,
        'dawood-ox/about',
        'image',
        managerImageFile.type || 'image/jpeg'
      );
      managerImageUrl = uploadResult.secure_url;
      managerPublicId = uploadResult.public_id;
    }

    // Handle Hero images (primary background + 2 interior showcase images)
    const existingHeroImages = [...(aboutDoc.heroImages || [])];
    const heroImage0 = formData.get('heroImage0') as File | null;
    const heroImage1 = formData.get('heroImage1') as File | null;
    const heroImage2 = formData.get('heroImage2') as File | null;

    const heroAlt0 = (formData.get('heroAlt0') as string)?.trim() || 'Storefront Exterior';
    const heroAlt1 = (formData.get('heroAlt1') as string)?.trim() || 'Artisan Workshop';
    const heroAlt2 = (formData.get('heroAlt2') as string)?.trim() || 'Handmade Detailing';

    const newHeroList: IAboutHeroImage[] = [
      existingHeroImages[0] || { url: DEFAULT_ABOUT_PAGE.heroImages![0].url, alt: heroAlt0 },
      existingHeroImages[1] || { url: DEFAULT_ABOUT_PAGE.heroImages![1].url, alt: heroAlt1 },
      existingHeroImages[2] || { url: DEFAULT_ABOUT_PAGE.heroImages![2].url, alt: heroAlt2 },
    ];

    newHeroList[0].alt = heroAlt0;
    newHeroList[1].alt = heroAlt1;
    newHeroList[2].alt = heroAlt2;

    if (heroImage0 && heroImage0.size > 0) {
      if (heroImage0.size > MAX_IMAGE_SIZE_BYTES) throw new Error('Hero image 1 exceeds 10MB.');
      const buffer = Buffer.from(await heroImage0.arrayBuffer());
      const res = await uploadBufferToCloudinary(
        buffer,
        'dawood-ox/about',
        'image',
        heroImage0.type || 'image/jpeg'
      );
      newHeroList[0] = { url: res.secure_url, alt: heroAlt0, publicId: res.public_id };
    }

    if (heroImage1 && heroImage1.size > 0) {
      if (heroImage1.size > MAX_IMAGE_SIZE_BYTES) throw new Error('Hero interior image 1 exceeds 10MB.');
      const buffer = Buffer.from(await heroImage1.arrayBuffer());
      const res = await uploadBufferToCloudinary(
        buffer,
        'dawood-ox/about',
        'image',
        heroImage1.type || 'image/jpeg'
      );
      newHeroList[1] = { url: res.secure_url, alt: heroAlt1, publicId: res.public_id };
    }

    if (heroImage2 && heroImage2.size > 0) {
      if (heroImage2.size > MAX_IMAGE_SIZE_BYTES) throw new Error('Hero interior image 2 exceeds 10MB.');
      const buffer = Buffer.from(await heroImage2.arrayBuffer());
      const res = await uploadBufferToCloudinary(
        buffer,
        'dawood-ox/about',
        'image',
        heroImage2.type || 'image/jpeg'
      );
      newHeroList[2] = { url: res.secure_url, alt: heroAlt2, publicId: res.public_id };
    }

    aboutDoc.manager = {
      name: managerName,
      description: managerDescription,
      phone: managerPhone,
      imageUrl: managerImageUrl,
      publicId: managerPublicId,
    };
    aboutDoc.heroImages = newHeroList;
    aboutDoc.teamCategories = teamCategories;
    if (isValidObjectId(userId)) {
      aboutDoc.lastUpdatedBy = userId as unknown as IAboutPage['lastUpdatedBy'];
    } else {
      aboutDoc.lastUpdatedBy = null;
    }

    await aboutDoc.save();

    revalidatePath('/about');
    revalidatePath('/admin/about');

    return {
      success: true,
      data: JSON.parse(JSON.stringify(aboutDoc.toObject())),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update About Page';
    console.error('[updateAboutPage Error]:', error);
    return { success: false, error: message };
  }
}

/**
 * Fetch all GalleryItems sorted newest first.
 * Seeds default gallery items if the collection is empty.
 * Publicly callable without authentication.
 */
export async function getGalleryItems(): Promise<{
  success: boolean;
  data?: IGalleryItem[];
  error?: string;
}> {
  try {
    await connectToDatabase();
    let items = await GalleryItem.find().sort({ createdAt: -1 }).lean();

    if (items.length === 0) {
      await GalleryItem.insertMany(DEFAULT_GALLERY_ITEMS);
      items = await GalleryItem.find().sort({ createdAt: -1 }).lean();
    }

    return {
      success: true,
      data: JSON.parse(JSON.stringify(items)),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch gallery items';
    return { success: false, error: message };
  }
}

/**
 * Upload and add a new Gallery item (Super Admin only).
 * Streams directly to Cloudinary 'dawood-ox/gallery'.
 */
export async function addGalleryItem(formData: FormData): Promise<{
  success: boolean;
  data?: IGalleryItem;
  error?: string;
}> {
  try {
    const userId = await requireSuperAdminSession();
    await connectToDatabase();

    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string)?.trim() || '';
    const description = (formData.get('description') as string)?.trim() || '';

    if (!file || file.size === 0) {
      throw new Error('Please select an image or video file to upload.');
    }

    const mime = file.type;
    let type: GalleryMediaType = 'image';
    if (mime.startsWith('video/')) {
      type = 'video';
    } else if (mime.startsWith('image/')) {
      type = 'image';
    } else {
      throw new Error('Unsupported file type. Only images and videos are permitted.');
    }

    if (type === 'image' && file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error('Image file exceeds the 10MB limit.');
    }

    if (type === 'video' && file.size > MAX_VIDEO_SIZE_BYTES) {
      throw new Error('Video file exceeds the 100MB limit.');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await uploadBufferToCloudinary(
      buffer,
      'dawood-ox/gallery',
      type === 'video' ? 'video' : 'image',
      mime || (type === 'video' ? 'video/mp4' : 'image/jpeg')
    );

    const validUserId = isValidObjectId(userId) ? userId : null;

    const newItem = await GalleryItem.create({
      url: uploadResult.secure_url,
      type,
      title,
      description,
      publicId: uploadResult.public_id,
      createdBy: validUserId,
    });

    revalidatePath('/about');
    revalidatePath('/admin/about');

    return {
      success: true,
      data: JSON.parse(JSON.stringify(newItem.toObject())),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to add gallery item';
    console.error('[addGalleryItem Error]:', error);
    return { success: false, error: message };
  }
}

/**
 * Delete a Gallery item (Super Admin only).
 * Deletes from MongoDB and destroys from Cloudinary if publicId exists.
 */
export async function deleteGalleryItem(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await requireSuperAdminSession();
    await connectToDatabase();

    const item = await GalleryItem.findById(id);
    if (!item) {
      return { success: false, error: 'Gallery item not found.' };
    }

    if (item.publicId && isCloudinaryConfigured() && !item.publicId.startsWith('ox_')) {
      try {
        await cloudinary.uploader.destroy(item.publicId, {
          resource_type: item.type === 'video' ? 'video' : 'image',
        });
      } catch (cloudErr: unknown) {
        console.warn('Could not destroy Cloudinary resource:', cloudErr);
      }
    }

    await GalleryItem.findByIdAndDelete(id);

    revalidatePath('/about');
    revalidatePath('/admin/about');

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete gallery item';
    return { success: false, error: message };
  }
}

/**
 * Validate that a Cloudinary video URL uses HTTPS, res.cloudinary.com,
 * and belongs to the expected cloud name under /video/upload/.
 */
function assertValidCloudinaryVideoUrl(urlString: string, expectedCloudName: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error('Invalid Cloudinary video URL.');
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') {
    throw new Error('Video URL must use HTTPS on res.cloudinary.com.');
  }

  if (parsed.username || parsed.password || parsed.port) {
    throw new Error('Video URL contains invalid credentials or port.');
  }

  const expectedPrefix = `/${expectedCloudName}/video/upload/`;
  if (!parsed.pathname.startsWith(expectedPrefix)) {
    throw new Error('Video URL does not match the configured Cloudinary cloud or video upload path.');
  }

  return parsed;
}

/**
 * Safely extract HTTP status and message from a Cloudinary Admin API error
 * without logging or exposing raw request_options or credentials.
 */
function extractSanitizedCloudinaryAdminError(err: unknown): {
  httpCode?: number;
  message: string;
} {
  const errObj = (typeof err === 'object' && err !== null ? err : {}) as Record<string, unknown>;
  const nestedErr = (
    typeof errObj.error === 'object' && errObj.error !== null ? errObj.error : {}
  ) as Record<string, unknown>;

  const httpCode =
    typeof nestedErr.http_code === 'number'
      ? nestedErr.http_code
      : typeof errObj.http_code === 'number'
        ? errObj.http_code
        : undefined;

  const rawMessage =
    typeof nestedErr.message === 'string' && nestedErr.message.trim()
      ? nestedErr.message.trim()
      : typeof errObj.message === 'string' && errObj.message.trim()
        ? errObj.message.trim()
        : err instanceof Error
          ? err.message
          : 'Cloudinary verification failed';

  const sanitizedMessage = rawMessage
    .replace(/\b(Basic|Bearer)\s+[A-Za-z0-9+/=._-]+/gi, '$1 [REDACTED]')
    .replace(/\b(api_key|api_secret|signature)=([^\s&,'"]+)/gi, '$1=[REDACTED]');

  return { httpCode, message: sanitizedMessage };
}

/**
 * Generate short-lived signed upload parameters for direct browser-to-Cloudinary
 * gallery video uploads (Super Admin only). Bypasses serverless payload limits
 * while preserving signed server-side authentication and keeping API secret on server.
 */
export async function createGalleryVideoUploadSignature(input: {
  fileSize: number;
  fileType: string;
}): Promise<{
  success: boolean;
  data?: GalleryVideoUploadSignature;
  error?: string;
}> {
  try {
    await requireSuperAdminSession();

    if (!isCloudinaryConfigured()) {
      throw new Error(
        'Cloudinary environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are missing or incomplete.'
      );
    }

    const fileType = typeof input?.fileType === 'string' ? input.fileType.trim().toLowerCase() : '';
    const fileSize = typeof input?.fileSize === 'number' ? input.fileSize : NaN;

    if (!fileType.startsWith('video/')) {
      throw new Error('Unsupported file type. Only video/* files are permitted for video upload.');
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      throw new Error('Video file is empty or has an invalid size.');
    }

    if (fileSize > MAX_VIDEO_SIZE_BYTES) {
      throw new Error('Video file exceeds the 100MB limit.');
    }

    const cfg = cloudinary.config();
    const cloudName = typeof cfg.cloud_name === 'string' ? cfg.cloud_name.trim() : '';
    const apiKey = typeof cfg.api_key === 'string' ? cfg.api_key.trim() : '';
    const apiSecret = typeof cfg.api_secret === 'string' ? cfg.api_secret.trim() : '';

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Cloudinary server configuration is incomplete.');
    }

    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = {
      folder: GALLERY_FOLDER,
      timestamp,
    };

    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    return {
      success: true,
      data: {
        cloudName,
        apiKey,
        signature,
        timestamp,
        folder: GALLERY_FOLDER,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate video upload signature';
    console.error('[createGalleryVideoUploadSignature Error]:', message);
    return { success: false, error: message };
  }
}

/**
 * Verify a direct-to-Cloudinary uploaded video via Cloudinary's authenticated Admin API
 * and persist the GalleryItem record in MongoDB (Super Admin only).
 */
export async function saveGalleryVideoItem(input: {
  publicId: string;
  secureUrl: string;
  title?: string;
  description?: string;
}): Promise<{
  success: boolean;
  data?: IGalleryItem;
  error?: string;
}> {
  try {
    const userId = await requireSuperAdminSession();

    if (!isCloudinaryConfigured()) {
      throw new Error(
        'Cloudinary environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are missing or incomplete.'
      );
    }

    const cfg = cloudinary.config();
    const expectedCloudName = typeof cfg.cloud_name === 'string' ? cfg.cloud_name.trim() : '';
    if (!expectedCloudName) {
      throw new Error('Cloudinary cloud name is not configured on the server.');
    }

    const cleanPublicId = typeof input?.publicId === 'string' ? input.publicId.trim() : '';
    const cleanSecureUrl = typeof input?.secureUrl === 'string' ? input.secureUrl.trim() : '';

    if (!cleanPublicId || !cleanSecureUrl) {
      throw new Error('Missing uploaded video identifier or URL.');
    }

    if (
      cleanPublicId.length > 255 ||
      cleanPublicId.startsWith('/') ||
      cleanPublicId.endsWith('/') ||
      cleanPublicId.includes('..') ||
      cleanPublicId.includes('//') ||
      !/^[a-zA-Z0-9_\-./]+$/.test(cleanPublicId)
    ) {
      throw new Error('Invalid Cloudinary public_id format.');
    }

    if (input.title !== undefined && typeof input.title !== 'string') {
      throw new Error('Invalid gallery title.');
    }
    if (input.description !== undefined && typeof input.description !== 'string') {
      throw new Error('Invalid gallery description.');
    }

    const cleanTitle = (input.title ?? '').trim();
    const cleanDescription = (input.description ?? '').trim();

    if (cleanTitle.length > MAX_GALLERY_TITLE_LENGTH) {
      throw new Error(`Title must be ${MAX_GALLERY_TITLE_LENGTH} characters or fewer.`);
    }
    if (cleanDescription.length > MAX_GALLERY_DESCRIPTION_LENGTH) {
      throw new Error(`Description must be ${MAX_GALLERY_DESCRIPTION_LENGTH} characters or fewer.`);
    }

    // Validate client-supplied URL strictly uses HTTPS and expected Cloudinary cloud
    assertValidCloudinaryVideoUrl(cleanSecureUrl, expectedCloudName);

    // Verify the uploaded asset directly through Cloudinary's authenticated Admin API
    let assetRecord: Record<string, unknown>;
    try {
      assetRecord = (await cloudinary.api.resource(cleanPublicId, {
        resource_type: 'video',
        type: 'upload',
      })) as Record<string, unknown>;
    } catch (adminErr: unknown) {
      const firstErr = extractSanitizedCloudinaryAdminError(adminErr);
      if (firstErr.httpCode === 404) {
        // Brief single retry in case of immediate post-upload propagation lag
        await new Promise((resolve) => setTimeout(resolve, 400));
        try {
          assetRecord = (await cloudinary.api.resource(cleanPublicId, {
            resource_type: 'video',
            type: 'upload',
          })) as Record<string, unknown>;
        } catch (retryErr: unknown) {
          const retryInfo = extractSanitizedCloudinaryAdminError(retryErr);
          console.error('[saveGalleryVideoItem Admin Verification Error]:', retryInfo);
          throw new Error(
            `Could not verify uploaded video in Cloudinary (HTTP ${retryInfo.httpCode ?? 'unknown'}): ${retryInfo.message}`
          );
        }
      } else {
        console.error('[saveGalleryVideoItem Admin Verification Error]:', firstErr);
        throw new Error(
          `Could not verify uploaded video in Cloudinary (HTTP ${firstErr.httpCode ?? 'unknown'}): ${firstErr.message}`
        );
      }
    }

    const verifiedPublicId =
      typeof assetRecord.public_id === 'string' ? assetRecord.public_id.trim() : '';
    const verifiedSecureUrl =
      typeof assetRecord.secure_url === 'string' ? assetRecord.secure_url.trim() : '';
    const verifiedResourceType =
      typeof assetRecord.resource_type === 'string' ? assetRecord.resource_type.trim() : '';
    const verifiedAssetFolder =
      typeof assetRecord.asset_folder === 'string' ? assetRecord.asset_folder.trim() : '';
    const verifiedFolder =
      typeof assetRecord.folder === 'string' ? assetRecord.folder.trim() : '';
    const verifiedBytes =
      typeof assetRecord.bytes === 'number' ? assetRecord.bytes : undefined;

    if (!verifiedPublicId || verifiedPublicId !== cleanPublicId) {
      throw new Error('Cloudinary asset public_id verification mismatch.');
    }

    if (verifiedResourceType !== 'video') {
      throw new Error('Verified Cloudinary asset is not a video.');
    }

    const inExpectedFolder =
      verifiedPublicId.startsWith(`${GALLERY_FOLDER}/`) ||
      verifiedAssetFolder === GALLERY_FOLDER ||
      verifiedFolder === GALLERY_FOLDER;

    if (!inExpectedFolder) {
      throw new Error('Uploaded video is not located in the authorized gallery folder.');
    }

    if (!verifiedSecureUrl) {
      throw new Error('Cloudinary asset verification did not return a secure_url.');
    }

    const parsedVerifiedUrl = assertValidCloudinaryVideoUrl(verifiedSecureUrl, expectedCloudName);
    const parsedClientUrl = assertValidCloudinaryVideoUrl(cleanSecureUrl, expectedCloudName);

    if (parsedVerifiedUrl.pathname !== parsedClientUrl.pathname) {
      throw new Error('Uploaded video URL does not match the verified Cloudinary asset.');
    }

    if (verifiedBytes !== undefined && (verifiedBytes <= 0 || verifiedBytes > MAX_VIDEO_SIZE_BYTES)) {
      throw new Error('Uploaded video size is invalid or exceeds the 100MB limit.');
    }

    await connectToDatabase();

    const validUserId = isValidObjectId(userId) ? userId : null;

    const newItem = await GalleryItem.create({
      url: verifiedSecureUrl,
      type: 'video',
      title: cleanTitle,
      description: cleanDescription,
      publicId: verifiedPublicId,
      createdBy: validUserId,
    });

    revalidatePath('/about');
    revalidatePath('/admin/about');

    return {
      success: true,
      data: JSON.parse(JSON.stringify(newItem.toObject())),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save gallery video item';
    console.error('[saveGalleryVideoItem Error]:', message);
    return { success: false, error: message };
  }
}
