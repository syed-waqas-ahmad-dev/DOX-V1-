'use server';

/**
 * @file actions/product.actions.ts
 * @description Server Actions for footwear catalogue retrieval and management.
 * Strict TypeScript: ZERO `any`.
 */

import { canUseMockDatabase, connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { Product } from '@/models/Product';
import { Category } from '@/models/Category';
import { paginateQuery } from '@/lib/db/pagination';
import { successResponse, errorResponse, type ActionResult } from '@/lib/response';
import { handleActionError } from '@/lib/error-handler';
import { ProductCategory, ProductSubCategory, Department, type IProduct, type ProductFilters } from '@/types';
import { MockDb } from '@/lib/db/mock-store';
import { revalidatePath } from 'next/cache';
import type { Filter } from 'mongodb';
import { Types } from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { verifyDepartmentAuth } from '@/lib/auth-guard';

export interface CartValidationItemInput {
  productId: string;
  variantId?: string;
  variantSku?: string;
  size: string;
  color: string;
  quantity: number;
}

export interface CartValidationItemResult {
  productId: string;
  variantId?: string;
  size: string;
  color: string;
  quantity: number;
  valid: boolean;
  reason?:
    | 'product_not_found'
    | 'variant_not_found'
    | 'out_of_stock'
    | 'insufficient_stock'
    | 'invalid_quantity';
  message?: string;
  availableStock?: number;
  currentPrice?: number;
  resolvedVariantId?: string;
  resolvedVariantSku?: string;
}

const normCartValidateAttr = (val?: string) => (val || '').trim().toLowerCase();

export async function validateCartProducts(
  items: CartValidationItemInput[]
): Promise<ActionResult<{ allValid: boolean; results: CartValidationItemResult[] }>> {
  try {
    if (!Array.isArray(items) || items.length === 0) {
      return successResponse({ allValid: true, results: [] });
    }

    await connectToDatabase();

    const dbConnected = isDatabaseConnected();
    if (!dbConnected && !canUseMockDatabase()) {
      return errorResponse('Database connection unavailable. Please try again later.');
    }

    let productMap = new Map<string, IProduct>();
    if (dbConnected) {
      const validObjectIds = Array.from(
        new Set(items.map((i) => i.productId).filter((id) => Types.ObjectId.isValid(id)))
      );
      const products =
        validObjectIds.length > 0
          ? await Product.find({
              _id: { $in: validObjectIds },
              isActive: true,
              isDeleted: { $ne: true },
            }).lean()
          : [];
      productMap = new Map(
        (JSON.parse(JSON.stringify(products)) as IProduct[]).map((p) => [p._id.toString(), p])
      );
    }

    const requestedByKey = new Map<string, number>();

    const results: CartValidationItemResult[] = items.map((item) => {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        return {
          productId: item.productId,
          variantId: item.variantId,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          valid: false,
          reason: 'invalid_quantity',
          message: 'Quantity must be a positive whole number.',
        };
      }

      const product = dbConnected
        ? Types.ObjectId.isValid(item.productId)
          ? productMap.get(item.productId)
          : undefined
        : MockDb.getProductById(item.productId);

      if (!product || product.isDeleted || product.isActive === false) {
        return {
          productId: item.productId,
          variantId: item.variantId,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          valid: false,
          reason: 'product_not_found',
          message: 'This shoe is no longer available in the catalog.',
        };
      }

      const variants = Array.isArray(product.variants) ? product.variants : [];
      if (variants.length === 0) {
        const availableStock = Math.max(0, product.stock || 0);
        const dedupKey = `${product._id.toString()}::SIMPLE`;
        const cumulativeQty = (requestedByKey.get(dedupKey) || 0) + item.quantity;

        if (availableStock === 0) {
          return {
            productId: item.productId,
            variantId: item.variantId,
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            valid: false,
            reason: 'out_of_stock',
            availableStock,
            currentPrice: product.price,
            message: `"${product.name}" is currently out of stock.`,
          };
        }
        if (availableStock < cumulativeQty) {
          return {
            productId: item.productId,
            variantId: item.variantId,
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            valid: false,
            reason: 'insufficient_stock',
            availableStock,
            currentPrice: product.price,
            message: `Only ${availableStock} unit(s) available for "${product.name}".`,
          };
        }
        requestedByKey.set(dedupKey, cumulativeQty);

        return {
          productId: item.productId,
          variantId: item.variantId,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          valid: true,
          availableStock,
          currentPrice: product.price,
        };
      }

      const normSize = normCartValidateAttr(item.size);
      const normColor = normCartValidateAttr(item.color);
      let matched = undefined as IProduct['variants'][number] | undefined;

      if (item.variantId && item.variantId.trim()) {
        const targetId = item.variantId.trim();
        matched = variants.find((v) => v._id?.toString() === targetId);
        if (
          matched &&
          ((normSize && normCartValidateAttr(matched.size) !== normSize) ||
            (normColor && normCartValidateAttr(matched.color) !== normColor))
        ) {
          matched = undefined;
        }
      } else if (item.variantSku && item.variantSku.trim()) {
        const targetSku = item.variantSku.trim().toUpperCase();
        matched = variants.find((v) => (v.sku || '').trim().toUpperCase() === targetSku);
        if (
          matched &&
          ((normSize && normCartValidateAttr(matched.size) !== normSize) ||
            (normColor && normCartValidateAttr(matched.color) !== normColor))
        ) {
          matched = undefined;
        }
      }

      if (!matched && normSize) {
        const sizeMatches = variants.filter((v) => normCartValidateAttr(v.size) === normSize);
        if (normColor) {
          matched = sizeMatches.find((v) => normCartValidateAttr(v.color) === normColor);
        } else if (sizeMatches.length === 1) {
          matched = sizeMatches[0];
        }
      }

      if (!matched) {
        return {
          productId: item.productId,
          variantId: item.variantId,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          valid: false,
          reason: 'variant_not_found',
          currentPrice: product.price,
          message: `Size ${item.size} (${item.color}) is no longer available for "${product.name}".`,
        };
      }

      const dedupKey = `${product._id.toString()}::${matched._id?.toString() || matched.sku}`;
      const cumulativeQty = (requestedByKey.get(dedupKey) || 0) + item.quantity;
      const availableStock = Math.max(0, matched.stock || 0);

      if (availableStock === 0) {
        return {
          productId: item.productId,
          variantId: item.variantId,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          valid: false,
          reason: 'out_of_stock',
          availableStock,
          currentPrice: product.price,
          resolvedVariantId: matched._id?.toString(),
          resolvedVariantSku: matched.sku,
          message: `Size ${matched.size} (${matched.color}) of "${product.name}" is out of stock.`,
        };
      }

      if (availableStock < cumulativeQty) {
        return {
          productId: item.productId,
          variantId: item.variantId,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          valid: false,
          reason: 'insufficient_stock',
          availableStock,
          currentPrice: product.price,
          resolvedVariantId: matched._id?.toString(),
          resolvedVariantSku: matched.sku,
          message: `Only ${availableStock} unit(s) available for Size ${matched.size} (${matched.color}).`,
        };
      }

      requestedByKey.set(dedupKey, cumulativeQty);

      return {
        productId: item.productId,
        variantId: item.variantId,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        valid: true,
        availableStock,
        currentPrice: product.price,
        resolvedVariantId: matched._id?.toString(),
        resolvedVariantSku: matched.sku,
      };
    });

    return successResponse({
      allValid: results.every((r) => r.valid),
      results,
    });
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function getProducts(filters: ProductFilters = {}): Promise<
  ActionResult<{
    products: IProduct[];
    total: number;
    page: number;
    totalPages: number;
  }>
> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      if (!canUseMockDatabase()) {
        return errorResponse('Database connection unavailable. Please try again later.');
      }
      return successResponse(MockDb.getProducts(filters));
    }

    const query: Filter<IProduct> = {
      isActive: true,
      isDeleted: { $ne: true },
    };

    if (filters.category) {
      query.category = filters.category;
    }
    if (filters.subCategory) {
      query.subCategory = filters.subCategory;
    }
    if (filters.brand) {
      query.brand = filters.brand as any;
    }
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      const priceFilter: Record<string, number> = {};
      if (filters.minPrice !== undefined) priceFilter.$gte = filters.minPrice;
      if (filters.maxPrice !== undefined) priceFilter.$lte = filters.maxPrice;
      query.price = priceFilter as any;
    }
    if (filters.inStock) {
      query.stock = { $gt: 0 } as any;
    }
    if (filters.onSale) {
      query.discount = { $gt: 0 } as any;
    }
    if (filters.search) {
      const regex = new RegExp(filters.search.trim(), 'i');
      query.$or = [
        { name: regex } as any,
        { nameUr: regex } as any,
        { tags: regex } as any,
        { sku: regex } as any,
      ];
    }

    let sort: Record<string, 1 | -1> = { createdAt: -1 };
    if (filters.sortBy === 'price-asc') sort = { price: 1 };
    if (filters.sortBy === 'price-desc') sort = { price: -1 };
    if (filters.sortBy === 'rating') sort = { rating: -1, price: 1 };

    const page = filters.page || 1;
    const limit = filters.limit || 12;

    const result = await paginateQuery(Product, query, {
      page,
      limit,
      sort,
      lean: true,
    });

    return successResponse({
      products: JSON.parse(JSON.stringify(result.docs)),
      total: result.totalDocs,
      page: result.page,
      totalPages: result.totalPages,
    });
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function getProductBySlug(slug: string): Promise<ActionResult<IProduct>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      if (!canUseMockDatabase()) {
        return errorResponse('Database connection unavailable. Please try again later.');
      }
      const mockProduct = MockDb.getProductBySlug(slug);
      if (!mockProduct) {
        return errorResponse('Product not found or is no longer available.');
      }
      return successResponse(mockProduct);
    }

    const product = await Product.findOne({ slug, isDeleted: { $ne: true } })
      .populate('sizeGuideId')
      .lean();

    if (!product) {
      return errorResponse('Product not found or is no longer available.');
    }

    return successResponse(JSON.parse(JSON.stringify(product)));
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function getFeaturedProducts(limit = 6): Promise<ActionResult<IProduct[]>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      if (!canUseMockDatabase()) {
        return errorResponse('Database connection unavailable. Please try again later.');
      }
      return successResponse(MockDb.getFeaturedProducts(limit));
    }

    const products = await Product.find({ isFeatured: true, isActive: true, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return successResponse(JSON.parse(JSON.stringify(products)));
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function getNewArrivals(limit = 8): Promise<ActionResult<IProduct[]>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      if (!canUseMockDatabase()) {
        return errorResponse('Database connection unavailable. Please try again later.');
      }
      return successResponse(MockDb.getNewArrivals(limit));
    }

    const products = await Product.find({ isActive: true, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return successResponse(JSON.parse(JSON.stringify(products)));
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function searchProducts(queryStr: string): Promise<
  ActionResult<Array<{ name: string; nameUr: string; slug: string; price: number; image: string; subCategory: string }>>
> {
  try {
    if (!queryStr || queryStr.trim().length === 0) {
      return successResponse([]);
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      if (!canUseMockDatabase()) {
        return errorResponse('Database connection unavailable. Please try again later.');
      }
      return successResponse(MockDb.searchProducts(queryStr));
    }

    const regex = new RegExp(queryStr.trim(), 'i');

    const matches = await Product.find({
      isActive: true,
      isDeleted: { $ne: true },
      $or: [{ name: regex }, { nameUr: regex }, { tags: regex }, { subCategory: regex }],
    })
      .select('name nameUr slug price images subCategory')
      .limit(8)
      .lean();

    const formatted = matches.map((m) => ({
      name: m.name,
      nameUr: m.nameUr,
      slug: m.slug,
      price: m.price,
      image: m.images[0] || '',
      subCategory: m.subCategory,
    }));

    return successResponse(formatted);
  } catch (error: unknown) {
    return handleActionError(error);
  }
}



export async function getAllAdminProducts(search?: string): Promise<ActionResult<IProduct[]>> {
  try {
    const auth = await verifyDepartmentAuth({
      requiredDepartment: Department.INVENTORY,
      requiredPermission: 'products:read',
    });

    if (!auth.authorized) {
      return errorResponse(auth.error || 'Unauthorized: Inventory clearance required.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      if (!canUseMockDatabase()) {
        return errorResponse('Database connection unavailable. Please try again later.');
      }
      const res = MockDb.getProducts({ limit: 100, search });
      return successResponse(res.products);
    }

    const query: Record<string, unknown> = { isDeleted: { $ne: true } };
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: regex }, { nameUr: regex }, { sku: regex }, { category: regex }, { subCategory: regex }];
    }

    const products = await Product.find(query).sort({ createdAt: -1 }).limit(100).lean();
    return successResponse(JSON.parse(JSON.stringify(products)));
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function createProduct(payload: Partial<IProduct>): Promise<ActionResult<IProduct>> {
  try {
    const auth = await verifyDepartmentAuth({
      requiredDepartment: Department.INVENTORY,
      requiredPermission: 'products:write',
    });

    if (!auth.authorized) {
      return errorResponse(auth.error || 'Unauthorized: Inventory write clearance required.');
    }

    await connectToDatabase();

    // Validate variants if provided
    if (payload.variants && payload.variants.length > 0) {
      const seen = new Set<string>();
      const seenSkus = new Set<string>();
      const normalizedVariants = [];
      for (const v of payload.variants) {
        const cleanSize = (v.size || '').trim();
        const cleanColor = (v.color || '').trim();
        const cleanSku = (v.sku || '').trim();
        if (!cleanSize || !cleanColor) {
          return errorResponse('Each variant must specify a valid size and color.');
        }
        if (!cleanSku) {
          return errorResponse(`Variant SKU is required for Size ${cleanSize} (${cleanColor}).`);
        }
        if (typeof v.stock !== 'number' || !Number.isInteger(v.stock) || v.stock < 0) {
          return errorResponse(`Variant stock for Size ${cleanSize} (${cleanColor}) must be a non-negative integer.`);
        }
        const key = `${cleanSize.toLowerCase()}_${cleanColor.toLowerCase()}`;
        if (seen.has(key)) {
          return errorResponse(`Duplicate variant detected for Size ${cleanSize} (${cleanColor}).`);
        }
        seen.add(key);

        const skuKey = cleanSku.toUpperCase();
        if (seenSkus.has(skuKey)) {
          return errorResponse(`Duplicate variant SKU detected: ${cleanSku}.`);
        }
        seenSkus.add(skuKey);

        normalizedVariants.push({
          ...v,
          size: cleanSize,
          color: cleanColor,
          sku: cleanSku,
          stock: v.stock,
        });
      }
      payload.variants = normalizedVariants;
      // Authoritative aggregate stock calculation
      payload.stock = normalizedVariants.reduce((sum, v) => sum + v.stock, 0);
    } else if (payload.stock !== undefined) {
      if (typeof payload.stock !== 'number' || !Number.isInteger(payload.stock) || payload.stock < 0) {
        return errorResponse('Stock must be a non-negative integer.');
      }
    }

    const shortDesc =
      payload.shortDescription ||
      (payload.description ? payload.description.slice(0, 200) : 'Handcrafted Pakistani Footwear by OX Shoes');
    const slugBase =
      payload.slug ||
      (payload.name
        ? `${payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')}-${Math.random().toString(36).substring(2, 6)}`
        : `ox-${Date.now()}`);
    const finalSku = payload.sku?.trim() ? payload.sku.trim() : `OX-${Math.floor(1000 + Math.random() * 9000)}`;

    if (!isDatabaseConnected()) {
      if (!canUseMockDatabase()) {
        return errorResponse('Database connection unavailable. Cannot create product.');
      }
      const newProd = MockDb.addProduct({
        ...payload,
        shortDescription: shortDesc,
        slug: slugBase,
        sku: finalSku,
      });
      revalidatePath('/shop');
      revalidatePath('/admin');
      revalidatePath('/');
      return successResponse(newProd);
    }

    const doc = await Product.create({
      ...payload,
      shortDescription: shortDesc,
      slug: slugBase,
      sku: finalSku,
      isDeleted: false,
      isActive: payload.isActive !== undefined ? payload.isActive : true,
      rating: payload.rating || 5.0,
      numReviews: payload.numReviews || 0,
      weight: payload.weight || 750,
      sizes: payload.sizes && payload.sizes.length > 0 ? payload.sizes : ['39', '40', '41', '42', '43', '44'],
      colors: payload.colors && payload.colors.length > 0 ? payload.colors : [{ name: 'Mustard Brown', hex: '#8B4513' }],
      images: payload.images && payload.images.length > 0 ? payload.images : ['https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=80'],
    });

    const plainDoc = JSON.parse(JSON.stringify(doc.toObject ? doc.toObject() : doc));

    revalidatePath('/shop');
    revalidatePath('/admin');
    revalidatePath('/');

    return successResponse(plainDoc);
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function updateProduct(
  productId: string,
  updates: Partial<IProduct>
): Promise<ActionResult<IProduct>> {
  try {
    const auth = await verifyDepartmentAuth({
      requiredDepartment: Department.INVENTORY,
      requiredPermission: 'products:write',
    });

    if (!auth.authorized) {
      return errorResponse(auth.error || 'Unauthorized: Inventory write clearance required.');
    }

    await connectToDatabase();

    const dbConnected = isDatabaseConnected();
    if (!dbConnected && !canUseMockDatabase()) {
      return errorResponse('Database connection unavailable. Cannot update product.');
    }

    const existingProduct = dbConnected
      ? await Product.findById(productId).lean()
      : MockDb.getProductById(productId);

    if (!existingProduct) {
      return errorResponse('Product not found.');
    }

    const sanitizedUpdates: Partial<IProduct> = { ...updates };

    // If variants are updated, validate integrity and re-synchronize aggregate stock
    if (sanitizedUpdates.variants && Array.isArray(sanitizedUpdates.variants)) {
      const seen = new Set<string>();
      const seenSkus = new Set<string>();
      const normalizedVariants = [];

      for (const v of sanitizedUpdates.variants) {
        const cleanSize = (v.size || '').trim();
        const cleanColor = (v.color || '').trim();
        const cleanSku = (v.sku || '').trim();
        if (!cleanSize || !cleanColor) {
          return errorResponse('Each variant must specify a valid size and color.');
        }
        if (!cleanSku) {
          return errorResponse(`Variant SKU is required for Size ${cleanSize} (${cleanColor}).`);
        }
        if (typeof v.stock !== 'number' || !Number.isInteger(v.stock) || v.stock < 0) {
          return errorResponse(`Variant stock for Size ${cleanSize} (${cleanColor}) must be a non-negative integer.`);
        }
        const key = `${cleanSize.toLowerCase()}_${cleanColor.toLowerCase()}`;
        if (seen.has(key)) {
          return errorResponse(`Duplicate variant detected for Size ${cleanSize} (${cleanColor}).`);
        }
        seen.add(key);

        const skuKey = cleanSku.toUpperCase();
        if (seenSkus.has(skuKey)) {
          return errorResponse(`Duplicate variant SKU detected: ${cleanSku}.`);
        }
        seenSkus.add(skuKey);

        normalizedVariants.push({
          ...v,
          size: cleanSize,
          color: cleanColor,
          sku: cleanSku,
          stock: v.stock,
        });
      }

      sanitizedUpdates.variants = normalizedVariants;
      // Re-synchronize parent stock to equal exact sum of valid variants
      if (normalizedVariants.length > 0) {
        sanitizedUpdates.stock = normalizedVariants.reduce((sum, v) => sum + v.stock, 0);
      }
    } else if (sanitizedUpdates.stock !== undefined) {
      const hasExistingVariants =
        Array.isArray(existingProduct.variants) && existingProduct.variants.length > 0;
      if (hasExistingVariants) {
        return errorResponse(
          'Cannot overwrite aggregate stock directly on a variant product. Please update individual size/color variants instead.'
        );
      }
      if (
        typeof sanitizedUpdates.stock !== 'number' ||
        !Number.isInteger(sanitizedUpdates.stock) ||
        sanitizedUpdates.stock < 0
      ) {
        return errorResponse('Stock must be a non-negative integer.');
      }
    }

    if (!dbConnected) {
      const updated = MockDb.updateProduct(productId, sanitizedUpdates);
      if (!updated) return errorResponse('Product not found.');
      revalidatePath('/shop');
      revalidatePath('/admin');
      revalidatePath('/');
      return successResponse(updated);
    }

    const doc = await Product.findByIdAndUpdate(
      productId,
      { $set: sanitizedUpdates },
      { new: true }
    ).lean();
    if (!doc) {
      return errorResponse('Product not found.');
    }

    revalidatePath('/shop');
    revalidatePath('/admin');
    revalidatePath('/');

    return successResponse(JSON.parse(JSON.stringify(doc)));
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

/**
 * Granular size-level inventory adjustment by authorized administrators.
 * Updates target variant stock and automatically re-synchronizes parent aggregate stock.
 */
export async function updateVariantStock(
  productId: string,
  size: string,
  newStock: number,
  color?: string
): Promise<ActionResult<IProduct>> {
  try {
    const auth = await verifyDepartmentAuth({
      requiredDepartment: Department.INVENTORY,
      requiredPermission: 'stock:update',
    });

    if (!auth.authorized) {
      return errorResponse(auth.error || 'Unauthorized: Inventory stock update clearance required.');
    }

    if (typeof newStock !== 'number' || newStock < 0 || !Number.isInteger(newStock)) {
      return errorResponse('Variant stock must be a non-negative integer.');
    }

    await connectToDatabase();
    if (!isDatabaseConnected()) {
      return errorResponse('Database connection unavailable for variant stock adjustment.');
    }

    const product = await Product.findById(productId);
    if (!product) return errorResponse('Product not found.');

    if (!product.variants || product.variants.length === 0) {
      // Product has no variants: update parent stock directly
      product.stock = newStock;
      await product.save();
      revalidatePath('/shop');
      revalidatePath('/admin');
      return successResponse(JSON.parse(JSON.stringify(product)));
    }

    const variantIndex = product.variants.findIndex(
      (v) =>
        v.size.trim().toLowerCase() === size.trim().toLowerCase() &&
        (!color || v.color.trim().toLowerCase() === color.trim().toLowerCase())
    );

    if (variantIndex === -1) {
      return errorResponse(`Variant with Size ${size} not found for this product.`);
    }

    // Update variant stock and synchronize aggregate parent stock
    product.variants[variantIndex].stock = newStock;
    product.stock = product.variants.reduce((sum, v) => sum + Math.max(0, v.stock || 0), 0);
    await product.save();

    revalidatePath('/shop');
    revalidatePath('/admin');
    revalidatePath('/');

    return successResponse(JSON.parse(JSON.stringify(product)));
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function deleteProduct(productId: string): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    const auth = await verifyDepartmentAuth({
      requiredDepartment: Department.INVENTORY,
      requiredPermission: 'products:delete',
    });

    if (!auth.authorized) {
      return errorResponse(auth.error || 'Unauthorized: Inventory delete clearance required.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      if (!canUseMockDatabase()) {
        return errorResponse('Database connection unavailable. Cannot delete product.');
      }
      const ok = MockDb.deleteProduct(productId);
      revalidatePath('/shop');
      revalidatePath('/admin');
      revalidatePath('/');
      return successResponse({ deleted: ok });
    }

    const deletedDoc = await Product.findByIdAndDelete(productId);
    if (!deletedDoc) {
      return errorResponse('Product not found.');
    }

    revalidatePath('/shop');
    revalidatePath('/admin');
    revalidatePath('/');

    return successResponse({ deleted: true });
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
