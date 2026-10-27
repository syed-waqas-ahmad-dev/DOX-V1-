'use server';

/**
 * @file actions/category.actions.ts
 * @description Server actions for category taxonomy and menu navigation.
 * Strict TypeScript: ZERO `any`.
 */

import { connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { Category } from '@/models/Category';
import { successResponse, type ActionResult } from '@/lib/response';
import { handleActionError } from '@/lib/error-handler';
import { CategoryType, type ICategory } from '@/types';
import { Types } from 'mongoose';

const DEFAULT_CATEGORIES: ICategory[] = [
  {
    _id: new Types.ObjectId(),
    name: "Men's Footwear",
    nameUr: 'مردانہ جوتے',
    slug: 'mens-footwear',
    type: CategoryType.MEN,
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=80',
    description: 'Handcrafted Peshawari Chappals, Italian-cut formal oxfords, brogues, and loafers.',
    order: 1,
    isActive: true,
    isDeleted: false,
    seoTitle: "Men's Leather Shoes & Chappals in Pakistan | OX Shoes",
    seoDescription: 'Shop premium handcrafted men footwear across Lahore, Karachi, and Islamabad.',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: new Types.ObjectId(),
    name: "Women's Footwear",
    nameUr: 'زنانہ جوتے',
    slug: 'womens-footwear',
    type: CategoryType.WOMEN,
    image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80',
    description: 'Handcrafted Punjabi Khussas, block heels, formal stilettos, and comfort flats.',
    order: 2,
    isActive: true,
    isDeleted: false,
    seoTitle: "Women's Footwear & Embroidered Khussas | OX Shoes",
    seoDescription: 'Exquisite bridal khussas, evening kitten heels, and comfort daily shoes.',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: new Types.ObjectId(),
    name: "Kids' Footwear",
    nameUr: 'بچوں کے جوتے',
    slug: 'kids-footwear',
    type: CategoryType.KIDS,
    image: 'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=800&q=80',
    description: 'Durable school uniform shoes, casual velcro sneakers, and party footwear for boys & girls.',
    order: 3,
    isActive: true,
    isDeleted: false,
    seoTitle: 'Kids School Shoes & Sneakers Pakistan | OX Shoes',
    seoDescription: 'High durability genuine leather school shoes with all-day comfort padding.',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: new Types.ObjectId(),
    name: 'Heritage Pakistani Crafts',
    nameUr: 'روایتی دستکاری چپل و کھسہ',
    slug: 'heritage-pakistani',
    type: CategoryType.BRAND,
    image: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=800&q=80',
    description: 'Famous Charsadda, Nowshera, Quetta Norozi chappals and Multani tilla khussas.',
    order: 4,
    isActive: true,
    isDeleted: false,
    seoTitle: 'Pure Leather Peshawari Chappal & Khussa Online | OX Shoes',
    seoDescription: 'Authentic artisan crafted chappals made with double sole and tyre grip.',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export async function getCategories(): Promise<ActionResult<ICategory[]>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      return successResponse(DEFAULT_CATEGORIES);
    }

    const categories = await Category.find({ isActive: true }).sort({ order: 1 }).lean();
    if (!categories || categories.length === 0) {
      return successResponse(DEFAULT_CATEGORIES);
    }
    return successResponse(JSON.parse(JSON.stringify(categories)));
  } catch (error: unknown) {
    return successResponse(DEFAULT_CATEGORIES);
  }
}
