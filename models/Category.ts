/**
 * @file models/Category.ts
 * @description Mongoose schema & model for OX Shoes footwear categories and taxonomies.
 * Supports hierarchical parent-child nesting, Urdu localization, auto slug generation,
 * and soft-delete filtering.
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type HydratedDocument, type Query } from 'mongoose';
import { CategoryType, type ICategory } from '@/types';

export type CategoryDocument = HydratedDocument<ICategory>;
export type CategoryModelType = Model<ICategory>;

const categorySchema = new Schema<ICategory, CategoryModelType>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      minlength: [2, 'Category name must be at least 2 characters'],
      maxlength: [100, 'Category name cannot exceed 100 characters'],
    },
    nameUr: {
      type: String,
      required: [true, 'Urdu category name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: Object.values(CategoryType),
        message: '{VALUE} is not a valid category type',
      },
      required: [true, 'Category type is required'],
      index: true,
    },
    image: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    parentCategory: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    seoTitle: {
      type: String,
      trim: true,
    },
    seoDescription: {
      type: String,
      trim: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes
categorySchema.index({ type: 1, order: 1, isActive: 1 });
categorySchema.index({ slug: 1, isDeleted: 1 });

/**
 * Pre-save middleware: Derive clean URL slug
 */
categorySchema.pre('save', function () {
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }
});

/**
 * Pre-find middleware: Automatically exclude soft-deleted categories
 */
categorySchema.pre(/^find/, function (this: Query<unknown, ICategory>) {
  const currentFilter = this.getFilter();
  if (currentFilter.isDeleted === undefined) {
    this.where({ isDeleted: { $ne: true } });
  }
});

/**
 * Virtual: Populate children subcategories
 */
categorySchema.virtual('subCategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentCategory',
});

export const Category: CategoryModelType =
  (models.Category as CategoryModelType) || model<ICategory, CategoryModelType>('Category', categorySchema);

export default Category;
