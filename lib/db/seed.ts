/**
 * @file lib/db/seed.ts
 * @description Comprehensive database seeder for OX Shoes Pakistan.
 * Seeds authentic Pakistani footwear (Peshawari Chappal, Khussa, Formal, Joggers),
 * 5 Categories, 3 Users with hashed passwords, 3 Shipping Zones, 5 Coupons,
 * and Size Guides for Men, Women, and Kids.
 * Strict TypeScript: ZERO `any`.
 */

import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from './connect';
import {
  User,
  Product,
  Category,
  ShippingZone,
  Coupon,
  SizeGuide,
  Banner,
  FlashSale,
  Order,
  Review,
} from '@/models';
import {
  UserRole,
  ProductCategory,
  ProductSubCategory,
  ProductBrand,
  CategoryType,
  CouponType,
  BannerPosition,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Courier,
} from '@/types';

export interface SeedResult {
  usersCount: number;
  categoriesCount: number;
  productsCount: number;
  shippingZonesCount: number;
  couponsCount: number;
  sizeGuidesCount: number;
  bannersCount: number;
  flashSalesCount: number;
  ordersCount: number;
  reviewsCount: number;
}

/**
 * Executes full seeding logic against the connected MongoDB Atlas instance.
 *
 * @param wipeExisting - When true, drops existing documents before inserting fresh mock data
 */
