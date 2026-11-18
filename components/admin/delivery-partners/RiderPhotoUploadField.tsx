'use client';

/**
 * @file components/admin/delivery-partners/RiderPhotoUploadField.tsx
 * @description Controlled rider photo file picker with client-side validation,
 * local ObjectURL image preview, Change Photo, and Remove Photo actions.
 * Strict TypeScript: ZERO `any`.
 */

import React from 'react';
import Image from 'next/image';
import { Upload, RefreshCw, Trash2, ImageIcon, AlertCircle } from 'lucide-react';
import {
  DELIVERY_PARTNER_PHOTO_ACCEPT,
  DELIVERY_PARTNER_PHOTO_MAX_SIZE_LABEL,
  validateRiderPhotoFileMeta,
} from '@/lib/delivery-partner-photo-validation';

interface RiderPhotoUploadFieldProps {
  selectedFile: File | null;
  previewUrl: string | null;
  existingPhotoUrl?: string | null;
  photoRemoved?: boolean;
  error: string | null;
  disabled?: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (file: File) => void;
  onValidationError: (message: string | null) => void;
  onRemovePhoto: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function RiderPhotoUploadField({
  selectedFile,
  previewUrl,
  existingPhotoUrl,
  photoRemoved = false,
  error,
  disabled = false,
  inputRef,
  onFileSelect,
  onValidationError,
  onRemovePhoto,
}: RiderPhotoUploadFieldProps) {
  const effectivePreviewUrl =
    previewUrl || (!photoRemoved && existingPhotoUrl ? existingPhotoUrl : null);

  const triggerFilePicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateRiderPhotoFileMeta({
      name: file.name,
      type: file.type,
      size: file.size,
    });

    if (!validation.valid) {
      e.target.value = '';
      onValidationError(validation.error || 'Invalid image file.');
      return;
    }

    onValidationError(null);
    onFileSelect(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="font-bold text-neutral-300">
          Rider Photo <span className="text-[11px] font-normal text-neutral-500">(Optional)</span>
        </label>
        <span className="text-[10px] text-neutral-500">
          JPG, JPEG, PNG, WEBP • Max {DELIVERY_PARTNER_PHOTO_MAX_SIZE_LABEL}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={DELIVERY_PARTNER_PHOTO_ACCEPT}
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
        aria-label="Rider Photo file input"
      />

      {effectivePreviewUrl ? (
        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative h-16 w-16 rounded-xl bg-neutral-900 border border-neutral-700 overflow-hidden shrink-0">
              <Image
                src={effectivePreviewUrl}
                alt={selectedFile?.name || 'Rider photo preview'}
                fill
                referrerPolicy="no-referrer"
                className="object-cover"
                sizes="64px"
              />
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-bold text-white truncate">
                {selectedFile ? selectedFile.name : 'Current Saved Photo'}
              </p>
              <p className="text-[11px] text-neutral-400">
                {selectedFile
                  ? `${formatFileSize(selectedFile.size)} • Ready to upload`
                  : 'Existing rider photo preserved unless changed'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={triggerFilePicker}
              disabled={disabled}
              className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="h-3.5 w-3.5 text-amber-400" />
              <span>Change Photo</span>
            </button>
            <button
              type="button"
              onClick={onRemovePhoto}
              disabled={disabled}
              className="px-3 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/60 border border-red-500/30 text-red-300 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Remove Photo</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-neutral-950 border border-dashed border-neutral-800 hover:border-amber-400/50 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0">
              <ImageIcon className="h-5 w-5 text-neutral-500" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-neutral-300">
                Select a photo from your device
              </p>
              <p className="text-[11px] text-neutral-500">
                Supported: JPG, JPEG, PNG, WEBP (Max {DELIVERY_PARTNER_PHOTO_MAX_SIZE_LABEL})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={triggerFilePicker}
            disabled={disabled}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <Upload className="h-3.5 w-3.5 text-amber-400" />
            <span>Upload Rider Photo</span>
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-2.5 rounded-xl bg-red-950/70 border border-red-500/40 text-red-300 text-[11px] font-medium flex items-center gap-2"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
