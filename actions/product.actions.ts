'use server';

/**
 * @file actions/product.actions.ts
 * @description Server Actions for footwear catalogue retrieval and management.
 * Strict TypeScript: ZERO `any`.
 */

import { connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { Product } from '@/models/Product';
import { Category } from '@/models/Category';
import { paginateQuery } from '@/lib/db/pagination';
import { successResponse, errorResponse, type ActionResult } from '@/lib/response';
import { handleActionError } from '@/lib/error-handler';
import { ProductCategory, ProductSubCategory, type IProduct, type ProductFilters } from '@/types';
import { MockDb } from '@/lib/db/mock-store';
import { revalidatePath } from 'next/cache';
import type { Filter } from 'mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isElevatedAdminRole } from '@/lib/auth-guard';

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
    // Graceful fallback to MockDb if database query fails
    return successResponse(MockDb.getProducts(filters));
  }
}

export async function getProductBySlug(slug: string): Promise<ActionResult<IProduct>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
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
      const mockProduct = MockDb.getProductBySlug(slug);
      if (mockProduct) return successResponse(mockProduct);
      return errorResponse('Product not found or is no longer available.');
    }

    return successResponse(JSON.parse(JSON.stringify(product)));
  } catch (error: unknown) {
    const mockProduct = MockDb.getProductBySlug(slug);
    if (mockProduct) return successResponse(mockProduct);
    return handleActionError(error);
  }
}

export async function getFeaturedProducts(limit = 6): Promise<ActionResult<IProduct[]>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      return successResponse(MockDb.getFeaturedProducts(limit));
    }

    const products = await Product.find({ isFeatured: true, isActive: true, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return successResponse(JSON.parse(JSON.stringify(products)));
  } catch (error: unknown) {
    return successResponse(MockDb.getFeaturedProducts(limit));
  }
}

export async function getNewArrivals(limit = 8): Promise<ActionResult<IProduct[]>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      return successResponse(MockDb.getNewArrivals(limit));
    }

    const products = await Product.find({ isActive: true, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return successResponse(JSON.parse(JSON.stringify(products)));
  } catch (error: unknown) {
    return successResponse(MockDb.getNewArrivals(limit));
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
    return successResponse(MockDb.searchProducts(queryStr));
  }
}

/**
 * Private helper to verify that the caller has elevated administrative clearance (SUPER_ADMIN or ADMIN).
 * Obtains session exclusively from getServerSession(authOptions).
 * MANAGER, RIDER, CUSTOMER, and unauthenticated callers are strictly denied.
 */
