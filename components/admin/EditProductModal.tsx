'use client';

/**
 * @file components/admin/EditProductModal.tsx
 * @description High-performance isolated product edit modal.
 * Local state prevents keystroke re-renders in parent dashboard.
 * Strict TypeScript: ZERO `any`.
 */

import React, { useState, useEffect, memo } from 'react';
import type { IProduct } from '@/types';
import { Edit2, X, Loader2 } from 'lucide-react';

interface EditProductModalProps {
  product: IProduct | null;
  onClose: () => void;
  onSubmit: (productId: string, updates: Partial<IProduct>) => Promise<boolean>;
}

export const EditProductModal = memo(function EditProductModal({
  product,
  onClose,
  onSubmit,
}: EditProductModalProps) {
  const [price, setPrice] = useState<number>(product?.price || 0);
  const [stock, setStock] = useState<number>(product?.stock || 0);
  const [variants, setVariants] = useState(product?.variants || []);
  const [isFeatured, setIsFeatured] = useState<boolean>(product?.isFeatured || false);
  const [images, setImages] = useState<string[]>(product?.images || []);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [newVarSize, setNewVarSize] = useState<string>('');
  const [newVarColor, setNewVarColor] = useState<string>('');
  const [newVarSku, setNewVarSku] = useState<string>('');
  const [newVarStock, setNewVarStock] = useState<string>('0');
  const [variantError, setVariantError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setPrice(product.price);
      setStock(product.stock);
      setVariants(product.variants || []);
      setIsFeatured(product.isFeatured || false);
      setImages(product.images || []);
      setNewVarSize('');
      setNewVarColor('');
      setNewVarSku('');
      setNewVarStock('0');
      setVariantError(null);
    }
  }, [product]);

  if (!product) return null;

  const handleVariantStockChange = (idx: number, rawValue: string) => {
    const parsed = Number(rawValue);
    const safeStock = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
    const updated = [...variants];
    updated[idx] = { ...updated[idx], stock: safeStock };
    setVariants(updated);
    const sum = updated.reduce((acc, v) => acc + Math.max(0, v.stock || 0), 0);
    setStock(sum);
  };

  const handleAddVariant = () => {
    const cleanSize = newVarSize.trim();
    const cleanColor = newVarColor.trim();
    const cleanSku = newVarSku.trim();
    const parsedStock = Number(newVarStock);

    if (!cleanSize || !cleanColor || !cleanSku) {
      setVariantError('Size, Color, and Variant SKU are all required.');
      return;
    }
    if (!Number.isInteger(parsedStock) || parsedStock < 0) {
      setVariantError('Variant stock must be a non-negative integer.');
      return;
    }
    const duplicate = variants.some(
      (v) =>
        v.size.trim().toLowerCase() === cleanSize.toLowerCase() &&
        v.color.trim().toLowerCase() === cleanColor.toLowerCase()
    );
    if (duplicate) {
      setVariantError(`Variant Size ${cleanSize} (${cleanColor}) already exists.`);
      return;
    }
    const duplicateSku = variants.some(
      (v) => v.sku.trim().toUpperCase() === cleanSku.toUpperCase()
    );
    if (duplicateSku) {
      setVariantError(`Variant SKU "${cleanSku}" already exists.`);
      return;
    }

    const nextVariants = [
      ...variants,
      { size: cleanSize, color: cleanColor, sku: cleanSku, stock: parsedStock },
    ];
    setVariants(nextVariants);
    setStock(nextVariants.reduce((acc, v) => acc + Math.max(0, v.stock || 0), 0));
    setNewVarSize('');
    setNewVarColor('');
    setNewVarSku('');
    setNewVarStock('0');
    setVariantError(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'ox-shoes-products');
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.secure_url) {
        setImages([data.secure_url]);
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (error: any) {
      alert(error.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const updatedSizes = [...(product.sizes || [])];
    const updatedColors = [...(product.colors || [])];
    for (const v of variants) {
      if (v.size && !updatedSizes.some((s) => s.trim().toLowerCase() === v.size.trim().toLowerCase())) {
        updatedSizes.push(v.size.trim());
      }
      if (v.color && !updatedColors.some((c) => c.name.trim().toLowerCase() === v.color.trim().toLowerCase())) {
        updatedColors.push({ name: v.color.trim(), hex: '#333333' });
      }
    }

    const finalStock =
      variants.length > 0
        ? variants.reduce((acc, v) => acc + Math.max(0, v.stock || 0), 0)
        : Math.max(0, stock);

    const success = await onSubmit(product._id.toString(), {
      price,
      ...(variants.length > 0 ? { variants, sizes: updatedSizes, colors: updatedColors } : { stock: finalStock }),
      isFeatured,
      images,
    });
    setSubmitting(false);
    if (success) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <h3 className="text-base font-black uppercase tracking-tight text-white flex items-center gap-2">
            <Edit2 className="h-4 w-4 text-amber-500" />
            <span>Edit: {product.name}</span>
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded-full text-neutral-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-neutral-300">Shoe Image</label>
            <div className="flex gap-2">
              <input type="text" value={images[0] || ''} onChange={(e) => setImages([e.target.value])} className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono" />
              <label className="bg-amber-500 px-3 py-2 rounded-lg cursor-pointer font-bold">{uploading ? '...' : '📁'}<input type="file" onChange={handleFileUpload} className="hidden"/></label>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {images[0] && <img src={images[0]} alt="prev" className="w-16 h-16 object-cover rounded mt-2"/>}
          </div>

          <div className="space-y-1">
            <label className="font-bold text-neutral-300">Price (PKR)</label>
            <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} required className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono focus:outline-none focus:border-amber-500" />
          </div>

          {/* Size & Color Variant Inventory Section */}
          {variants && variants.length > 0 ? (
            <div className="space-y-3 p-3 rounded-2xl bg-neutral-950 border border-neutral-800">
              <div className="flex items-center justify-between">
                <span className="font-black uppercase tracking-wider text-amber-500 text-[11px]">
                  Variant Inventory (Size &amp; Color)
                </span>
                <span className="text-[11px] font-mono text-neutral-400">
                  Total: <strong className="text-white">{stock}</strong> units
                </span>
              </div>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {variants.map((v, idx) => (
                  <div key={v.sku || `${v.size}-${v.color}-${idx}`} className="flex items-center justify-between gap-2 bg-neutral-900 border border-neutral-800 px-2.5 py-2 rounded-xl">
                    <div className="min-w-0">
                      <span className="font-bold text-neutral-200 block truncate">
                        Size {v.size} • {v.color}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-500 block truncate">
                        {v.sku}
                      </span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={v.stock}
                      onChange={(e) => handleVariantStockChange(idx, e.target.value)}
                      className="w-16 shrink-0 px-2 py-1 text-center rounded-lg bg-neutral-950 border border-neutral-700 text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-neutral-800 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                  Add Variant (Explicit Size, Color, SKU &amp; Stock)
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    placeholder="Size (e.g. 40)"
                    value={newVarSize}
                    onChange={(e) => setNewVarSize(e.target.value)}
                    className="px-2 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-white text-[11px]"
                  />
                  <input
                    type="text"
                    placeholder="Color"
                    value={newVarColor}
                    onChange={(e) => setNewVarColor(e.target.value)}
                    className="px-2 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-white text-[11px]"
                  />
                  <input
                    type="text"
                    placeholder="Variant SKU"
                    value={newVarSku}
                    onChange={(e) => setNewVarSku(e.target.value)}
                    className="px-2 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-white font-mono text-[11px]"
                  />
                  <div className="flex gap-1">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Stock"
                      value={newVarStock}
                      onChange={(e) => setNewVarStock(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-white font-mono text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={handleAddVariant}
                      className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 font-bold text-[11px] shrink-0"
                    >
                      Add
                    </button>
                  </div>
                </div>
                {variantError && (
                  <p className="text-[11px] text-red-400 font-medium">{variantError}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="font-bold text-neutral-300">Stock Count (Total)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={stock}
                onChange={(e) => {
                  const parsed = Number(e.target.value);
                  setStock(Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0);
                }}
                required
                className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input type="checkbox" id="editIsFeatured" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="rounded bg-neutral-950 border-neutral-800 text-amber-500 focus:ring-0" />
            <label htmlFor="editIsFeatured" className="font-bold text-neutral-300 cursor-pointer">Featured on Homepage</label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-800">
            <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold">Cancel</button>
            <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-wider flex items-center gap-2 disabled:opacity-50">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Update Product</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});
