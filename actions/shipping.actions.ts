'use server';

/**
 * @file actions/shipping.actions.ts
 * @description Server actions for Pakistani metropolitan shipping tariffs and SLAs.
 * Strict TypeScript: ZERO `any`.
 */

import { connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { ShippingZone } from '@/models/ShippingZone';
import { successResponse, type ActionResult } from '@/lib/response';
import { type IShippingZone } from '@/types';
import { Types } from 'mongoose';

const DEFAULT_SHIPPING_ZONES: IShippingZone[] = [
  {
    _id: new Types.ObjectId(),
    name: 'Lahore Express Zone',
    cities: ['Lahore', 'Kasur', 'Sheikhupura'],
    baseRate: 150,
    perKgRate: 50,
    estimatedDays: { min: 1, max: 2 },
    freeShippingThreshold: 3000,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: new Types.ObjectId(),
    name: 'Karachi Metropolitan Hub',
    cities: ['Karachi', 'Hyderabad'],
    baseRate: 200,
    perKgRate: 60,
    estimatedDays: { min: 2, max: 3 },
    freeShippingThreshold: 3500,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: new Types.ObjectId(),
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
    ],
    baseRate: 250,
    perKgRate: 75,
    estimatedDays: { min: 3, max: 5 },
    freeShippingThreshold: 4000,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export async function getShippingZones(): Promise<ActionResult<IShippingZone[]>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      return successResponse(DEFAULT_SHIPPING_ZONES);
    }

    const zones = await ShippingZone.find({ isActive: true }).lean();
    if (!zones || zones.length === 0) {
      return successResponse(DEFAULT_SHIPPING_ZONES);
    }

    return successResponse(JSON.parse(JSON.stringify(zones)));
  } catch (error: unknown) {
    return successResponse(DEFAULT_SHIPPING_ZONES);
  }
}
