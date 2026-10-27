/**
 * @file models/Product.ts
 * @description Mongoose schema & model for OX Shoes footwear catalogue.
 * Supports Pakistani footwear categories (Peshawari Chappal, Khussa, etc.),
 * bilingual Urdu/English titles, automated SKU/slug derivation, variant aggregation,
 * and text + compound search indexes.
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type HydratedDocument, type Query } from 'mongoose';
import {
  ProductCategory,
  ProductSubCategory,
  ProductBrand,
  type IProduct,
  type IProductVariant,
  type IColorOption,
} from '@/types';

/**
 * Color schema subdocument
 */
const colorSchema = new Schema<IColorOption>(
  {
    name: { type: String, required: true, trim: true },
    hex: {
      type: String,
      required: true,
      match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color hex code must be valid (e.g. #000000)'],
    },
  },
  { _id: false }
);

/**
 * Granular product SKU variant subdocument
 */
const variantSchema = new Schema<IProductVariant>(
  {
    size: { type: String, required: true, trim: true },
    color: { type: String, required: true, trim: true },
    stock: { type: Number, required: true, min: [0, 'Stock cannot be negative'], default: 0 },
    sku: { type: String, required: true, trim: true, uppercase: true },
  },
  { _id: true }
);

export type ProductDocument = HydratedDocument<IProduct>;
export type ProductModelType = Model<IProduct>;

const productSchema = new Schema<IProduct, ProductModelType>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [3, 'Product name must be at least 3 characters'],
      maxlength: [200, 'Product name cannot exceed 200 characters'],
    },
    nameUr: {
      type: String,
      required: [true, 'Urdu product name (نام) is required for Pakistani localization'],
      trim: true,
      maxlength: [250, 'Urdu title cannot exceed 250 characters'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      default: function (this: { name?: string }) {
        if (this.name) {
          const base = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');
          return `${base}-${Math.random().toString(36).substring(2, 6)}`;
        }
        return undefined;
      },
    },
    sku: {
      type: String,
      required: [true, 'Master product SKU is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    price: {
      type: Number,
      required: [true, 'Selling price in PKR is required'],
      min: [0, 'Price must be non-negative'],
      index: true,
    },
    originalPrice: {
      type: Number,
      required: [true, 'Original retail price in PKR is required'],
      min: [0, 'Original price must be non-negative'],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount percentage cannot be negative'],
      max: [100, 'Discount percentage cannot exceed 100%'],
    },
    category: {
      type: String,
      enum: {
        values: Object.values(ProductCategory),
        message: '{VALUE} is not a valid footwear category',
      },
      required: [true, 'Category is required'],
      index: true,
    },
    subCategory: {
      type: String,
      enum: {
        values: Object.values(ProductSubCategory),
        message: '{VALUE} is not a valid footwear sub-category',
      },
      required: [true, 'Sub-category is required'],
      index: true,
    },
    brand: {
      type: String,
      enum: {
        values: Object.values(ProductBrand),
        message: '{VALUE} is not a valid brand',
      },
      required: [true, 'Brand is required'],
      default: ProductBrand.LOCAL,
      index: true,
    },
    sizes: {
      type: [String],
      required: [true, 'At least one shoe size must be specified'],
      default: [],
    },
    colors: {
      type: [colorSchema],
      default: [],
    },
    variants: {
      type: [variantSchema],
      default: [],
    },
    stock: {
      type: Number,
      default: 0,
      min: [0, 'Total stock cannot be negative'],
    },
    reservedStock: {
      type: Number,
      default: 0,
      min: [0, 'Reserved stock cannot be negative'],
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
      min: [1, 'Low stock threshold must be at least 1'],
    },
    images: {
      type: [String],
      required: [true, 'At least one product image is required'],
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length > 0,
        message: 'Product must have at least one valid image URL',
      },
    },
    description: {
      type: String,
      required: [true, 'Product detailed description is required'],
      trim: true,
    },
    shortDescription: {
      type: String,
      trim: true,
      maxlength: [300, 'Short description cannot exceed 300 characters'],
      default: function (this: { description?: string; name?: string }) {
        if (this.description) {
          return this.description.slice(0, 200);
        }
        return this.name ? `Handcrafted ${this.name} by OX Shoes` : 'Handcrafted Pakistani Footwear by OX Shoes';
      },
    },
    specifications: {
      type: Map,
      of: String,
      default: {},
    },
    sizeGuideId: {
      type: Schema.Types.ObjectId,
      ref: 'SizeGuide',
      default: null,
    },
    weight: {
      type: Number,
      required: [true, 'Weight in grams is required for courier shipping tariffs'],
      default: 750, // Standard shoe weight in grams
      min: [50, 'Weight must be at least 50 grams'],
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    rating: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be less than 0'],
      max: [5, 'Rating cannot exceed 5'],
      index: true,
    },
    numReviews: {
      type: Number,
      default: 0,
      min: [0, 'Review count cannot be negative'],
    },
    seoTitle: {
      type: String,
      trim: true,
      maxlength: [120, 'SEO title cannot exceed 120 characters'],
    },
    seoDescription: {
      type: String,
      trim: true,
      maxlength: [160, 'SEO description cannot exceed 160 characters'],
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

// Compound and Specialized Indexes
productSchema.index({ category: 1, subCategory: 1, isActive: 1 });
productSchema.index({ brand: 1, price: 1 });
productSchema.index({ price: 1, rating: -1 });
productSchema.index({ isFeatured: 1, createdAt: -1 });
productSchema.index({ slug: 1, isDeleted: 1 });
productSchema.index({ sku: 1, isDeleted: 1 });

// Full-Text Search Index for store searching in Urdu and English
productSchema.index(
  {
    name: 'text',
    description: 'text',
    tags: 'text',
    shortDescription: 'text',
  },
  {
    weights: {
      name: 10,
      tags: 5,
      shortDescription: 3,
      description: 1,
    },
    name: 'ProductTextSearchIndex',
  }
);

productSchema.pre('validate', function () {
  if (this.name && !this.slug) {
    const slugBase = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    this.slug = `${slugBase}-${Math.random().toString(36).substring(2, 6)}`;
  }
});

/**
 * Pre-save middleware: Auto-generate slug, compute discount %, and calculate total stock
 */
productSchema.pre('save', function () {
  // Generate slug if modified or empty
  if (this.isModified('name') || !this.slug) {
    const slugBase = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    this.slug = `${slugBase}-${Date.now().toString().slice(-4)}`;
  }

  // Calculate discount percentage automatically
  if (this.originalPrice > 0 && this.price <= this.originalPrice) {
    this.discount = Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
  } else {
    this.discount = 0;
  }

  // Sum up variant stocks if variants are provided
  if (this.variants && this.variants.length > 0) {
    this.stock = this.variants.reduce((total, v) => total + (v.stock || 0), 0);
  }

  // Set default SEO title/description if omitted
  if (!this.seoTitle) {
    this.seoTitle = `${this.name} | OX Shoes Pakistan`;
  }
  if (!this.seoDescription) {
    this.seoDescription = this.shortDescription.slice(0, 155);
  }
});

/**
 * Pre-find middleware: Exclude soft-deleted products automatically
 */
productSchema.pre(/^find/, function (this: Query<unknown, IProduct>) {
  const currentFilter = this.getFilter();
  if (currentFilter.isDeleted === undefined) {
    this.where({ isDeleted: { $ne: true } });
  }
});

/**
 * Virtual: Populate SizeGuide details
 */
productSchema.virtual('sizeGuide', {
  ref: 'SizeGuide',
  localField: 'sizeGuideId',
  foreignField: '_id',
  justOne: true,
});

export const Product: ProductModelType =
  (models.Product as ProductModelType) || model<IProduct, ProductModelType>('Product', productSchema);

export default Product;
