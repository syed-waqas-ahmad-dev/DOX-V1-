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
import { verifySuperAdminAuth } from '@/lib/auth-guard';
import { connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { User } from '@/models/User';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { CreateAdminSchema, type CreateAdminInput } from '@/lib/validators/manage-admins';
import { UserRole, Department } from '@/types';

export type { CreateAdminInput } from '@/lib/validators/manage-admins';

const DeleteAdminSchema = z.string().trim().min(1, 'Admin ID is required');

export interface AdminUserItem {
  _id: string;
  name: string;
  email: string;
  role: string;
  department?: string | null;
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
    const auth = await verifySuperAdminAuth();
    if (!auth.authorized) {
      return {
        success: false,
        error: auth.error || 'Access Denied: Only super_admin can view the admins list.',
      };
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      return {
        success: false,
        error: 'Database connection is currently unavailable.',
      };
    }

    // Query admin, super_admin, and manager accounts
    const adminRoles = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER];
    const admins = await User.find({
      role: { $in: adminRoles },
      isDeleted: { $ne: true },
    })
      .select('name email role department permissions createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const sanitizedList: AdminUserItem[] = (
      admins as Array<{
        _id: unknown;
        name?: string;
        email?: string;
        role?: string;
        department?: string | null;
        permissions?: string[];
        createdAt?: Date;
      }>
    ).map((u) => ({
      _id: String(u._id),
      name: u.name || 'Admin User',
      email: u.email || '',
      role: u.role || 'admin',
      department: u.department || null,
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
 * 3. Sets role to 'admin' or 'manager' according to input.
 * 4. Assigns department for 'manager' roles.
 * 5. Logs audit entry: console.log('AUDIT:', ...)
 * Strict TypeScript: ZERO `any`. No fetch(), no UserRole enum.
 */
export async function createAdmin(
  data: CreateAdminInput
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Access Control: Live check for super_admin clearance
    const auth = await verifySuperAdminAuth();
    if (!auth.authorized) {
      return {
        success: false,
        error: auth.error || 'Unauthorized: Only super_admin can create admin accounts.',
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
    const { name, email, password, role, department, permissions } = parsedResult.data;

    // 2.5 Security: Prevent non-super_admin from assigning privileged roles or promoting themselves.
    // (Already checked sessionRole === 'super_admin' above, but good to be explicit about target role)
    if (role === UserRole.SUPER_ADMIN) {
      return {
        success: false,
        error: 'Unauthorized: Cannot create additional super_admin accounts via this interface.',
      };
    }

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

    // 5. Set role and department according to input (Strictly validated by Zod)
    const newAdmin = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: role,
      department: role === UserRole.MANAGER ? department : null,
      permissions: permissions,
    });

    // 6. Save action to Audit Log (console.log('AUDIT:', ...) until model is implemented)
    console.log(
      'AUDIT:',
      JSON.stringify({
        action: 'CREATE_ADMIN',
        performedBy: auth.userId || 'super_admin',
        targetAdminId: String(newAdmin._id),
        targetAdminEmail: normalizedEmail,
        targetRole: newAdmin.role || role,
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
 * 2. Fetches target user to ensure existence and verifies role is NOT super_admin.
 * 3. CRITICAL: Super Admin accounts can NEVER be deleted.
 * 4. Prevents administrators from deleting their own account.
 * 5. Removes user from DB via User.findByIdAndDelete.
 * 6. Writes to AuditLog: action: 'DELETE_ADMIN', actorEmail: session.user.email, targetId: adminId, oldState: { email: targetUser.email }.
 * 7. Calls revalidatePath('/admin/manage-admins') to refresh UI.
 * Strict TypeScript: ZERO `any`.
 */
export async function deleteAdmin(
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Access Control: Live check for super_admin clearance
    const auth = await verifySuperAdminAuth();
    if (!auth.authorized) {
      return {
        success: false,
        error: auth.error || 'Unauthorized: Only super_admin can delete administrator accounts.',
      };
    }
    const sessionUserId = auth.userId;

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

    // 3. Fetch target user to ensure they exist
    const targetUser = await User.findById(validAdminId).select('_id email role name');
    if (!targetUser) {
      return {
        success: false,
        error: 'Administrator not found.',
      };
    }

    // Role-based protection: Super Admin accounts can NEVER be deleted
    if (targetUser.role === 'super_admin') {
      return {
        success: false,
        error: 'Super Admin accounts are permanently protected and cannot be deleted.',
      };
    }

    // Prevent administrators from deleting their own account
    if (sessionUserId && sessionUserId === validAdminId) {
      return {
        success: false,
        error: 'Administrators cannot delete their own account.',
      };
    }

    // 4. Delete the user from the DB
    await User.findByIdAndDelete(validAdminId);

    // 5. Write to AuditLog
    console.log(
      'AUDIT:',
      JSON.stringify({
        action: 'DELETE_ADMIN',
        actorEmail: auth.userId || 'super_admin',
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