export async function seedDatabase(wipeExisting = true): Promise<SeedResult> {
  await connectToDatabase();

  if (wipeExisting) {
    // Clear collections in order
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Category.deleteMany({}),
      ShippingZone.deleteMany({}),
      Coupon.deleteMany({}),
      SizeGuide.deleteMany({}),
      Banner.deleteMany({}),
      FlashSale.deleteMany({}),
      Order.deleteMany({}),
      Review.deleteMany({}),
    ]);
  }

  /* --------------------------------------------------------------------------
     1. SEED SIZE GUIDES (Men, Women, Kids)
     -------------------------------------------------------------------------- */
  const menSizeGuideId = new Types.ObjectId();
  const womenSizeGuideId = new Types.ObjectId();
  const kidsSizeGuideId = new Types.ObjectId();

  const sizeGuides = await SizeGuide.insertMany([
    {
      _id: menSizeGuideId,
      name: 'Men Standard & Traditional Footwear Size Guide',
      measurements: [
        { size: '39', length_cm: 24.5, width_cm: 9.2, ukSize: '6', usSize: '7', euSize: '39' },
        { size: '40', length_cm: 25.0, width_cm: 9.4, ukSize: '6.5', usSize: '7.5', euSize: '40' },
        { size: '41', length_cm: 25.8, width_cm: 9.6, ukSize: '7.5', usSize: '8.5', euSize: '41' },
        { size: '42', length_cm: 26.5, width_cm: 9.8, ukSize: '8', usSize: '9', euSize: '42' },
        { size: '43', length_cm: 27.2, width_cm: 10.0, ukSize: '9', usSize: '10', euSize: '43' },
        { size: '44', length_cm: 28.0, width_cm: 10.2, ukSize: '10', usSize: '11', euSize: '44' },
        { size: '45', length_cm: 28.7, width_cm: 10.4, ukSize: '11', usSize: '12', euSize: '45' },
      ],
      notes:
        'Peshawari Chappals naturally break in after 2-3 wears. If you have wide feet, choose your exact size.',
    },
    {
      _id: womenSizeGuideId,
      name: 'Women Khussa & Heels Size Guide',
      measurements: [
        { size: '36', length_cm: 22.5, width_cm: 8.2, ukSize: '3.5', usSize: '5.5', euSize: '36' },
        { size: '37', length_cm: 23.2, width_cm: 8.5, ukSize: '4', usSize: '6', euSize: '37' },
        { size: '38', length_cm: 24.0, width_cm: 8.8, ukSize: '5', usSize: '7', euSize: '38' },
        { size: '39', length_cm: 24.8, width_cm: 9.0, ukSize: '6', usSize: '8', euSize: '39' },
        { size: '40', length_cm: 25.5, width_cm: 9.2, ukSize: '6.5', usSize: '8.5', euSize: '40' },
        { size: '41', length_cm: 26.2, width_cm: 9.4, ukSize: '7.5', usSize: '9.5', euSize: '41' },
      ],
      notes:
        'Traditional Khussas have identical right and left shoes initially, contouring to each foot shape over time.',
    },
    {
      _id: kidsSizeGuideId,
      name: 'Kids School Shoes & Daily Footwear Guide',
      measurements: [
        { size: '28', length_cm: 17.5, width_cm: 6.8, ukSize: '10K', usSize: '10.5C', euSize: '28' },
        { size: '30', length_cm: 18.8, width_cm: 7.2, ukSize: '11.5K', usSize: '12C', euSize: '30' },
        { size: '32', length_cm: 20.2, width_cm: 7.6, ukSize: '13K', usSize: '1Y', euSize: '32' },
        { size: '34', length_cm: 21.5, width_cm: 8.0, ukSize: '2', usSize: '3Y', euSize: '34' },
      ],
      notes: 'Allow 0.5cm extra toe room for active school activities.',
    },
  ]);

  /* --------------------------------------------------------------------------
     2. SEED USERS (Super Admin, Operations Manager/Admin, Customer)
     -------------------------------------------------------------------------- */
  const salt = await bcrypt.genSalt(10);
  const adminPasswordHash = await bcrypt.hash('Admin@OX2026!', salt);
  const dawoodPasswordHash = await bcrypt.hash('M@l@kD@wood123', salt);

  const adminManagerId = new Types.ObjectId();
  const dawoodAdminId = new Types.ObjectId();

  const users = await User.insertMany([
    // Only 1 Super Admin: Ahmad Syed Waqas (M@l@kD@wood123)
    {
      _id: dawoodAdminId,
      name: 'Super Admin Ahmad Syed Waqas',
      email: 'ahmadsyedwaqas4@gmail.com',
      password: dawoodPasswordHash,
      role: UserRole.SUPER_ADMIN,
      phone: '+923265695170',
      isPhoneVerified: true,
      isEmailVerified: true,
      referralCode: 'OX-SUPER',
      addresses: [
        {
          label: 'OX Atelier Headquarters',
          fullName: 'Super Admin Ahmad Syed Waqas',
          phone: '+923265695170',
          street: '12-C/1, MM Alam Road, Gulberg III',
          city: 'Lahore',
          postalCode: '54000',
          isDefault: true,
        },
      ],
    },
    {
      _id: adminManagerId,
      name: 'Ayesha Khan Niazi',
      email: 'manager@oxshoes.pk',
      password: adminPasswordHash,
      role: UserRole.ADMIN,
      phone: '+923214567890',
      isPhoneVerified: true,
      isEmailVerified: true,
      referralCode: 'OX-MGR01',
      addresses: [
        {
          label: 'Karachi Regional Hub',
          fullName: 'Ayesha Khan Niazi',
          phone: '+923214567890',
          street: 'Main Clifton Road, Block 4',
          city: 'Karachi',
          postalCode: '75600',
          isDefault: true,
        },
      ],
    },
  ]);

  /* --------------------------------------------------------------------------
     3. SEED CATEGORIES (5 Categories + Hierarchical Taxonomy)
     -------------------------------------------------------------------------- */
  const menCatId = new Types.ObjectId();
  const womenCatId = new Types.ObjectId();
  const kidsCatId = new Types.ObjectId();
  const heritageCatId = new Types.ObjectId();
  const athleticCatId = new Types.ObjectId();

  const categories = await Category.insertMany([
    {
      _id: menCatId,
      name: "Men's Footwear",
      nameUr: 'مردانہ جوتے',
      slug: 'mens-footwear',
      type: CategoryType.MEN,
      image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=80',
      description: 'Handcrafted Peshawari Chappals, Italian-cut formal oxfords, brogues, and loafers.',
      order: 1,
      isActive: true,
      seoTitle: "Men's Leather Shoes & Chappals in Pakistan | OX Shoes",
      seoDescription: 'Shop premium handcrafted men footwear across Lahore, Karachi, and Islamabad.',
    },
    {
      _id: womenCatId,
      name: "Women's Footwear",
      nameUr: 'زنانہ جوتے',
      slug: 'womens-footwear',
      type: CategoryType.WOMEN,
      image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80',
      description: 'Handcrafted Punjabi Khussas, block heels, formal stilettos, and comfort flats.',
      order: 2,
      isActive: true,
      seoTitle: "Women's Footwear & Embroidered Khussas | OX Shoes",
      seoDescription: 'Exquisite bridal khussas, evening kitten heels, and comfort daily shoes.',
    },
    {
      _id: kidsCatId,
      name: "Kids' Footwear",
      nameUr: 'بچوں کے جوتے',
      slug: 'kids-footwear',
      type: CategoryType.KIDS,
      image: 'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=800&q=80',
      description: 'Durable school uniform shoes, casual velcro sneakers, and party footwear for boys & girls.',
      order: 3,
      isActive: true,
      seoTitle: 'Kids School Shoes & Sneakers Pakistan | OX Shoes',
      seoDescription: 'High durability genuine leather school shoes with all-day comfort padding.',
    },
    {
      _id: heritageCatId,
      name: 'Heritage Pakistani Crafts',
      nameUr: 'روایتی دستکاری چپل و کھسہ',
      slug: 'heritage-pakistani',
      type: CategoryType.BRAND,
      image: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=800&q=80',
      description: 'Famous Charsadda, Nowshera, Quetta Norozi chappals and Multani tilla khussas.',
      order: 4,
      isActive: true,
      seoTitle: 'Pure Leather Peshawari Chappal & Khussa Online | OX Shoes',
      seoDescription: 'Authentic artisan crafted chappals made with double sole and tyre grip.',
    },
    {
      _id: athleticCatId,
      name: 'Athletic & Performance',
      nameUr: 'اسپورٹس و جاگرز',
      slug: 'athletic-performance',
      type: CategoryType.BRAND,
      image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=800&q=80',
      description: 'Shock-absorbing joggers, trail running sneakers, and breathable gym footwear.',
      order: 5,
      isActive: true,
      seoTitle: 'Men & Women Joggers and Sneakers Pakistan | OX Shoes',
      seoDescription: 'Premium comfort joggers engineered for daily running and workouts.',
    },
  ]);

  /* --------------------------------------------------------------------------
     4. SEED SHIPPING ZONES (Pakistani Metropolitan & Nationwide Tariffs)
     -------------------------------------------------------------------------- */
  const shippingZones = await ShippingZone.insertMany([
    {
      name: 'Lahore Express Zone',
      cities: ['Lahore', 'Kasur', 'Sheikhupura'],
      baseRate: 150, // PKR 150
      perKgRate: 50, // PKR 50/kg
      estimatedDays: { min: 1, max: 2 },
      freeShippingThreshold: 3000,
      isActive: true,
    },
    {
      name: 'Karachi Metropolitan Hub',
      cities: ['Karachi', 'Hyderabad'],
      baseRate: 200,
      perKgRate: 60,
      estimatedDays: { min: 2, max: 3 },
      freeShippingThreshold: 3500,
      isActive: true,
    },
    {
      name: 'Nationwide & Northern Pakistan',
      cities: [
        'Islamabad',
        'Rawalpindi',
        'Peshawar',
        'Quetta',
        'Faisalabad',
        'Multan',
        'Sialkot',
        'Gujranwala',
        'Abbottabad',
        'Mardan',
        'Sargodha',
        'Bahawalpur',
        'Sukkur',
      ],
      baseRate: 250,
      perKgRate: 75,
      estimatedDays: { min: 3, max: 5 },
      freeShippingThreshold: 4000,
      isActive: true,
    },
  ]);

  /* --------------------------------------------------------------------------
     5. SEED COUPONS (5 Diverse Promotional Deals)
     -------------------------------------------------------------------------- */
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const coupons = await Coupon.insertMany([
    {
      code: 'WELCOME10',
      type: CouponType.PERCENTAGE,
      value: 10,
      minOrderAmount: 2000,
      maxDiscountAmount: 1000,
      usageLimit: 5000,
      usedCount: 142,
      perUserLimit: 1,
      applicableCategories: [ProductCategory.MEN, ProductCategory.WOMEN, ProductCategory.KIDS],
      applicableBrands: [],
      isFirstOrderOnly: true,
      startsAt: now,
      expiresAt: nextMonth,
      isActive: true,
    },
    {
      code: 'AZADI23',
      type: CouponType.PERCENTAGE,
      value: 23,
      minOrderAmount: 4000,
      maxDiscountAmount: 2500,
      usageLimit: 1000,
      usedCount: 88,
      perUserLimit: 1,
      applicableCategories: [ProductCategory.MEN, ProductCategory.WOMEN],
      applicableBrands: [],
      isFirstOrderOnly: false,
      startsAt: now,
      expiresAt: nextMonth,
      isActive: true,
    },
    {
      code: 'FREESHIP',
      type: CouponType.FREE_SHIPPING,
      value: 0,
      minOrderAmount: 2500,
      maxDiscountAmount: 300,
      usageLimit: 3000,
      usedCount: 420,
      perUserLimit: 3,
      applicableCategories: [],
      applicableBrands: [],
      isFirstOrderOnly: false,
      startsAt: now,
      expiresAt: nextMonth,
      isActive: true,
    },
    {
      code: 'EIDVIBES',
      type: CouponType.FIXED,
      value: 1000, // PKR 1,000 flat discount
      minOrderAmount: 6000,
      maxDiscountAmount: 1000,
      usageLimit: 500,
      usedCount: 77,
      perUserLimit: 1,
      applicableCategories: [ProductCategory.MEN, ProductCategory.WOMEN],
      applicableBrands: [ProductBrand.LOCAL, ProductBrand.HUSH_PUPPIES],
      isFirstOrderOnly: false,
      startsAt: now,
      expiresAt: nextMonth,
      isActive: true,
    },
    {
      code: 'PESHAWARI500',
      type: CouponType.FIXED,
      value: 500,
      minOrderAmount: 3500,
      maxDiscountAmount: 500,
      usageLimit: 800,
      usedCount: 310,
      perUserLimit: 2,
      applicableCategories: [ProductCategory.MEN],
      applicableBrands: [ProductBrand.LOCAL],
      isFirstOrderOnly: false,
      startsAt: now,
      expiresAt: nextMonth,
      isActive: true,
    },
  ]);

  /* --------------------------------------------------------------------------
     6. SEED 22+ SAMPLE PRODUCTS (Authentic Pakistani Footwear Mix)
     -------------------------------------------------------------------------- */
  const productDefinitions = [
    // 1. Kaptaan Peshawari Chappal
    {
      name: 'Kaptaan Special Peshawari Chappal Double Sole',
      nameUr: 'کپتان اسپیشل ڈبل تلہ پشاوری چپل',
      sku: 'OX-KAP-001',
      price: 4500,
      originalPrice: 6000,
      category: ProductCategory.MEN,
      subCategory: ProductSubCategory.PESHAWARI_CHAPPAL,
      brand: ProductBrand.LOCAL,
      sizes: ['40', '41', '42', '43', '44'],
      colors: [
        { name: 'Mustard Brown', hex: '#8B5A2B' },
        { name: 'Jet Black', hex: '#111111' },
      ],
      variants: [
        { size: '40', color: 'Mustard Brown', stock: 12, sku: 'OX-KAP-001-40-BRN' },
        { size: '41', color: 'Mustard Brown', stock: 18, sku: 'OX-KAP-001-41-BRN' },
        { size: '42', color: 'Mustard Brown', stock: 25, sku: 'OX-KAP-001-42-BRN' },
        { size: '43', color: 'Mustard Brown', stock: 15, sku: 'OX-KAP-001-43-BRN' },
        { size: '44', color: 'Mustard Brown', stock: 8, sku: 'OX-KAP-001-44-BRN' },
        { size: '41', color: 'Jet Black', stock: 14, sku: 'OX-KAP-001-41-BLK' },
        { size: '42', color: 'Jet Black', stock: 20, sku: 'OX-KAP-001-42-BLK' },
      ],
      images: [
        'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=800&q=80',
      ],
      description:
        'Famous Pakistani Kaptaan style Peshawari Chappal, crafted with 100% full-grain buffalo leather and original durable tyre sole. Renowned for supreme durability and traditional presence.',
      shortDescription: 'Iconic double sole Kaptaan Chappal in authentic mustard brown leather.',
      specifications: new Map([
        ['Leather Type', 'Full Grain Cow Leather'],
        ['Sole', 'High-Grip Tyre Rubber'],
        ['Stitching', 'Heavy Duty Double Thread Handstitching'],
        ['Origin', 'Peshawar, Khyber Pakhtunkhwa'],
      ]),
      sizeGuideId: menSizeGuideId,
      weight: 950,
      isFeatured: true,
      isActive: true,
      tags: ['kaptaan', 'peshawari', 'chappal', 'leather', 'double-sole', 'eid-collection'],
      rating: 4.9,
      numReviews: 84,
    },
    // 2. Charsadda Classic Peshawari Chappal
    {
      name: 'Charsadda Classic Handstitched Peshawari Chappal',
      nameUr: 'چارسدہ کلاسک پشاوری چپل',
      sku: 'OX-CHA-002',
      price: 3800,
      originalPrice: 5000,
      category: ProductCategory.MEN,
      subCategory: ProductSubCategory.PESHAWARI_CHAPPAL,
      brand: ProductBrand.LOCAL,
      sizes: ['39', '40', '41', '42', '43'],
      colors: [
        { name: 'Jet Black', hex: '#111111' },
        { name: 'Dark Tan', hex: '#5C3317' },
      ],
      variants: [
        { size: '40', color: 'Jet Black', stock: 15, sku: 'OX-CHA-002-40-BLK' },
        { size: '41', color: 'Jet Black', stock: 22, sku: 'OX-CHA-002-41-BLK' },
        { size: '42', color: 'Jet Black', stock: 19, sku: 'OX-CHA-002-42-BLK' },
      ],
      images: [
        'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=800&q=80',
      ],
      description:
        'Authentic Charsadda artisan chappal featuring elegant front buckle clasp and ergonomic footbed.',
      shortDescription: 'Heritage Charsadda design hand-sewn by master craftsmen.',
      specifications: new Map([
        ['Upper', 'Calfskin Leather'],
        ['Sole', 'Single Tyre Sole'],
        ['Origin', 'Charsadda, KPK'],
      ]),
      sizeGuideId: menSizeGuideId,
      weight: 850,
      isFeatured: true,
      isActive: true,
      tags: ['charsadda', 'traditional', 'shalwar-kameez', 'men-footwear'],
      rating: 4.8,
      numReviews: 46,
    },
    // 3. Nowsheri Shikari Chappal
    {
      name: 'Nowsheri Shikari Pure Leather Chappal',
      nameUr: 'نوشہری شکاری چپل',
      sku: 'OX-NOW-003',
      price: 5200,
      originalPrice: 6500,
      category: ProductCategory.MEN,
      subCategory: ProductSubCategory.NOWSHERI_CHAPPAL,
      brand: ProductBrand.LOCAL,
      sizes: ['40', '41', '42', '43', '44'],
      colors: [{ name: 'Deep Tan', hex: '#654321' }],
      variants: [
        { size: '41', color: 'Deep Tan', stock: 10, sku: 'OX-NOW-003-41-TAN' },
        { size: '42', color: 'Deep Tan', stock: 16, sku: 'OX-NOW-003-42-TAN' },
      ],
      images: [
        'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=80',
      ],
      description:
        'Nowshera Shikari Chappal distinguished by pointed front curvature and reinforced heel strap.',
      shortDescription: 'Rugged Nowsheri Shikari chappal with deep tan tone.',
      specifications: new Map([
        ['Upper', 'Heavy Buffalo Leather'],
        ['Sole', 'High Tensile Rubber Sole'],
      ]),
      sizeGuideId: menSizeGuideId,
      weight: 900,
      isFeatured: false,
      isActive: true,
      tags: ['nowshera', 'shikari', 'heavy-leather'],
      rating: 4.7,
      numReviews: 29,
    },
    // 4. Multani Velvet Khussa with Gold Tilla
    {
      name: 'Multani Handcrafted Velvet Khussa with Gold Tilla',
      nameUr: 'ملتانی مخملی کھسہ مع طلائی کڑھائی',
      sku: 'OX-KHU-004',
      price: 3200,
      originalPrice: 4000,
      category: ProductCategory.WOMEN,
      subCategory: ProductSubCategory.KHUSSA,
      brand: ProductBrand.LOCAL,
      sizes: ['36', '37', '38', '39', '40'],
      colors: [
        { name: 'Maroon', hex: '#800000' },
        { name: 'Emerald Green', hex: '#004B23' },
      ],
      variants: [
        { size: '37', color: 'Maroon', stock: 20, sku: 'OX-KHU-004-37-MAR' },
        { size: '38', color: 'Maroon', stock: 35, sku: 'OX-KHU-004-38-MAR' },
        { size: '39', color: 'Maroon', stock: 25, sku: 'OX-KHU-004-39-MAR' },
      ],
      images: [
        'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80',
      ],
      description:
        'Traditional Multani velvet khussa decorated with intricate metallic Gold Tilla needlework. Includes padded insole for all-day wedding celebration comfort.',
      shortDescription: 'Royal maroon velvet khussa embellished with genuine gold thread embroidery.',
      specifications: new Map([
        ['Material', 'Plush Silk Velvet'],
        ['Embroidery', 'Authentic Gold Tilla Needlework'],
        ['Sole', 'Soft Rawhide Leather'],
        ['Origin', 'Multan, Punjab'],
      ]),
      sizeGuideId: womenSizeGuideId,
      weight: 420,
      isFeatured: true,
      isActive: true,
      tags: ['khussa', 'multani', 'velvet', 'tilla', 'wedding', 'women-fashion'],
      rating: 4.9,
      numReviews: 112,
    },
    // 5. Bahawalpuri Silk Embroidered Bridal Khussa
    {
      name: 'Bahawalpuri Silk Embroidered Bridal Khussa',
      nameUr: 'بہاولپوری ریشمی برائیڈل کھسہ',
      sku: 'OX-KHU-005',
      price: 4800,
      originalPrice: 6000,
      category: ProductCategory.WOMEN,
      subCategory: ProductSubCategory.KHUSSA,
      brand: ProductBrand.LOCAL,
      sizes: ['36', '37', '38', '39'],
      colors: [{ name: 'Ivory Gold', hex: '#FFFFF0' }],
      variants: [
        { size: '37', color: 'Ivory Gold', stock: 15, sku: 'OX-KHU-005-37-IVO' },
        { size: '38', color: 'Ivory Gold', stock: 18, sku: 'OX-KHU-005-38-IVO' },
      ],
      images: [
        'https://images.unsplash.com/photo-1535043934128-cf0b28d52f95?auto=format&fit=crop&w=800&q=80',
      ],
      description:
        'Bridal silk khussa with dabka and moti embroidery, hand-finished in Bahawalpur for Barat and Walima ceremonies.',
      shortDescription: 'Luxurious bridal khussa adorned with pearls and metallic thread.',
      specifications: new Map([
        ['Upper', 'Pure Raw Silk'],
        ['Work', 'Dabka, Naqshi & Pearls'],
        ['Insole', 'Dual-Density Memory Foam Cushion'],
      ]),
      sizeGuideId: womenSizeGuideId,
      weight: 460,
      isFeatured: true,
      isActive: true,
      tags: ['bridal', 'khussa', 'bahawalpur', 'dabka', 'pearls'],
      rating: 5.0,
      numReviews: 38,
    },
    // 6. Lahore Executive Oxford Formal Leather Shoes
    {
      name: 'Lahore Executive Oxford Formal Leather Shoes',
      nameUr: 'لاہور ایگزیکٹو آکسفورڈ فارمل جوتے',
      sku: 'OX-FOR-006',
      price: 8500,
      originalPrice: 11000,
      category: ProductCategory.MEN,
      subCategory: ProductSubCategory.FORMAL_SHOES,
      brand: ProductBrand.HUSH_PUPPIES,
      sizes: ['40', '41', '42', '43', '44'],
      colors: [
        { name: 'Glossy Black', hex: '#0A0A0A' },
        { name: 'Dark Brown', hex: '#3E2723' },
      ],
      variants: [
        { size: '41', color: 'Glossy Black', stock: 14, sku: 'OX-FOR-006-41-BLK' },
        { size: '42', color: 'Glossy Black', stock: 22, sku: 'OX-FOR-006-42-BLK' },
        { size: '43', color: 'Glossy Black', stock: 10, sku: 'OX-FOR-006-43-BLK' },
      ],
      images: [
        'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=800&q=80',
      ],
      description:
        'Impeccably tailored closed-lacing Oxford formal shoes in high-shine Italian calf leather. Perfect for corporate executive boardrooms and formal black-tie events.',
      shortDescription: 'Classic closed-lacing executive Oxford dress shoes in premium glossy black leather.',
      specifications: new Map([
        ['Leather', 'Full Grain Calfskin'],
        ['Construction', 'Goodyear Welted'],
        ['Lining', 'Breathable Goat Leather'],
        ['Sole', 'Reinforced Leather Sole with Rubber Heel Cap'],
      ]),
      sizeGuideId: menSizeGuideId,
      weight: 980,
      isFeatured: true,
      isActive: true,
      tags: ['oxford', 'formal', 'corporate', 'office', 'executive', 'bata'],
      rating: 4.8,
      numReviews: 62,
    },
    // 7. Karachi Derby Cap-Toe Formal Brogues
    {
      name: 'Karachi Derby Cap-Toe Formal Brogues',
      nameUr: 'کراچی ڈربی کیپ ٹو فارمل بروگز',
      sku: 'OX-FOR-007',
      price: 7900,
      originalPrice: 9500,
      category: ProductCategory.MEN,
      subCategory: ProductSubCategory.FORMAL_SHOES,
      brand: ProductBrand.BORJAN,
      sizes: ['40', '41', '42', '43', '44'],
      colors: [{ name: 'Cognac Brown', hex: '#9E471C' }],
      variants: [
        { size: '41', color: 'Cognac Brown', stock: 12, sku: 'OX-FOR-007-41-COG' },
        { size: '42', color: 'Cognac Brown', stock: 15, sku: 'OX-FOR-007-42-COG' },
      ],
      images: [
        'https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&w=800&q=80',
      ],
      description:
        'Open-lacing Derby shoes adorned with tasteful cap-toe brogue perforations. Versatile for business casual and formal wear.',
      shortDescription: 'Cognac brown Derby shoes with hand-burnished cap-toe detailing.',
      specifications: new Map([
        ['Leather', 'Burnished Cowhide'],
        ['Sole', 'Anti-Slip TPR Rubber'],
      ]),
      sizeGuideId: menSizeGuideId,
      weight: 940,
      isFeatured: false,
      isActive: true,
      tags: ['derby', 'brogues', 'cognac', 'formal'],
      rating: 4.7,
      numReviews: 31,
    },
    // 8. Islamabad Double Monk Strap Shoes
    {
      name: 'Islamabad Double Monk Strap Hand-Burnished Shoes',
      nameUr: 'اسلام آباد ڈبل مونک اسٹریپ جوتے',
      sku: 'OX-FOR-008',
      price: 9200,
      originalPrice: 12000,
      category: ProductCategory.MEN,
      subCategory: ProductSubCategory.FORMAL_SHOES,
      brand: ProductBrand.LOCAL,
      sizes: ['41', '42', '43', '44'],
      colors: [{ name: 'Burgundy Wine', hex: '#6B1D2F' }],
      variants: [
        { size: '42', color: 'Burgundy Wine', stock: 8, sku: 'OX-FOR-008-42-BUR' },
        { size: '43', color: 'Burgundy Wine', stock: 11, sku: 'OX-FOR-008-43-BUR' },
      ],
      images: [
        'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=800&q=80',
      ],
      description:
        'Sophisticated double monk strap shoe with brass buckles and hand-patina burgundy shading.',
      shortDescription: 'Hand-patina double monk strap formal shoes with gold-tone buckles.',
      specifications: new Map([
        ['Finish', 'Hand Patina Burnish'],
        ['Buckles', 'Solid Antiqued Brass'],
      ]),
      sizeGuideId: menSizeGuideId,
      weight: 960,
      isFeatured: true,
      isActive: true,
      tags: ['monk-strap', 'luxury', 'burgundy', 'formal'],
      rating: 4.9,
      numReviews: 24,
    },
    // 9. Rawalpindi Slip-On Formal Loafers
    {
      name: 'Rawalpindi Tassel Slip-On Suede Loafers',
      nameUr: 'راولپنڈی سوئیڈ ٹیسل لوفرز',
      sku: 'OX-FOR-009',
      price: 6800,
      originalPrice: 8000,
      category: ProductCategory.MEN,
      subCategory: ProductSubCategory.FORMAL_SHOES,
      brand: ProductBrand.SERVIS,
      sizes: ['40', '41', '42', '43'],
      colors: [{ name: 'Navy Blue', hex: '#000080' }],
      variants: [
        { size: '41', color: 'Navy Blue', stock: 14, sku: 'OX-FOR-009-41-NAV' },
        { size: '42', color: 'Navy Blue', stock: 20, sku: 'OX-FOR-009-42-NAV' },
      ],
      images: [
        'https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&w=800&q=80',
      ],
      description: 'Velvety suede leather loafers with twin tassels and flexible moccasin construction.',
      shortDescription: 'Navy blue tassel loafers for effortless semi-formal styling.',
      specifications: new Map([
        ['Upper', 'Premium Calf Suede'],
        ['Lining', 'Breathable Leather'],
      ]),
      sizeGuideId: menSizeGuideId,
      weight: 780,
      isFeatured: false,
      isActive: true,
      tags: ['loafers', 'suede', 'navy', 'tassel'],
      rating: 4.6,
      numReviews: 18,
    },
    // 10. Margalla Trail Pro Joggers
    {
      name: 'Margalla Trail Pro Shock-Absorbing Joggers',
      nameUr: 'مارگلہ ٹریل پرو شاک ایبزاربر جاگرز',
      sku: 'OX-JOG-010',
      price: 5500,
      originalPrice: 7000,
      category: ProductCategory.MEN,
      subCategory: ProductSubCategory.JOGGERS,
      brand: ProductBrand.SERVIS,
      sizes: ['40', '41', '42', '43', '44'],
      colors: [{ name: 'Charcoal Neon', hex: '#333333' }],
      variants: [
        { size: '41', color: 'Charcoal Neon', stock: 18, sku: 'OX-JOG-010-41-NEO' },
        { size: '42', color: 'Charcoal Neon', stock: 25, sku: 'OX-JOG-010-42-NEO' },
        { size: '43', color: 'Charcoal Neon', stock: 12, sku: 'OX-JOG-010-43-NEO' },
      ],
      images: [
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
      ],
      description:
        'Engineered for hiking the Margalla Hills and urban cardio. Features high-rebound EVA midsole and breathable knit mesh upper.',
      shortDescription: 'High-rebound trail running joggers designed for rugged terrain and daily runs.',
      specifications: new Map([
        ['Midsole', 'Hyper-Foam EVA Shock Damper'],
        ['Upper', 'Engineered Breathable Mesh'],
        ['Grip', 'Lugged Rubber Outsole'],
      ]),
      sizeGuideId: menSizeGuideId,
      weight: 650,
      isFeatured: true,
      isActive: true,
      tags: ['joggers', 'running', 'margalla', 'trail', 'sports'],
      rating: 4.7,
      numReviews: 53,
    },
    // 11. K2 High-Altitude Trekking Sneakers
    {
      name: 'K2 High-Altitude Trekking Sneakers',
      nameUr: 'کے ٹو ہائی ایلٹی ٹیوڈ ٹریکنگ اسنیکرز',
      sku: 'OX-SNK-011',
      price: 7200,
      originalPrice: 9000,
      category: ProductCategory.MEN,
      subCategory: ProductSubCategory.SNEAKERS,
      brand: ProductBrand.NDURE,
      sizes: ['41', '42', '43', '44'],
      colors: [{ name: 'Khaki Olive', hex: '#556B2F' }],
      variants: [
        { size: '42', color: 'Khaki Olive', stock: 10, sku: 'OX-SNK-011-42-KHA' },
        { size: '43', color: 'Khaki Olive', stock: 14, sku: 'OX-SNK-011-43-KHA' },
      ],
      images: [
        'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=800&q=80',
      ],
      description: 'Weatherproof ripstop sneakers with reinforced toe-guard and ankle support.',
      shortDescription: 'Durable trekking sneakers inspired by the Karakoram peaks.',
      specifications: new Map([
        ['Upper', 'Water-Resistant Ripstop Nylon'],
        ['Toe', 'Rubber Shield Guard'],
      ]),
      sizeGuideId: menSizeGuideId,
      weight: 820,
      isFeatured: false,
      isActive: true,
      tags: ['trekking', 'k2', 'sneakers', 'adventure'],
      rating: 4.8,
      numReviews: 22,
    },
    // 12. Gulberg Streetwear Chunky High-Top Sneakers
    {
      name: 'Gulberg Streetwear Chunky High-Top Sneakers',
      nameUr: 'گلبرگ اسٹریٹ ویئر چنکی ہائی ٹاپ اسنیکرز',
      sku: 'OX-SNK-012',
      price: 6400,
      originalPrice: 8000,
      category: ProductCategory.MEN,
      subCategory: ProductSubCategory.SNEAKERS,
      brand: ProductBrand.NIKE,
      sizes: ['40', '41', '42', '43'],
      colors: [{ name: 'Triple White', hex: '#FFFFFF' }],
      variants: [
        { size: '41', color: 'Triple White', stock: 16, sku: 'OX-SNK-012-41-WHT' },
        { size: '42', color: 'Triple White', stock: 20, sku: 'OX-SNK-012-42-WHT' },
      ],
      images: [
        'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=800&q=80',
      ],
      description: 'Chunky platform sneakers with retro street styling and cushioned tongue.',
      shortDescription: 'Triple white chunky sneakers loved by Lahore youth culture.',
      specifications: new Map([
        ['Upper', 'Vegan Synthetic Leather'],
        ['Platform Height', '4.5 cm'],
      ]),
      sizeGuideId: menSizeGuideId,
      weight: 850,
      isFeatured: true,
      isActive: true,
      tags: ['sneakers', 'streetwear', 'chunky', 'white-shoes'],
      rating: 4.9,
      numReviews: 76,
    },
    // 13. Liberty Lightweight Breathable Running Joggers
    {
      name: 'Liberty Lightweight Breathable Running Joggers',
      nameUr: 'لبرٹی لائٹ ویٹ رننگ جاگرز',
      sku: 'OX-JOG-013',
      price: 4900,
      originalPrice: 6000,
      category: ProductCategory.WOMEN,
      subCategory: ProductSubCategory.JOGGERS,
      brand: ProductBrand.ADIDAS,
      sizes: ['37', '38', '39', '40'],
      colors: [{ name: 'Blush Pink', hex: '#FFB6C1' }],
      variants: [
        { size: '38', color: 'Blush Pink', stock: 14, sku: 'OX-JOG-013-38-PNK' },
        { size: '39', color: 'Blush Pink', stock: 19, sku: 'OX-JOG-013-39-PNK' },
      ],
      images: [
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
      ],
      description: 'Ultra-featherweight running joggers for women with arch supportive cushioning.',
      shortDescription: 'Breathable pink knit joggers for everyday morning strolls and workouts.',
      specifications: new Map([
        ['Weight per Shoe', '190 grams'],
        ['Closure', 'Elastic Lace-up'],
      ]),
      sizeGuideId: womenSizeGuideId,
      weight: 480,
      isFeatured: false,
      isActive: true,
      tags: ['joggers', 'women', 'running', 'breathable'],
      rating: 4.8,
      numReviews: 41,
    },
    // 14. Anarkali Stiletto Block Heels
    {
      name: 'Anarkali Stiletto Block Heels with Rose Gold Finish',
      nameUr: 'انارکلی بلاک ہیلز مع روز گولڈ فنش',
      sku: 'OX-HEE-014',
      price: 5600,
      originalPrice: 7000,
      category: ProductCategory.WOMEN,
      subCategory: ProductSubCategory.HEELS,
      brand: ProductBrand.STYLO,
      sizes: ['36', '37', '38', '39'],
      colors: [{ name: 'Rose Gold', hex: '#B76E79' }],
      variants: [
        { size: '37', color: 'Rose Gold', stock: 12, sku: 'OX-HEE-014-37-RSG' },
        { size: '38', color: 'Rose Gold', stock: 22, sku: 'OX-HEE-014-38-RSG' },
      ],
      images: [
        'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80',
      ],
      description: '3-inch sturdy block heels wrapped in metallic rose gold vegan leather. Designed for stability across lawn weddings and formal dinners.',
      shortDescription: 'Rose gold block heels engineered for wobble-free wedding season comfort.',
      specifications: new Map([
        ['Heel Height', '3.0 Inches Block Heel'],
        ['Insole', 'Double Gel Padding'],
      ]),
      sizeGuideId: womenSizeGuideId,
      weight: 520,
      isFeatured: true,
      isActive: true,
      tags: ['heels', 'block-heel', 'rose-gold', 'party', 'stylo'],
      rating: 4.7,
      numReviews: 35,
    },
    // 15. Clifton Strappy Evening Kitten Heels
    {
      name: 'Clifton Strappy Evening Kitten Heels',
      nameUr: 'کلفٹن اسٹریپی ایوننگ کٹن ہیلز',
      sku: 'OX-HEE-015',
      price: 4500,
      originalPrice: 5500,
      category: ProductCategory.WOMEN,
      subCategory: ProductSubCategory.HEELS,
      brand: ProductBrand.STYLO,
      sizes: ['37', '38', '39'],
      colors: [{ name: 'Champagne Gold', hex: '#F7E7CE' }],
      variants: [
        { size: '38', color: 'Champagne Gold', stock: 15, sku: 'OX-HEE-015-38-GLD' },
      ],
      images: [
        'https://images.unsplash.com/photo-1535043934128-cf0b28d52f95?auto=format&fit=crop&w=800&q=80',
      ],
      description: 'Delicate strappy kitten heels with ankle buckle clasp for subtle festive elegance.',
      shortDescription: '1.75 inch modest kitten heels in shimmering champagne.',
      specifications: new Map([
        ['Heel Height', '1.75 Inches'],
        ['Strap', 'Adjustable Ankle Buckle'],
      ]),
      sizeGuideId: womenSizeGuideId,
      weight: 440,
      isFeatured: false,
      isActive: true,
      tags: ['kitten-heels', 'evening', 'champagne', 'strappy'],
      rating: 4.6,
      numReviews: 19,
    },
    // 16. Tariq Road Daily Comfort Leather Flats
    {
      name: 'Tariq Road Daily Comfort Pointed Leather Flats',
      nameUr: 'طارق روڈ ڈیلی کمفرٹ لیدر فلیٹس',
      sku: 'OX-FLA-016',
      price: 2800,
      originalPrice: 3500,
      category: ProductCategory.WOMEN,
      subCategory: ProductSubCategory.FLATS,
      brand: ProductBrand.BORJAN,
      sizes: ['36', '37', '38', '39', '40'],
      colors: [{ name: 'Beige Nude', hex: '#F5F5DC' }],
      variants: [
        { size: '37', color: 'Beige Nude', stock: 18, sku: 'OX-FLA-016-37-BEI' },
        { size: '38', color: 'Beige Nude', stock: 24, sku: 'OX-FLA-016-38-BEI' },
      ],
      images: [
        'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80',
      ],
      description: 'Pointed toe daily flats lined with memory foam. The essential office flat shoe.',
      shortDescription: 'Chic pointed nude flats crafted with flexible anti-skid rubber sole.',
      specifications: new Map([
        ['Material', 'Soft Milled Leather'],
        ['Sole', 'Flexible Rubber'],
      ]),
      sizeGuideId: womenSizeGuideId,
      weight: 380,
      isFeatured: false,
      isActive: true,
      tags: ['flats', 'daily-wear', 'office', 'nude'],
      rating: 4.8,
      numReviews: 57,
    },
    // 17. Peshawar Traditional Kolhapuri Leather Flats
    {
      name: 'Peshawar Traditional Hand-Carved Kolhapuri Flats',
      nameUr: 'پشاور روایتی کولہاپوری لیدر فلیٹس',
      sku: 'OX-FLA-017',
      price: 2400,
      originalPrice: 3000,
      category: ProductCategory.WOMEN,
      subCategory: ProductSubCategory.FLATS,
      brand: ProductBrand.LOCAL,
      sizes: ['36', '37', '38', '39'],
      colors: [{ name: 'Camel Tan', hex: '#C19A6B' }],
      variants: [
        { size: '37', color: 'Camel Tan', stock: 20, sku: 'OX-FLA-017-37-CAM' },
        { size: '38', color: 'Camel Tan', stock: 25, sku: 'OX-FLA-017-38-CAM' },
      ],
      images: [
        'https://images.unsplash.com/photo-1535043934128-cf0b28d52f95?auto=format&fit=crop&w=800&q=80',
      ],
      description: 'Hand braided camel leather Kolhapuri toe-ring flats decorated with red pom-poms.',
      shortDescription: 'Artisan hand-braided leather Kolhapuri flats with toe ring.',
      specifications: new Map([
        ['Leather', 'Vegetable Tanned Leather'],
        ['Origin', 'KPK Artisans'],
      ]),
      sizeGuideId: womenSizeGuideId,
      weight: 360,
      isFeatured: false,
      isActive: true,
      tags: ['kolhapuri', 'flats', 'traditional', 'summer'],
      rating: 4.5,
      numReviews: 16,
    },
    // 18. Standard Junior Black Leather School Shoes
    {
      name: 'Standard Junior Black Leather School Shoes',
      nameUr: 'اسٹینڈرڈ جونیئر بلیک لیدر اسکول شوز',
      sku: 'OX-SCH-018',
      price: 2200,
      originalPrice: 2800,
      category: ProductCategory.KIDS,
      subCategory: ProductSubCategory.SCHOOL_SHOES,
      brand: ProductBrand.BATA,
      sizes: ['28', '30', '32', '34'],
      colors: [{ name: 'Classic Black', hex: '#000000' }],
      variants: [
        { size: '28', color: 'Classic Black', stock: 30, sku: 'OX-SCH-018-28-BLK' },
        { size: '30', color: 'Classic Black', stock: 45, sku: 'OX-SCH-018-30-BLK' },
        { size: '32', color: 'Classic Black', stock: 40, sku: 'OX-SCH-018-32-BLK' },
      ],
      images: [
        'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=800&q=80',
      ],
      description:
        'Official Pakistani school uniform certified shoes. Features scuff-resistant leather and dual velcro closure for quick morning dressing.',
      shortDescription: 'Scuff-resistant velcro leather school shoes for boys and girls.',
      specifications: new Map([
        ['Closure', 'Dual Hook & Loop Velcro'],
        ['Leather', 'Scuff-Resistant Action Leather'],
        ['Sole', 'High Abrasion School Outsole'],
      ]),
      sizeGuideId: kidsSizeGuideId,
      weight: 510,
      isFeatured: true,
      isActive: true,
      tags: ['school-shoes', 'kids', 'bata', 'uniform', 'velcro'],
      rating: 4.9,
      numReviews: 128,
    },
    // 19. Senior Boy Lace-Up School Uniform Shoes
    {
      name: 'Senior Boy Lace-Up School Uniform Shoes',
      nameUr: 'سینیئر بوائے لیس اپ اسکول یونیفارم شوز',
      sku: 'OX-SCH-019',
      price: 2600,
      originalPrice: 3200,
      category: ProductCategory.KIDS,
      subCategory: ProductSubCategory.SCHOOL_SHOES,
      brand: ProductBrand.SERVIS,
      sizes: ['32', '34', '36', '38'],
      colors: [{ name: 'Polished Black', hex: '#050505' }],
      variants: [
        { size: '34', color: 'Polished Black', stock: 25, sku: 'OX-SCH-019-34-BLK' },
        { size: '36', color: 'Polished Black', stock: 30, sku: 'OX-SCH-019-36-BLK' },
      ],
      images: [
        'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=800&q=80',
      ],
      description: 'Lace-up dress shoes engineered to endure playground sports and daily school assemblies.',
      shortDescription: 'Reinforced lace-up uniform shoes for middle & high school boys.',
      specifications: new Map([
        ['Upper', 'Genuine Polished Leather'],
        ['Collar', 'Padded Ankle Collar'],
      ]),
      sizeGuideId: kidsSizeGuideId,
      weight: 620,
      isFeatured: false,
      isActive: true,
      tags: ['school', 'servis', 'uniform', 'lace-up'],
      rating: 4.7,
      numReviews: 49,
    },
    // 20. Junior Girls Mary Jane Buckle School Shoes
    {
      name: 'Junior Girls Mary Jane Buckle School Shoes',
      nameUr: 'جونیئر گرلز میری جین بکل اسکول شوز',
      sku: 'OX-SCH-020',
      price: 2400,
      originalPrice: 3000,
      category: ProductCategory.KIDS,
      subCategory: ProductSubCategory.SCHOOL_SHOES,
      brand: ProductBrand.BATA,
      sizes: ['28', '30', '32'],
      colors: [{ name: 'Black Patent', hex: '#0A0A0A' }],
      variants: [
        { size: '28', color: 'Black Patent', stock: 20, sku: 'OX-SCH-020-28-PAT' },
        { size: '30', color: 'Black Patent', stock: 28, sku: 'OX-SCH-020-30-PAT' },
      ],
      images: [
        'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=800&q=80',
      ],
      description: 'Classic Mary Jane silhouette with comfortable instep strap and memory foam lining.',
      shortDescription: 'Charming Mary Jane buckle shoes for young schoolgirls.',
      specifications: new Map([
        ['Finish', 'Easy-Wipe Glossy Patent'],
        ['Lining', 'Anti-Bacterial Sockliner'],
      ]),
      sizeGuideId: kidsSizeGuideId,
      weight: 430,
      isFeatured: false,
      isActive: true,
      tags: ['mary-jane', 'girls', 'school-shoes', 'patent'],
      rating: 4.8,
      numReviews: 33,
    },
    // 21. Royal Peshawari Chappal Gold Embroidered Edition
    {
      name: 'Royal Peshawari Chappal Zari Edition',
      nameUr: 'شاہی پشاوری چپل زری ایڈیشن',
      sku: 'OX-ROY-021',
      price: 7500,
      originalPrice: 9000,
      category: ProductCategory.MEN,
      subCategory: ProductSubCategory.PESHAWARI_CHAPPAL,
      brand: ProductBrand.LOCAL,
      sizes: ['41', '42', '43', '44'],
      colors: [{ name: 'Matte Black Gold', hex: '#1C1C1C' }],
      variants: [
        { size: '42', color: 'Matte Black Gold', stock: 12, sku: 'OX-ROY-021-42-GLD' },
        { size: '43', color: 'Matte Black Gold', stock: 15, sku: 'OX-ROY-021-43-GLD' },
      ],
      images: [
        'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=80',
      ],
      description: 'Limited edition luxury wedding chappal embroidered with intricate metallic Zari work along the vamp.',
      shortDescription: 'Groom wedding collection Peshawari chappal with golden zari thread.',
      specifications: new Map([
        ['Embroidery', 'Antique Gold Zari'],
        ['Upper', 'Selected Calf Leather'],
      ]),
      sizeGuideId: menSizeGuideId,
      weight: 920,
      isFeatured: true,
      isActive: true,
      tags: ['wedding', 'zari', 'royal', 'peshawari', 'groom'],
      rating: 5.0,
      numReviews: 27,
    },
    // 22. Quetta Norozi Handcrafted Chappal
    {
      name: 'Quetta Norozi Handcrafted Chappal',
      nameUr: 'کوئٹہ نوروزی دستی چپل',
      sku: 'OX-NOR-022',
      price: 4200,
      originalPrice: 5500,
      category: ProductCategory.MEN,
      subCategory: ProductSubCategory.PESHAWARI_CHAPPAL,
      brand: ProductBrand.LOCAL,
      sizes: ['40', '41', '42', '43'],
      colors: [{ name: 'Chocolate Brown', hex: '#3D2314' }],
      variants: [
        { size: '41', color: 'Chocolate Brown', stock: 14, sku: 'OX-NOR-022-41-CHO' },
        { size: '42', color: 'Chocolate Brown', stock: 18, sku: 'OX-NOR-022-42-CHO' },
      ],
      images: [
        'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=800&q=80',
      ],
      description: 'Authentic Balochi Norozi Chappal characterized by its prominent folded vamp and thick mountain tyre sole.',
      shortDescription: 'Quetta heritage Norozi leather chappal built for extreme longevity.',
      specifications: new Map([
        ['Design', 'Traditional Balochi Norozi Cut'],
        ['Sole', 'High Density Recycled Aircraft Tyre'],
      ]),
      sizeGuideId: menSizeGuideId,
      weight: 1050,
      isFeatured: true,
      isActive: true,
      tags: ['quetta', 'norozi', 'chappal', 'balochi', 'leather'],
      rating: 4.9,
      numReviews: 39,
    },
  ];

  // Prepare products with calculated slug, discount, and aggregated stock
  const preparedProducts = productDefinitions.map((p) => {
    const slugBase = p.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    const discount =
      p.originalPrice > 0 && p.price <= p.originalPrice
        ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
        : 0;
    const totalStock = p.variants?.reduce((tot, v) => tot + (v.stock || 0), 0) || 50;

    return {
      ...p,
      slug: (p as { slug?: string }).slug || `${slugBase}`,
      discount,
      stock: totalStock,
      seoTitle: (p as { seoTitle?: string }).seoTitle || `${p.name} | OX Shoes Pakistan`,
      seoDescription:
        (p as { seoDescription?: string }).seoDescription || p.shortDescription.slice(0, 155),
    };
  });

  // Insert all products
  const products = await Product.insertMany(preparedProducts);

  /* --------------------------------------------------------------------------
     7. SEED STORE BANNERS (Hero, Top Strip, Eid Specials)
     -------------------------------------------------------------------------- */
  const banners = await Banner.insertMany([
    {
      title: 'Grand Eid Footwear Collection — Up to 30% Off',
      image:
        'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1600&q=80',
      mobileImage:
        'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=80',
      link: '/category/heritage-pakistani',
      position: BannerPosition.HERO,
      order: 1,
      isActive: true,
      startsAt: now,
      expiresAt: nextMonth,
    },
    {
      title: 'FREE EXPRESS SHIPPING ON ALL ORDERS OVER PKR 3,500 ACROSS PAKISTAN',
      image: '',
      link: '/shipping-policy',
      position: BannerPosition.TOP_STRIP,
      order: 1,
      isActive: true,
      startsAt: now,
      expiresAt: nextMonth,
    },
    {
      title: 'New Bridal Khussa Arrivals — Multani & Bahawalpuri Zari',
      image:
        'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1400&q=80',
      link: '/category/womens-footwear',
      position: BannerPosition.MID_PAGE,
      order: 2,
      isActive: true,
      startsAt: now,
      expiresAt: nextMonth,
    },
  ]);

  /* --------------------------------------------------------------------------
     8. SEED FLASH SALE (Eid Footwear Extravaganza)
     -------------------------------------------------------------------------- */
  const featuredProductIds = products.slice(0, 4).map((p) => p._id);
  const flashSales = await FlashSale.insertMany([
    {
      name: 'Eid Heritage Flash Sale — 25% Off Traditional Chappals',
      productIds: featuredProductIds,
      discountPercentage: 25,
      startsAt: now,
      endsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days flash
      isActive: true,
    },
  ]);

  /* --------------------------------------------------------------------------
     9. SEED ORDERS & VERIFIED REVIEWS
     -------------------------------------------------------------------------- */
  const firstProduct = products[0];
  const orderId = new Types.ObjectId();

  const orders = await Order.insertMany([
    {
      _id: orderId,
      orderNumber: 'OX-2026-1042',
      userId: dawoodAdminId,
      orderItems: [
        {
          productId: firstProduct._id,
          name: firstProduct.name,
          image: firstProduct.images[0],
          size: '42',
          color: 'Mustard Brown',
          quantity: 1,
          price: firstProduct.price,
          sku: firstProduct.sku,
        },
      ],
      subtotal: firstProduct.price,
      discountAmount: 450,
      couponCode: 'WELCOME10',
      taxAmount: Math.round(firstProduct.price * 0.17),
      shippingCharges: 150,
      totalAmount: firstProduct.price - 450 + Math.round(firstProduct.price * 0.17) + 150,
      shippingAddress: {
        fullName: 'Manager Dawood Khan',
        phone: '+923265695170',
        address: '12-C/1, MM Alam Road, Gulberg III',
        city: 'Lahore',
        postalCode: '54000',
      },
      status: OrderStatus.DELIVERED,
      paymentMethod: PaymentMethod.COD,
      paymentStatus: PaymentStatus.PAID,
      paymentDetails: {
        transactionId: 'COD-LHR-9982',
      },
      courier: Courier.TCS,
      trackingNumber: 'TCS7789123049PK',
      estimatedDelivery: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      deliveredAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      notes: 'Please ring bell twice upon arrival',
    },
  ]);

  const reviews = await Review.insertMany([
    {
      userId: dawoodAdminId,
      productId: firstProduct._id,
      orderId: orderId,
      rating: 5,
      title: 'Original Kaptaan double sole quality!',
      comment:
        'SubhanAllah outstanding craftsmanship. The leather is genuine full grain and the tyre sole is tough as nails. Delivered in Islamabad in 2 days via TCS.',
      images: [firstProduct.images[0]],
      isVerifiedPurchase: true,
      isApproved: true,
      helpfulCount: 14,
    },
  ]);

  return {
    usersCount: users.length,
    categoriesCount: categories.length,
    productsCount: products.length,
    shippingZonesCount: shippingZones.length,
    couponsCount: coupons.length,
    sizeGuidesCount: sizeGuides.length,
    bannersCount: banners.length,
    flashSalesCount: flashSales.length,
    ordersCount: orders.length,
    reviewsCount: reviews.length,
  };
}
