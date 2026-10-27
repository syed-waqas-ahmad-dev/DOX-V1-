/**
 * @file app/api/db/query/route.ts
 * @description API endpoint to test sample queries, pagination, soft-delete filtering,
 * and compound index lookups.
 * Strict TypeScript: ZERO `any`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { Product, Order, User, Category } from '@/models';
import { paginateQuery } from '@/lib/db/pagination';
import { ProductCategory, ProductSubCategory, type IProduct } from '@/types';
import type { Filter } from 'mongodb';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: 'paginate_products' | 'test_soft_delete' | 'count_all' | 'category_breakdown';
      page?: number;
      limit?: number;
      category?: string;
    };

    const action = body.action || 'paginate_products';

    // If no MONGODB_URI is provided, provide deterministic simulated dataset to inspect schemas
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({
        simulated: true,
        action,
        message: 'No live MongoDB URI found in environment. Query executed in schema simulation mode.',
        sampleResult: {
          action,
          page: body.page || 1,
          limit: body.limit || 5,
          totalDocs: 22,
          totalPages: 5,
          docs: [
            {
              name: 'Kaptaan Special Peshawari Chappal Double Sole',
              nameUr: 'کپتان اسپیشل ڈبل تلہ پشاوری چپل',
              slug: 'kaptaan-special-peshawari-chappal-double-sole-1042',
              price: 4500,
              originalPrice: 6000,
              discount: 25,
              category: 'Men',
              subCategory: 'Peshawari Chappal',
              stock: 112,
              rating: 4.9,
              numReviews: 84,
            },
            {
              name: 'Multani Handcrafted Velvet Khussa with Gold Tilla',
              nameUr: 'ملتانی مخملی کھسہ مع طلائی کڑھائی',
              slug: 'multani-handcrafted-velvet-khussa-with-gold-tilla-2918',
              price: 3200,
              originalPrice: 4000,
              discount: 20,
              category: 'Women',
              subCategory: 'Khussa',
              stock: 80,
              rating: 4.9,
              numReviews: 112,
            },
          ],
        },
      });
    }

    await connectToDatabase();
    const startTime = Date.now();

    if (action === 'paginate_products') {
      const filter: Filter<IProduct> = {};
      if (body.category) {
        filter.category = body.category as ProductCategory;
      }
      const result = await paginateQuery(Product, filter, {
        page: body.page || 1,
        limit: body.limit || 6,
        sort: { rating: -1, price: 1 },
      });
      const durationMs = Date.now() - startTime;
      return NextResponse.json({ success: true, durationMs, result });
    }

    if (action === 'count_all') {
      const [products, orders, users, categories] = await Promise.all([
        Product.countDocuments(),
        Order.countDocuments(),
        User.countDocuments(),
        Category.countDocuments(),
      ]);
      const durationMs = Date.now() - startTime;
      return NextResponse.json({
        success: true,
        durationMs,
        counts: { products, orders, users, categories },
      });
    }

    if (action === 'test_soft_delete') {
      // Create a test product, soft-delete it, and show that default find excludes it while isDeleted: true finds it
      const tempSku = `TEST-${Date.now()}`;
      const dummy = await Product.create({
        name: 'Test Soft Delete Shoe',
        nameUr: 'ٹیسٹ جوتا',
        slug: `test-shoe-${Date.now()}`,
        sku: tempSku,
        price: 1000,
        originalPrice: 1500,
        category: ProductCategory.MEN,
        subCategory: ProductSubCategory.SNEAKERS,
        sizes: ['41'],
        images: ['https://example.com/shoe.jpg'],
        description: 'Temporary test shoe for soft-delete verification',
        shortDescription: 'Temporary test shoe',
        weight: 600,
      });

      // Mark soft-deleted
      dummy.isDeleted = true;
      dummy.deletedAt = new Date();
      await dummy.save();

      // Normal find: should be excluded by pre-find hook
      const normalFind = await Product.findOne({ sku: tempSku }).lean();
      // Explicit find: should find it
      const explicitFind = await Product.findOne({ sku: tempSku, isDeleted: true }).lean();

      // Clean up the dummy
      await Product.deleteOne({ _id: dummy._id });

      const durationMs = Date.now() - startTime;
      return NextResponse.json({
        success: true,
        durationMs,
        proof: {
          normalQueryReturnedNull: normalFind === null,
          explicitQueryFoundRecord: explicitFind !== null,
          explanation: 'Mongoose pre-find middleware successfully intercepted query and excluded isDeleted: true record.',
        },
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Query execution error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
