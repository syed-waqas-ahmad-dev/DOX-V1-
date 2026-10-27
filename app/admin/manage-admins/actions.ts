'use server';

/**
 * @file app/admin/manage-admins/actions.ts
 * @description Server Actions for RBAC Admin Management in OX Shoes.
 * Strictly uses string literals for roles ('super_admin' and 'admin') without UserRole enum.
 * Hashes passwords with bcrypt before saving to MongoDB and outputs required Audit logs.
 * Strict TypeScript: ZERO `any`.
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { User } from '@/models/User';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { CreateAdminSchema, type CreateAdminInput } from '@/lib/validators/manage-admins';

export type { CreateAdminInput } from '@/lib/validators/manage-admins';

const PRIMARY_SUPER_ADMIN_EMAIL = 'ahmadsyedwaqas4@gmail.com';

const DeleteAdminSchema = z.string().trim().min(1, 'Admin ID is required');

export interface AdminUserItem {
  _id: string;
  name: string;
  email: string;
  role: string;
  permissions?: string[];
  createdAt?: string;
}

/**
 * Server Action: Retrieves the list of administrators.
 * Access restricted strictly to session role === 'super_admin'.
 * No UserRole enum used.
 */
export async function getAdminsList(): Promise<{
  success: boolean;
  data?: AdminUserItem[];
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    const sessionRole = (session?.user as { role?: string } | undefined)?.role;
    const sessionEmail = session?.user?.email?.toLowerCase().trim();

    if (sessionRole !== 'super_admin' && sessionEmail !== PRIMARY_SUPER_ADMIN_EMAIL) {
      return {
        success: false,
        error: 'Access Denied: Only super_admin can view the admins list.',
      };
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      return {
        success: true,
        data: [
          {
            _id: 'mock-super-admin',
            name: 'Super Admin Ahmad Syed Waqas',
            email: 'superadmin@oxshoes.pk',
            role: 'super_admin',
            permissions: [
              'products:read',
              'products:write',
              'products:delete',
              'orders:read',
              'orders:update_status',
              'orders:assign_courier',
              'marketing:manage',
              'finance:view_reports',
            ],
          },
          {
            _id: 'mock-admin-dawood',
            name: 'Dawood Khan',
            email: 'dawood@oxshoes.pk',
            role: 'admin',
            permissions: ['products:read', 'orders:read'],
          },
        ],
      };
    }

    // Query both admin and super_admin accounts strictly using string literals
    const adminRoles = ['admin', 'super_admin'] as unknown as never[];
    const admins = await User.find({
      role: { $in: adminRoles },
      isDeleted: { $ne: true },
    })
      .select('name email role permissions createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const sanitizedList: AdminUserItem[] = (
      admins as Array<{
        _id: unknown;
        name?: string;
        email?: string;
        role?: string;
        permissions?: string[];
        createdAt?: Date;
      }>
    ).map((u) => ({
      _id: String(u._id),
      name: u.name || 'Admin User',
      email: u.email || '',
      role: u.role || 'admin',
      permissions: Array.isArray(u.permissions) ? u.permissions : [],
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : undefined,
    }));

    return {
      success: true,
      data: sanitizedList,
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Failed to retrieve admins list';
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Server Action: Creates a new administrator account with granular permissions.
 * Access Control: Checks session role === 'super_admin'.
 * Validations:
 * 1. Checks if email already exists -> returns error: 'Admin already exists'
 * 2. Hashes password with bcrypt before saving to DB
 * 3. Sets role to 'admin' strictly (No Manager/Editor roles)
 * 4. Logs audit entry: console.log('AUDIT:', ...)
 * Strict TypeScript: ZERO `any`. No fetch(), no UserRole enum.
 */
export async function createAdmin(
  data: CreateAdminInput
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Access Control: Check session role === 'super_admin'
    const session = await getServerSession(authOptions);
    const sessionRole = (session?.user as { role?: string } | undefined)?.role;
    const sessionEmail = session?.user?.email?.toLowerCase().trim();

    if (sessionRole !== 'super_admin' && sessionEmail !== PRIMARY_SUPER_ADMIN_EMAIL) {
      return {
        success: false,
        error: 'Unauthorized: Only super_admin can create admin accounts.',
      };
    }

    // 2. Validate input schema with Zod
    const parsedResult = CreateAdminSchema.safeParse(data);
    if (!parsedResult.success) {
      const firstIssue = parsedResult.error.issues[0];
      return {
        success: false,
        error: firstIssue ? firstIssue.message : 'Invalid admin account details.',
      };
    }
    const { name, email, password, permissions } = parsedResult.data;

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      return {
        success: false,
        error: 'Database connection is currently unavailable. Please try again.',
      };
    }

    // 3. Validation: If email already exists, return error: 'Admin already exists'
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail })
      .select('_id email')
      .lean();

    if (existing) {
      return {
        success: false,
        error: 'Admin already exists',
      };
    }

    // 4. Hash password with bcrypt before saving to DB
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 5. Set role to 'admin' strictly (No Manager/Editor roles)
    const newAdmin = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'admin' as unknown as never,
      permissions: permissions,
    });

    // 6. Save action to Audit Log (console.log('AUDIT:', ...) until model is implemented)
    console.log(
      'AUDIT:',
      JSON.stringify({
        action: 'CREATE_ADMIN',
        performedBy: session?.user?.email || 'super_admin',
        targetAdminId: String(newAdmin._id),
        targetAdminEmail: normalizedEmail,
        targetRole: 'admin',
        assignedPermissions: permissions,
        timestamp: new Date().toISOString(),
      })
    );

    // 7. Revalidate admin management route
    revalidatePath('/admin/manage-admins');

    return {
      success: true,
    };
  } catch (err: unknown) {
    // Handle MongoDB duplicate key error (code 11000)
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: number }).code === 11000
    ) {
      return {
        success: false,
        error: 'Admin already exists',
      };
    }

    const errorMsg =
      err instanceof Error ? err.message : 'Failed to create administrator.';
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Server Action: Deletes an administrator account.
 * Access Control: Checks session for 'super_admin' role.
 * Validations & Safeguards:
 * 1. Validates adminId with Zod.
 * 2. Fetches target user to ensure existence and verifies email is NOT 'ahmadsyedwaqas4@gmail.com'.
 * 3. CRITICAL: The primary Super Admin ('ahmadsyedwaqas4@gmail.com') can NEVER be deleted.
 * 4. Prevents primary admin from deleting their own account.
 * 5. Removes user from DB via User.findByIdAndDelete.
 * 6. Writes to AuditLog: action: 'DELETE_ADMIN', actorEmail: session.user.email, targetId: adminId, oldState: { email: targetUser.email }.
 * 7. Calls revalidatePath('/admin/manage-admins') to refresh UI.
 * Strict TypeScript: ZERO `any`.
 */
