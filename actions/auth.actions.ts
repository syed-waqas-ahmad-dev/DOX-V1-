'use server';

/**
 * @file actions/auth.actions.ts
 * @description Authentication Server Actions (login, register with referral code).
 * Strict TypeScript: ZERO `any`.
 */

import { connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { User } from '@/models/User';
import { Referral } from '@/models/Referral';
import { signupSchema, loginSchema, type SignupInput, type LoginInput } from '@/lib/validators';
import { successResponse, errorResponse, type ActionResult } from '@/lib/response';
import { handleActionError } from '@/lib/error-handler';
import { ReferralStatus, UserRole, type IUser } from '@/types';
import { Types } from 'mongoose';
import { cookies } from 'next/headers';
import { MockDb } from '@/lib/db/mock-store';

export async function registerUser(input: SignupInput): Promise<ActionResult<Pick<IUser, '_id' | 'name' | 'email' | 'role'>>> {
  try {
    await connectToDatabase();
    const validated = signupSchema.parse(input);

    // Check referral code: from form input OR from 30-day cookie
    let refCodeToUse = validated.referralCode?.trim().toUpperCase();
    if (!refCodeToUse) {
      try {
        const cookieStore = await cookies();
        const cookieRef = cookieStore.get('ref_code')?.value;
        if (cookieRef) refCodeToUse = cookieRef.trim().toUpperCase();
      } catch {
        // cookies() fallback
      }
    }

    if (!isDatabaseConnected()) {
      return errorResponse('Database connection is currently unavailable. Please try again later.');
    }

    const cleanEmail = validated.email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return errorResponse('An account with this email address already exists. Please sign in.');
    }

    // Check referral code in DB if provided
    let referredBy: typeof User.prototype._id | undefined = undefined;
    let referrerDoc = null;
    if (refCodeToUse) {
      referrerDoc = await User.findOne({ referralCode: refCodeToUse });
      if (referrerDoc) {
        const isSelfReferral =
          referrerDoc.email.toLowerCase().trim() === cleanEmail ||
          (validated.phone && referrerDoc.phone && referrerDoc.phone.trim() === validated.phone.trim());

        if (!isSelfReferral) {
          referredBy = referrerDoc._id;
        } else {
          referrerDoc = null; // Block self-referral
        }
      }
    }

    // Generate unique referral code for the new user: USR-XXXX
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const myReferralCode = `USR-${randomHex}`;

    // Public signup strictly forces CUSTOMER role. Any user-supplied role is ignored.
    const newUser = await User.create({
      name: validated.name.trim(),
      email: cleanEmail,
      phone: validated.phone.trim(),
      password: validated.password, // Mongoose pre-save hook hashes with bcrypt
      role: UserRole.CUSTOMER,
      walletBalance: 0,
      referralCode: myReferralCode,
      ...(referredBy ? { referredBy } : {}),
      addresses: [],
    });

    // Create pending Referral record so referrer can see who registered
    if (referrerDoc) {
      await Referral.create({
        referrerId: referrerDoc._id,
        refereeId: newUser._id,
        referredEmail: newUser.email,
        referredName: newUser.name,
        code: refCodeToUse,
        rewardAmount: 200,
        status: ReferralStatus.PENDING,
      });
    }

    return successResponse(
      {
        _id: newUser._id.toString() as unknown as Types.ObjectId,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
      'Welcome to OX Shoes! Account created successfully.'
    );
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function loginUser(input: LoginInput): Promise<ActionResult<Pick<IUser, '_id' | 'name' | 'email' | 'role'>>> {
  try {
    await connectToDatabase();
    const validated = loginSchema.parse(input);
    const email = validated.email.toLowerCase().trim();

    if (!isDatabaseConnected()) {
      return errorResponse('Database service is unavailable. Please try again.');
    }

    const user = await User.findOne({ email }).select('+password +role');
    if (!user || !user.password) {
      // Return identical error message without disclosing user existence
      return errorResponse('Invalid email or password.');
    }

    const isMatch = await user.comparePassword(validated.password);
    if (!isMatch) {
      return errorResponse('Invalid email or password.');
    }

    // Retrieve genuine identity and role directly from the trusted database document
    return successResponse(
      {
        _id: user._id.toString() as unknown as Types.ObjectId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      'Signed in successfully.'
    );
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function loginWithGoogleFallback(demoEmail?: string): Promise<ActionResult<Pick<IUser, '_id' | 'name' | 'email' | 'role'>>> {
  return errorResponse('Google OAuth sign-in must be completed via the official authentication flow.');
}