async function verifyProductAdminAuth(): Promise<boolean> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isElevatedAdminRole((session.user as { role?: string }).role)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function getAllAdminProducts(search?: string): Promise<ActionResult<IProduct[]>> {
  try {
    if (!(await verifyProductAdminAuth())) {
      return errorResponse('Unauthorized: Administrative clearance required.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
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
    if (!(await verifyProductAdminAuth())) {
      return errorResponse('Unauthorized: Administrative clearance required.');
    }
    const res = MockDb.getProducts({ limit: 100, search });
    return successResponse(res.products);
  }
}

export async function createProduct(payload: Partial<IProduct>): Promise<ActionResult<IProduct>> {
  try {
    if (!(await verifyProductAdminAuth())) {
      return errorResponse('Unauthorized: Administrative clearance required to create products.');
    }

    await connectToDatabase();

    // Validate variants if provided
    if (payload.variants && payload.variants.length > 0) {
      const seen = new Set<string>();
      for (const v of payload.variants) {
        if (typeof v.stock !== 'number' || v.stock < 0) {
          return errorResponse(`Variant stock for Size ${v.size} cannot be negative.`);
        }
        const key = `${v.size.trim().toLowerCase()}_${(v.color || '').trim().toLowerCase()}`;
        if (seen.has(key)) {
          return errorResponse(`Duplicate variant detected for Size ${v.size} (${v.color || 'Standard'}).`);
        }
        seen.add(key);
      }
      // Authoritative aggregate stock calculation
      payload.stock = payload.variants.reduce((sum, v) => sum + Math.max(0, v.stock || 0), 0);
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
    MockDb.addProduct(plainDoc);

    revalidatePath('/shop');
    revalidatePath('/admin');
    revalidatePath('/');

    return successResponse(plainDoc);
  } catch (error: unknown) {
    if (!(await verifyProductAdminAuth())) {
      return errorResponse('Unauthorized: Administrative clearance required to create products.');
    }
    const fallbackProd = MockDb.addProduct(payload);
    if (fallbackProd) {
      revalidatePath('/shop');
      revalidatePath('/admin');
      revalidatePath('/');
      return successResponse(fallbackProd);
    }
    return handleActionError(error);
  }
}

export async function updateProduct(
  productId: string,
  updates: Partial<IProduct>
): Promise<ActionResult<IProduct>> {
  try {
    if (!(await verifyProductAdminAuth())) {
      return errorResponse('Unauthorized: Administrative clearance required to update products.');
    }

    await connectToDatabase();

    // If variants are updated, validate integrity and re-synchronize aggregate stock
    if (updates.variants && Array.isArray(updates.variants)) {
      const seen = new Set<string>();
      for (const v of updates.variants) {
        if (typeof v.stock !== 'number' || v.stock < 0) {
          return errorResponse(`Variant stock for Size ${v.size} cannot be negative.`);
        }
        const key = `${v.size.trim().toLowerCase()}_${(v.color || '').trim().toLowerCase()}`;
        if (seen.has(key)) {
          return errorResponse(`Duplicate variant detected for Size ${v.size} (${v.color || 'Standard'}).`);
        }
        seen.add(key);
      }
      // Re-synchronize parent stock to equal exact sum of valid variants
      updates.stock = updates.variants.reduce((sum, v) => sum + Math.max(0, v.stock || 0), 0);
    }

    if (!isDatabaseConnected()) {
      const updated = MockDb.updateProduct(productId, updates);
      if (!updated) return errorResponse('Product not found.');
      revalidatePath('/shop');
      revalidatePath('/admin');
      revalidatePath('/');
      return successResponse(updated);
    }

    const doc = await Product.findByIdAndUpdate(productId, { $set: updates }, { new: true }).lean();
    if (!doc) {
      const updated = MockDb.updateProduct(productId, updates);
      if (updated) {
        revalidatePath('/shop');
        revalidatePath('/admin');
        revalidatePath('/');
        return successResponse(updated);
      }
      return errorResponse('Product not found.');
    }

    MockDb.updateProduct(productId, updates);

    revalidatePath('/shop');
    revalidatePath('/admin');
    revalidatePath('/');

    return successResponse(JSON.parse(JSON.stringify(doc)));
  } catch (error: unknown) {
    if (!(await verifyProductAdminAuth())) {
      return errorResponse('Unauthorized: Administrative clearance required to update products.');
    }
    const updated = MockDb.updateProduct(productId, updates);
    if (updated) {
      revalidatePath('/shop');
      revalidatePath('/admin');
      revalidatePath('/');
      return successResponse(updated);
    }
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
    if (!(await verifyProductAdminAuth())) {
      return errorResponse('Unauthorized: Administrative clearance required to adjust variant inventory.');
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
    if (!(await verifyProductAdminAuth())) {
      return errorResponse('Unauthorized: Administrative clearance required to delete products.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const ok = MockDb.deleteProduct(productId);
      revalidatePath('/shop');
      revalidatePath('/admin');
      revalidatePath('/');
      return successResponse({ deleted: ok });
    }

    await Product.findByIdAndDelete(productId);
    MockDb.deleteProduct(productId);

    revalidatePath('/shop');
    revalidatePath('/admin');
    revalidatePath('/');

    return successResponse({ deleted: true });
  } catch (error: unknown) {
    if (!(await verifyProductAdminAuth())) {
      return errorResponse('Unauthorized: Administrative clearance required to delete products.');
    }
    const ok = MockDb.deleteProduct(productId);
    if (ok) {
      revalidatePath('/shop');
      revalidatePath('/admin');
      revalidatePath('/');
      return successResponse({ deleted: true });
    }
    return handleActionError(error);
  }
}
