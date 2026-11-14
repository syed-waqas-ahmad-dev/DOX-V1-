'use client';

/**
 * @file components/admin/about/AboutAdminManager.tsx
 * @description Super Admin management dashboard for About Us content and Gallery.
 * Supports direct Cloudinary uploads, image preview, video metadata duration validation (<=10s),
 * team statistics editing, and media deletion.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  updateAboutPage,
  addGalleryItem,
  deleteGalleryItem,
  createGalleryVideoUploadSignature,
  saveGalleryVideoItem,
} from '@/app/admin/about/actions';
import type { IAboutPage, IAboutTeamCategory } from '@/models/AboutPage';
import type { IGalleryItem } from '@/models/GalleryItem';
import {
  Upload,
  Trash2,
  Plus,
  Save,
  CheckCircle2,
  AlertCircle,
  Play,
  Film,
  ImageIcon,
  Loader2,
  ExternalLink,
  ShieldAlert,
  ArrowLeft,
  X,
} from 'lucide-react';

interface AboutAdminManagerProps {
  initialAbout: IAboutPage;
  initialGallery: IGalleryItem[];
}

export function AboutAdminManager({ initialAbout, initialGallery }: AboutAdminManagerProps) {
  // Page states
  const [aboutData, setAboutData] = useState<IAboutPage>(initialAbout);
  const [galleryItems, setGalleryItems] = useState<IGalleryItem[]>(initialGallery);

  // Form states for About Page
  const [managerName, setManagerName] = useState(aboutData.manager?.name || 'Dawood Khan');
  const [managerPhone, setManagerPhone] = useState(aboutData.manager?.phone || '+92-300-1234567');
  const [managerDescription, setManagerDescription] = useState(
    aboutData.manager?.description || ''
  );
  const [teamStats, setTeamStats] = useState<IAboutTeamCategory[]>(
    aboutData.teamCategories && aboutData.teamCategories.length > 0
      ? aboutData.teamCategories
      : [
          { role: 'Super Admin', count: 1 },
          { role: 'Managers', count: 1 },
          { role: 'Master Craftsmen', count: 12 },
          { role: 'Delivery Partners', count: 5 },
        ]
  );

  // Hero alts
  const [heroAlt0, setHeroAlt0] = useState(aboutData.heroImages?.[0]?.alt || 'OX Shoes Flagship Front');
  const [heroAlt1, setHeroAlt1] = useState(aboutData.heroImages?.[1]?.alt || 'Atelier Workshop Interior');
  const [heroAlt2, setHeroAlt2] = useState(aboutData.heroImages?.[2]?.alt || 'Handcrafted Bovine Stitching');

  // Hero & Manager file states & previews
  const [managerFile, setManagerFile] = useState<File | null>(null);
  const [managerPreview, setManagerPreview] = useState<string | null>(null);

  const [heroFile0, setHeroFile0] = useState<File | null>(null);
  const [heroPreview0, setHeroPreview0] = useState<string | null>(null);

  const [heroFile1, setHeroFile1] = useState<File | null>(null);
  const [heroPreview1, setHeroPreview1] = useState<string | null>(null);

  const [heroFile2, setHeroFile2] = useState<File | null>(null);
  const [heroPreview2, setHeroPreview2] = useState<string | null>(null);

  // Feedback states
  const [aboutSaving, setAboutSaving] = useState(false);
  const [aboutMessage, setAboutMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Gallery form states
  const [galleryFile, setGalleryFile] = useState<File | null>(null);
  const [galleryPreview, setGalleryPreview] = useState<string | null>(null);
  const [galleryFileType, setGalleryFileType] = useState<'image' | 'video' | null>(null);
  const [galleryTitle, setGalleryTitle] = useState('');
  const [galleryDescription, setGalleryDescription] = useState('');
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const galleryFileInputRef = useRef<HTMLInputElement>(null);
  const galleryUploadInFlightRef = useRef(false);

  // New role inputs
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleCount, setNewRoleCount] = useState<number>(1);

  /**
   * Validate image files (<= 10MB)
   */
  const validateImageFile = (file: File): { valid: boolean; error?: string } => {
    if (!file.type.startsWith('image/')) {
      return { valid: false, error: 'Please select a valid image file (JPEG, PNG, WEBP).' };
    }
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      return {
        valid: false,
        error: `Image size is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Limit is 10MB.`,
      };
    }
    return { valid: true };
  };

  /**
   * Validate gallery media (image <= 10MB, video <= 100MB and duration <= 10s)
   */
  const validateGalleryMedia = async (
    file: File
  ): Promise<{ valid: boolean; error?: string; type: 'image' | 'video'; duration?: number }> => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      return {
        valid: false,
        error: 'Only images (JPEG, PNG, WEBP) and videos (MP4, WEBM) are permitted.',
        type: 'image',
      };
    }

    if (isImage) {
      const maxBytes = 10 * 1024 * 1024; // 10MB
      if (file.size > maxBytes) {
        return {
          valid: false,
          error: `Image exceeds 10MB maximum limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
          type: 'image',
        };
      }
      return { valid: true, type: 'image' };
    }

    if (isVideo) {
      const maxBytes = 100 * 1024 * 1024; // 100MB
      if (file.size > maxBytes) {
        return {
          valid: false,
          error: `Video exceeds 100MB maximum limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
          type: 'video',
        };
      }

      // Check video duration with HTMLVideoElement and loadedmetadata
      try {
        const duration = await new Promise<number>((resolve, reject) => {
          const videoElement = document.createElement('video');
          videoElement.preload = 'metadata';
          const objectUrl = URL.createObjectURL(file);
          videoElement.src = objectUrl;

          videoElement.onloadedmetadata = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(videoElement.duration);
          };

          videoElement.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Unable to parse video metadata.'));
          };
        });

        if (duration > 10.5) {
          return {
            valid: false,
            error: `Video duration is ${duration.toFixed(1)}s. Videos must be 10 seconds or shorter.`,
            type: 'video',
            duration,
          };
        }

        return { valid: true, type: 'video', duration };
      } catch {
        return {
          valid: false,
          error: 'Could not verify video duration. Please upload a standard MP4/WebM video under 10 seconds.',
          type: 'video',
        };
      }
    }

    return { valid: false, error: 'Unknown file type', type: 'image' };
  };

  /**
   * Handle Manager Image Selection
   */
  const handleManagerImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setAboutMessage({ type: 'error', text: validation.error || 'Invalid file' });
      return;
    }
    setManagerFile(file);
    setManagerPreview(URL.createObjectURL(file));
  };

  /**
   * Handle Hero Image Selections
   */
  const handleHeroImageChange = (index: 0 | 1 | 2, file: File | null) => {
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setAboutMessage({ type: 'error', text: validation.error || 'Invalid file' });
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    if (index === 0) {
      setHeroFile0(file);
      setHeroPreview0(previewUrl);
    } else if (index === 1) {
      setHeroFile1(file);
      setHeroPreview1(previewUrl);
    } else {
      setHeroFile2(file);
      setHeroPreview2(previewUrl);
    }
  };

  /**
   * Add Team Stat
   */
  const handleAddTeamRole = () => {
    if (!newRoleName.trim()) return;
    setTeamStats([...teamStats, { role: newRoleName.trim(), count: Number(newRoleCount) || 0 }]);
    setNewRoleName('');
    setNewRoleCount(1);
  };

  /**
   * Remove Team Stat
   */
  const handleRemoveTeamRole = (index: number) => {
    setTeamStats(teamStats.filter((_, i) => i !== index));
  };

  /**
   * Update Team Stat Count
   */
  const handleUpdateTeamCount = (index: number, count: number) => {
    const updated = [...teamStats];
    updated[index].count = count;
    setTeamStats(updated);
  };

  /**
   * Save About Page Changes
   */
  const handleSaveAboutPage = async (e: React.FormEvent) => {
    e.preventDefault();
    setAboutSaving(true);
    setAboutMessage(null);

    try {
      const formData = new FormData();
      formData.append('managerName', managerName);
      formData.append('managerPhone', managerPhone);
      formData.append('managerDescription', managerDescription);
      formData.append('teamCategories', JSON.stringify(teamStats));

      formData.append('heroAlt0', heroAlt0);
      formData.append('heroAlt1', heroAlt1);
      formData.append('heroAlt2', heroAlt2);

      if (managerFile) {
        formData.append('managerImage', managerFile);
      }
      if (heroFile0) {
        formData.append('heroImage0', heroFile0);
      }
      if (heroFile1) {
        formData.append('heroImage1', heroFile1);
      }
      if (heroFile2) {
        formData.append('heroImage2', heroFile2);
      }

      const res = await updateAboutPage(formData);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to save About Page content');
      }

      setAboutData(res.data);
      setManagerFile(null);
      setHeroFile0(null);
      setHeroFile1(null);
      setHeroFile2(null);

      setAboutMessage({
        type: 'success',
        text: 'About Page content and images updated successfully!',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating About Page';
      setAboutMessage({ type: 'error', text: msg });
    } finally {
      setAboutSaving(false);
    }
  };

  /**
   * Handle Gallery File Selection with Instant Duration & Size Validation
   */
  const handleGalleryFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setGalleryError(null);
    if (!file) {
      setGalleryFile(null);
      setGalleryPreview(null);
      setGalleryFileType(null);
      return;
    }

    const validation = await validateGalleryMedia(file);
    if (!validation.valid) {
      setGalleryError(validation.error || 'Invalid file');
      if (galleryFileInputRef.current) galleryFileInputRef.current.value = '';
      setGalleryFile(null);
      setGalleryPreview(null);
      setGalleryFileType(null);
      return;
    }

    setGalleryFile(file);
    setGalleryFileType(validation.type);
    setGalleryPreview(URL.createObjectURL(file));
  };

  /**
   * Upload New Gallery Item
   * - Videos: Two-step server-signed direct-to-Cloudinary upload (bypasses serverless payload limit)
   * - Images: Existing Server Action upload flow (unchanged)
   */
  const handleUploadGalleryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (galleryUploadInFlightRef.current || galleryUploading) {
      return;
    }
    if (!galleryFile) {
      setGalleryError('Please select an image or video file.');
      return;
    }

    galleryUploadInFlightRef.current = true;
    setGalleryUploading(true);
    setGalleryError(null);

    try {
      let uploadedItem: IGalleryItem;
      const isVideo = galleryFileType === 'video' || galleryFile.type.startsWith('video/');

      if (isVideo) {
        if (!galleryFile.type.startsWith('video/')) {
          throw new Error('Selected file is not a supported video format.');
        }
        const maxVideoBytes = 100 * 1024 * 1024;
        if (galleryFile.size <= 0 || galleryFile.size > maxVideoBytes) {
          throw new Error(
            galleryFile.size <= 0
              ? 'Selected video file is empty.'
              : `Video exceeds 100MB maximum limit (${(galleryFile.size / (1024 * 1024)).toFixed(1)}MB).`
          );
        }

        // Step 1: Request short-lived server-generated upload signature
        const sigRes = await createGalleryVideoUploadSignature({
          fileSize: galleryFile.size,
          fileType: galleryFile.type,
        });
        if (!sigRes.success || !sigRes.data) {
          throw new Error(sigRes.error || 'Failed to authorize direct video upload.');
        }

        const { cloudName, apiKey, signature, timestamp, folder } = sigRes.data;

        // Step 2: Upload original File directly to Cloudinary HTTPS video/upload endpoint
        const cldFormData = new FormData();
        cldFormData.append('file', galleryFile);
        cldFormData.append('api_key', apiKey);
        cldFormData.append('timestamp', String(timestamp));
        cldFormData.append('signature', signature);
        cldFormData.append('folder', folder);

        const uploadEndpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/video/upload`;

        let cldResponse: Response;
        try {
          cldResponse = await fetch(uploadEndpoint, {
            method: 'POST',
            body: cldFormData,
          });
        } catch (networkErr: unknown) {
          const networkMsg =
            networkErr instanceof Error && networkErr.message
              ? networkErr.message
              : 'Network connection interrupted';
          throw new Error(`Network error while uploading video to Cloudinary: ${networkMsg}`);
        }

        const rawResponseText = await cldResponse.text();
        let parsedBody: Record<string, unknown> | null = null;
        if (rawResponseText) {
          try {
            const parsed: unknown = JSON.parse(rawResponseText);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
              parsedBody = parsed as Record<string, unknown>;
            }
          } catch {
            parsedBody = null;
          }
        }

        if (!cldResponse.ok) {
          const nestedError =
            parsedBody && typeof parsedBody.error === 'object' && parsedBody.error !== null
              ? (parsedBody.error as Record<string, unknown>)
              : null;
          const cldErrorMsg =
            nestedError && typeof nestedError.message === 'string' && nestedError.message.trim()
              ? nestedError.message.trim()
              : parsedBody && typeof parsedBody.message === 'string' && parsedBody.message.trim()
                ? parsedBody.message.trim()
                : `Cloudinary rejected video upload (HTTP ${cldResponse.status}).`;
          throw new Error(`Cloudinary video upload failed (HTTP ${cldResponse.status}): ${cldErrorMsg}`);
        }

        if (!parsedBody) {
          throw new Error('Cloudinary returned a malformed non-JSON response during video upload.');
        }

        const secureUrl = typeof parsedBody.secure_url === 'string' ? parsedBody.secure_url.trim() : '';
        const publicId = typeof parsedBody.public_id === 'string' ? parsedBody.public_id.trim() : '';
        const returnedResourceType =
          typeof parsedBody.resource_type === 'string' ? parsedBody.resource_type.trim() : '';

        if (!secureUrl || !publicId) {
          throw new Error('Cloudinary upload response is missing secure_url or public_id.');
        }

        if (returnedResourceType && returnedResourceType !== 'video') {
          throw new Error(`Expected Cloudinary resource_type "video", received "${returnedResourceType}".`);
        }

        // Step 3: Verify via server-side Admin API and save GalleryItem in MongoDB
        const saveRes = await saveGalleryVideoItem({
          publicId,
          secureUrl,
          title: galleryTitle,
          description: galleryDescription,
        });
        if (!saveRes.success || !saveRes.data) {
          throw new Error(
            saveRes.error || 'Video uploaded to Cloudinary, but failed to save gallery record.'
          );
        }

        uploadedItem = saveRes.data;
      } else {
        // Existing image upload flow (unchanged)
        const formData = new FormData();
        formData.append('file', galleryFile);
        formData.append('title', galleryTitle);
        formData.append('description', galleryDescription);

        const res = await addGalleryItem(formData);
        if (!res.success || !res.data) {
          throw new Error(res.error || 'Failed to upload media item');
        }

        uploadedItem = res.data;
      }

      setGalleryItems([uploadedItem, ...galleryItems]);
      setGalleryFile(null);
      setGalleryPreview(null);
      setGalleryFileType(null);
      setGalleryTitle('');
      setGalleryDescription('');
      if (galleryFileInputRef.current) galleryFileInputRef.current.value = '';
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : 'Failed to upload gallery media';
      const msg =
        rawMsg === 'An unexpected response was received from the server.'
          ? 'The server could not process the gallery request. Please verify your Super Admin session and retry.'
          : rawMsg;
      setGalleryError(msg);
    } finally {
      galleryUploadInFlightRef.current = false;
      setGalleryUploading(false);
    }
  };

  /**
   * Delete Gallery Item
   */
  const handleDeleteGalleryItem = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this gallery item from Cloudinary and database?')) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await deleteGalleryItem(id);
      if (!res.success) {
        throw new Error(res.error || 'Failed to delete item');
      }
      setGalleryItems(galleryItems.filter((item) => String(item._id) !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error deleting item');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-3 sm:p-6 lg:p-10 font-sans selection:bg-amber-500 selection:text-neutral-950 max-w-full overflow-x-hidden">
      <div className="max-w-6xl mx-auto space-y-8 sm:space-y-10 w-full min-w-0">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-neutral-800 w-full min-w-0">
          <div className="min-w-0 w-full sm:w-auto">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/30">
                Super Admin Master Control
              </span>
            </div>
            <h1 className="text-xl sm:text-3xl font-black text-white break-words">
              About Page & Media Gallery CRUD
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1 break-words">
              Direct Cloudinary streaming to <code className="text-amber-400 break-all">dawood-ox/about</code> and{' '}
              <code className="text-amber-400 break-all">dawood-ox/gallery</code> with zero filesystem writes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
            <Link
              href="/admin"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold border border-neutral-800 transition flex-1 sm:flex-none"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>Admin Dashboard</span>
            </Link>
            <Link
              href="/about"
              target="_blank"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-lg shadow-amber-500/20 flex-1 sm:flex-none"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              <span>View Live About Page</span>
            </Link>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {aboutMessage && (
          <div
            className={`p-4 rounded-2xl flex items-center gap-3 border min-w-0 ${
              aboutMessage.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                : 'bg-red-950/40 border-red-800 text-red-300'
            }`}
          >
            {aboutMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
            )}
            <p className="text-xs sm:text-sm font-medium break-words flex-1 min-w-0">{aboutMessage.text}</p>
            <button
              onClick={() => setAboutMessage(null)}
              className="ml-auto text-neutral-400 hover:text-white shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* SECTION 1: ABOUT PAGE CONFIG (HERO, MANAGER & TEAM) */}
        <form onSubmit={handleSaveAboutPage} className="space-y-8 w-full min-w-0">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 shadow-xl w-full min-w-0">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800 min-w-0">
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-amber-500 shrink-0" />
                  <span className="truncate">Section 1: Hero Imagery Configuration</span>
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5 break-words">
                  Full-width shopfront background + 2 small overlapping interior images (rotated 6° / -6°).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 min-w-0">
              {/* Hero Image 0: Background Shopfront */}
              <div className="bg-neutral-950 p-4 sm:p-5 rounded-2xl border border-neutral-800 space-y-4 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-amber-500">Shopfront Background</span>
                  <span className="text-[10px] text-neutral-500">Full Width</span>
                </div>
                <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800">
                  <Image
                    src={heroPreview0 || aboutData.heroImages?.[0]?.url || 'https://res.cloudinary.com/demo/image/upload/sample.jpg'}
                    alt="Hero Background"
                    fill
                    className="object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Alt Description</label>
                  <input
                    type="text"
                    value={heroAlt0}
                    onChange={(e) => setHeroAlt0(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Replace Image (Max 10MB)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleHeroImageChange(0, e.target.files?.[0] || null)}
                    className="w-full text-xs text-neutral-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-neutral-800 file:text-neutral-300 hover:file:bg-neutral-700 cursor-pointer max-w-full overflow-hidden"
                  />
                </div>
              </div>

              {/* Hero Image 1: Interior Tilt Left */}
              <div className="bg-neutral-950 p-4 sm:p-5 rounded-2xl border border-neutral-800 space-y-4 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-amber-500">Interior Snapshot 1</span>
                  <span className="text-[10px] text-neutral-500">Rotate -6°</span>
                </div>
                <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800">
                  <Image
                    src={heroPreview1 || aboutData.heroImages?.[1]?.url || 'https://res.cloudinary.com/demo/image/upload/sample.jpg'}
                    alt="Interior 1"
                    fill
                    className="object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Alt Description</label>
                  <input
                    type="text"
                    value={heroAlt1}
                    onChange={(e) => setHeroAlt1(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Replace Image (Max 10MB)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleHeroImageChange(1, e.target.files?.[0] || null)}
                    className="w-full text-xs text-neutral-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-neutral-800 file:text-neutral-300 hover:file:bg-neutral-700 cursor-pointer max-w-full overflow-hidden"
                  />
                </div>
              </div>

              {/* Hero Image 2: Interior Tilt Right */}
              <div className="bg-neutral-950 p-4 sm:p-5 rounded-2xl border border-neutral-800 space-y-4 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-amber-500">Interior Snapshot 2</span>
                  <span className="text-[10px] text-neutral-500">Rotate +6°</span>
                </div>
                <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800">
                  <Image
                    src={heroPreview2 || aboutData.heroImages?.[2]?.url || 'https://res.cloudinary.com/demo/image/upload/sample.jpg'}
                    alt="Interior 2"
                    fill
                    className="object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Alt Description</label>
                  <input
                    type="text"
                    value={heroAlt2}
                    onChange={(e) => setHeroAlt2(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Replace Image (Max 10MB)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleHeroImageChange(2, e.target.files?.[0] || null)}
                    className="w-full text-xs text-neutral-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-neutral-800 file:text-neutral-300 hover:file:bg-neutral-700 cursor-pointer max-w-full overflow-hidden"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: MANAGER PROFILE & TEAM STATS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 pt-6 border-t border-neutral-800 min-w-0">
              {/* Manager Details */}
              <div className="lg:col-span-6 space-y-5 min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shrink-0" />
                  <span>Store Manager Profile</span>
                </h3>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 min-w-0">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-amber-500 relative overflow-hidden bg-neutral-800 flex-shrink-0">
                    <Image
                      src={
                        managerPreview ||
                        aboutData.manager?.imageUrl ||
                        'https://res.cloudinary.com/demo/image/upload/sample.jpg'
                      }
                      alt={managerName}
                      fill
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-1 min-w-0 w-full">
                    <label className="block text-xs text-neutral-400 mb-1">Upload Manager Photo (Max 10MB)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleManagerImageChange}
                      className="w-full text-xs text-neutral-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-neutral-800 file:text-neutral-300 hover:file:bg-neutral-700 cursor-pointer max-w-full overflow-hidden"
                    />
                    <p className="text-[11px] text-neutral-500 mt-1 break-words">
                      Direct Cloudinary stream to folder: <code className="text-amber-400 break-all">dawood-ox/about</code>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
                  <div className="min-w-0">
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">Manager Full Name</label>
                    <input
                      type="text"
                      required
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="min-w-0">
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">Direct Phone</label>
                    <input
                      type="text"
                      required
                      value={managerPhone}
                      onChange={(e) => setManagerPhone(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">Manager Bio & Story</label>
                  <textarea
                    rows={4}
                    value={managerDescription}
                    onChange={(e) => setManagerDescription(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Team Statistics Manager */}
              <div className="lg:col-span-6 space-y-5 min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shrink-0" />
                  <span>2x2 Team Stat Categories</span>
                </h3>

                <div className="space-y-3 min-w-0">
                  {teamStats.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 sm:gap-3 bg-neutral-950 p-2.5 sm:p-3 rounded-xl border border-neutral-800 min-w-0"
                    >
                      <input
                        type="text"
                        value={item.role}
                        onChange={(e) => {
                          const updated = [...teamStats];
                          updated[idx].role = e.target.value;
                          setTeamStats(updated);
                        }}
                        className="flex-1 min-w-0 bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                      <input
                        type="number"
                        min="0"
                        value={item.count}
                        onChange={(e) => handleUpdateTeamCount(idx, Number(e.target.value) || 0)}
                        className="w-16 sm:w-20 bg-neutral-900 border border-neutral-800 rounded-lg px-2 sm:px-3 py-1.5 text-xs text-amber-500 font-bold text-center focus:outline-none focus:border-amber-500 shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveTeamRole(idx)}
                        className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition shrink-0"
                        aria-label="Delete role"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add new stat row */}
                <div className="flex items-center gap-2 sm:gap-3 pt-2 min-w-0">
                  <input
                    type="text"
                    placeholder="Role (e.g. Master Artisans)"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    className="flex-1 min-w-0 bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 sm:px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="Count"
                    value={newRoleCount}
                    onChange={(e) => setNewRoleCount(Number(e.target.value))}
                    className="w-16 sm:w-20 bg-neutral-950 border border-neutral-800 rounded-xl px-2 sm:px-3 py-2 text-xs text-white text-center focus:outline-none focus:border-amber-500 shrink-0"
                  />
                  <button
                    type="button"
                    onClick={handleAddTeamRole}
                    className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition shrink-0"
                  >
                    <Plus className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-6 border-t border-neutral-800 flex justify-end min-w-0">
              <button
                type="submit"
                disabled={aboutSaving}
                className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs sm:text-sm transition shadow-lg shadow-amber-500/20 disabled:opacity-50 max-w-full"
              >
                {aboutSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Saving to Database & Cloudinary...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 shrink-0" />
                    <span>Save About Page Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* SECTION 3: GALLERY MANAGER */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 shadow-xl w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800 min-w-0">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Film className="w-5 h-5 text-amber-500 shrink-0" />
                <span className="truncate">Gallery Manager (Direct Cloudinary Upload)</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5 break-words">
                Upload image (≤ 10MB) or video (≤ 100MB, duration ≤ 10s). Saved directly to Cloudinary{' '}
                <code className="text-amber-400 break-all">dawood-ox/gallery</code>.
              </p>
            </div>
            <div className="text-xs text-neutral-400 bg-neutral-950 px-3 py-1.5 rounded-xl border border-neutral-800 inline-flex items-center gap-2 shrink-0 self-start sm:self-auto">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>{galleryItems.length} Items Live</span>
            </div>
          </div>

          {/* Add Media Upload Form */}
          <form onSubmit={handleUploadGalleryItem} className="bg-neutral-950 p-4 sm:p-6 rounded-2xl border border-neutral-800 space-y-6 min-w-0">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-500 flex items-center gap-2">
              <Plus className="w-4 h-4 shrink-0" />
              <span>Add New Showcase Media</span>
            </h3>

            {galleryError && (
              <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-red-300 text-xs flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                <span className="break-words">{galleryError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start min-w-0">
              {/* Media File Input & Preview */}
              <div className="lg:col-span-5 space-y-3 min-w-0">
                <label className="block text-xs font-semibold text-neutral-300">
                  Select Media (Image ≤ 10MB or Video ≤ 100MB, ≤ 10s)
                </label>
                <input
                  ref={galleryFileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleGalleryFileSelect}
                  className="w-full text-xs text-neutral-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-neutral-800 file:text-amber-400 hover:file:bg-neutral-700 cursor-pointer max-w-full overflow-hidden"
                />

                {galleryPreview && (
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 mt-3">
                    {galleryFileType === 'video' ? (
                      <video
                        src={galleryPreview}
                        controls
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Image
                        src={galleryPreview}
                        alt="Upload Preview"
                        fill
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="absolute top-2 right-2 bg-neutral-950/80 px-2 py-0.5 rounded text-[10px] font-bold uppercase text-amber-400">
                      Preview: {galleryFileType}
                    </div>
                  </div>
                )}
              </div>

              {/* Title & Description */}
              <div className="lg:col-span-7 space-y-4 min-w-0">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Media Title (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Charsadda Norozi Chappal Stitching"
                    value={galleryTitle}
                    onChange={(e) => setGalleryTitle(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Caption / Description (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe the artisan technique or material highlights..."
                    value={galleryDescription}
                    onChange={(e) => setGalleryDescription(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={galleryUploading || !galleryFile}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition shadow-lg shadow-amber-500/20 disabled:opacity-40"
                  >
                    {galleryUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        <span>Streaming to Cloudinary...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 shrink-0" />
                        <span>Upload to Gallery</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Current Gallery Items Grid */}
          <div className="space-y-4 min-w-0">
            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
              Live Gallery Items ({galleryItems.length})
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5 min-w-0">
              {galleryItems.map((item) => (
                <div
                  key={String(item._id)}
                  className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden flex flex-col justify-between shadow-md group min-w-0"
                >
                  <div className="relative aspect-[4/3] bg-neutral-900 overflow-hidden">
                    {item.type === 'video' ? (
                      <video
                        src={item.url}
                        controls
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Image
                        src={item.url}
                        alt={item.title || 'Gallery item'}
                        fill
                        className="object-cover group-hover:scale-105 transition duration-300"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <span className="absolute top-2 left-2 bg-neutral-950/80 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold uppercase text-amber-400 flex items-center gap-1">
                      {item.type === 'video' ? <Film className="w-3 h-3 shrink-0" /> : <ImageIcon className="w-3 h-3 shrink-0" />}
                      <span>{item.type}</span>
                    </span>
                  </div>

                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <h4 className="text-sm font-bold text-white line-clamp-1 break-words">
                        {item.title || 'Untitled Showcase Item'}
                      </h4>
                      {item.description && (
                        <p className="text-xs text-neutral-400 mt-1 line-clamp-2 break-words">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-neutral-800 flex items-center justify-between gap-2 min-w-0">
                      <span className="text-[10px] text-neutral-500 truncate">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Active'}
                      </span>
                      <button
                        onClick={() => handleDeleteGalleryItem(String(item._id))}
                        disabled={deletingId === String(item._id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/50 text-xs font-semibold transition disabled:opacity-50 shrink-0"
                      >
                        {deletingId === String(item._id) ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {galleryItems.length === 0 && (
              <div className="p-8 text-center text-neutral-500 text-sm bg-neutral-950 rounded-2xl border border-neutral-800">
                No items in the gallery yet. Use the upload form above to add your first photo or video.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