export async function deleteAdmin(
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Access Control: Check session for 'super_admin' role
    const session = await getServerSession(authOptions);
    const sessionRole = (session?.user as { role?: string } | undefined)?.role;
    const sessionEmail = session?.user?.email?.toLowerCase().trim();

    if (sessionRole !== 'super_admin' && sessionEmail !== PRIMARY_SUPER_ADMIN_EMAIL) {
      return {
        success: false,
        error: 'Unauthorized: Only super_admin can delete administrator accounts.',
      };
    }

    // 2. Validate adminId using Zod
    const parsedResult = DeleteAdminSchema.safeParse(adminId);
    if (!parsedResult.success) {
      const issue = parsedResult.error.issues[0];
      return {
        success: false,
        error: issue ? issue.message : 'Invalid administrator ID provided.',
      };
    }
    const validAdminId = parsedResult.data;

    // Reject demo accounts
    if (validAdminId.startsWith('mock-')) {
      return {
        success: false,
        error: 'Demo administrator accounts cannot be deleted.',
      };
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      return {
        success: false,
        error: 'Database connection is currently unavailable. Please try again.',
      };
    }

    // 3. Fetch target user to ensure they exist and email is NOT primary super admin
    const targetUser = await User.findById(validAdminId).select('_id email role name');
    if (!targetUser) {
      return {
        success: false,
        error: 'Administrator not found.',
      };
    }

    const targetEmail = targetUser.email ? targetUser.email.toLowerCase().trim() : '';

    // CRITICAL: The primary Super Admin ('ahmadsyedwaqas4@gmail.com') can NEVER be deleted.
    if (targetEmail === PRIMARY_SUPER_ADMIN_EMAIL) {
      return {
        success: false,
        error: 'CRITICAL: The primary Super Admin account (ahmadsyedwaqas4@gmail.com) can NEVER be deleted.',
      };
    }

    // Prevent primary admin from deleting their own account
    if (sessionEmail === PRIMARY_SUPER_ADMIN_EMAIL && targetEmail === PRIMARY_SUPER_ADMIN_EMAIL) {
      return {
        success: false,
        error: 'Cannot delete the primary Super Admin account.',
      };
    }

    // 4. Delete the user from the DB
    await User.findByIdAndDelete(validAdminId);

    // 5. Write to AuditLog
    console.log(
      'AUDIT:',
      JSON.stringify({
        action: 'DELETE_ADMIN',
        actorEmail: session?.user?.email || 'super_admin',
        targetId: validAdminId,
        oldState: { email: targetUser.email },
        timestamp: new Date().toISOString(),
      })
    );

    // 6. Call revalidatePath to refresh the UI
    revalidatePath('/admin/manage-admins');

    return {
      success: true,
    };
  } catch (err: unknown) {
    // Handle MongoDB CastError gracefully
    if (
      err &&
      typeof err === 'object' &&
      'name' in err &&
      (err as { name: string }).name === 'CastError'
    ) {
      return {
        success: false,
        error: 'Invalid administrator ID format.',
      };
    }

    const errorMsg =
      err instanceof Error ? err.message : 'Failed to delete administrator.';
    return {
      success: false,
      error: errorMsg,
    };
  }
}

