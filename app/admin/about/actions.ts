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
