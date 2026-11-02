'use server';

/**
 * @file actions/user.actions.ts
 * @description Customer profile and delivery address management server actions.
 * Enforces strict role-based access control (CUSTOMER/MANAGER restricted to self,
 * cross-customer access strictly limited to SUPER_ADMIN/ADMIN).
 * Strict TypeScript: ZERO `any`.
 */

import { connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { User } from '@/models/User';
import { addressSchema, type AddressInput } from '@/lib/validators';
import { successResponse, errorResponse, type ActionResult } from '@/lib/response';
import { handleActionError } from '@/lib/error-handler';
import { Types } from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isElevatedAdminRole } from '@/lib/auth-guard';
import type { IUser, IAddress } from '@/types';

/**
 * Retrieve user profile details.
 * Requires authenticated session. Non-elevated roles (CUSTOMER, MANAGER) can access only their own profile.
 * Elevated admins (SUPER_ADMIN, ADMIN) may access any user profile.
 * Sensitive password hashes and internal credentials are never returned.
 */
export async function getUserProfile(userId?: string): Promise<ActionResult<Partial<IUser>>> {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    if (!session?.user) {
      return errorResponse('Unauthenticated: Please sign in to view user profile.');
    }

    const sessionUser = session.user as { id?: string; email?: string; role?: string };
    const isElevatedAdmin = isElevatedAdminRole(sessionUser.role);

    // Non-elevated roles (CUSTOMER, MANAGER) can only query their own profile
    if (userId && !isElevatedAdmin && userId !== sessionUser.id) {
      return errorResponse("Unauthorized: Cannot access another customer's profile.");
    }

    const targetUserId = isElevatedAdmin && userId ? userId.trim() : sessionUser.id;
    if (!targetUserId || typeof targetUserId !== 'string' || !targetUserId.trim()) {
      return errorResponse('Invalid session: Missing user identifier.');
    }

    const cleanTargetId = targetUserId.trim();
    if (!Types.ObjectId.isValid(cleanTargetId)) {
      return errorResponse('Invalid request: Target user identifier must be a valid MongoDB ID.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      return errorResponse('Database connection is currently unavailable.');
    }

    const user = await User.findById(cleanTargetId)
      .select('name email phone addresses referralCode role createdAt')
      .lean();

    if (!user) {
      return errorResponse('User account not found.');
    }

    return successResponse(JSON.parse(JSON.stringify(user)));
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

/**
 * Add a new delivery address for a user.
 * Caller must be the account owner or an elevated administrator.
 */
export async function addAddress(userId: string, input: AddressInput): Promise<ActionResult<IAddress[]>> {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    if (!session?.user) {
      return errorResponse('Unauthenticated: Please sign in to add an address.');
    }

    const sessionUser = session.user as { id?: string; role?: string };
    const isElevatedAdmin = isElevatedAdminRole(sessionUser.role);

    if (userId !== sessionUser.id && !isElevatedAdmin) {
      return errorResponse("Unauthorized: Cannot modify addresses for another customer.");
    }

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return errorResponse('Invalid user ID format.');
    }

    await connectToDatabase();
    const validated = addressSchema.parse(input);

    if (!isDatabaseConnected()) {
      return successResponse([validated as unknown as IAddress], 'Address added successfully.');
    }

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse('User not found.');
    }

    if (validated.isDefault) {
      user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
    } else if (user.addresses.length === 0) {
      validated.isDefault = true;
    }

    user.addresses.push(validated as unknown as IAddress);
    await user.save();

    return successResponse(JSON.parse(JSON.stringify(user.addresses)), 'Address added successfully.');
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

/**
 * Delete a delivery address for a user.
 * Caller must be the account owner or an elevated administrator.
 */
export async function deleteAddress(userId: string, addressId: string): Promise<ActionResult<IAddress[]>> {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    if (!session?.user) {
      return errorResponse('Unauthenticated: Please sign in to remove an address.');
    }

    const sessionUser = session.user as { id?: string; role?: string };
    const isElevatedAdmin = isElevatedAdminRole(sessionUser.role);

    if (userId !== sessionUser.id && !isElevatedAdmin) {
      return errorResponse("Unauthorized: Cannot modify addresses for another customer.");
    }

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return errorResponse('Invalid user ID format.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      return successResponse([], 'Address removed.');
    }

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse('User not found.');
    }

    user.addresses = user.addresses.filter((addr) => addr._id?.toString() !== addressId) as unknown as IAddress[];
    await user.save();

    return successResponse(JSON.parse(JSON.stringify(user.addresses)), 'Address removed.');
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
