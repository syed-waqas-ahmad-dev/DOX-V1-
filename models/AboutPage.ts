/**
 * @file models/AboutPage.ts
 * @description Mongoose model for About Us page configuration, hero imagery, store manager profile, and team stats.
 * Strict TypeScript: ZERO `any`.
 */

import { Schema, model, models, type Model, type Types } from 'mongoose';

export interface IAboutHeroImage {
  url: string;
  alt: string;
  publicId?: string;
}

export interface IAboutManager {
  name: string;
  description: string;
  phone: string;
  imageUrl: string;
  publicId?: string;
}

export interface IAboutTeamCategory {
  role: string;
  count: number;
}

export interface IAboutPage {
  _id: Types.ObjectId | string;
  heroImages: IAboutHeroImage[];
  manager: IAboutManager;
  teamCategories: IAboutTeamCategory[];
  lastUpdatedBy?: Types.ObjectId | string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const aboutHeroImageSchema = new Schema<IAboutHeroImage>(
  {
    url: { type: String, required: true, trim: true },
    alt: { type: String, default: 'OX Shoes Heritage' },
    publicId: { type: String },
  },
  { _id: false }
);

const aboutManagerSchema = new Schema<IAboutManager>(
  {
    name: { type: String, default: 'Dawood Khan', trim: true },
    description: {
      type: String,
      default:
        'Master craftsman with over 20 years of legacy in bespoke handmade leather footwear. Leading OX Shoes with dedication to pure Pakistani craftsmanship.',
      trim: true,
    },
    phone: { type: String, default: '+92-300-1234567', trim: true },
    imageUrl: {
      type: String,
      default: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      trim: true,
    },
    publicId: { type: String },
  },
  { _id: false }
);

const aboutTeamCategorySchema = new Schema<IAboutTeamCategory>(
  {
    role: { type: String, required: true, trim: true },
    count: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const aboutPageSchema = new Schema<IAboutPage>(
  {
    heroImages: {
      type: [aboutHeroImageSchema],
      default: [],
    },
    manager: {
      type: aboutManagerSchema,
      default: () => ({}),
    },
    teamCategories: {
      type: [aboutTeamCategorySchema],
      default: [],
    },
    lastUpdatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const AboutPage: Model<IAboutPage> =
  (models.AboutPage as Model<IAboutPage>) ||
  model<IAboutPage>('AboutPage', aboutPageSchema);

export default AboutPage;
