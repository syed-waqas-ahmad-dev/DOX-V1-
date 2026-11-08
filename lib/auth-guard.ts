import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  connectToDatabase,
  isDatabaseConnected,
  isDatabaseConfigured,
  isApprovedMockEnvironment,
} from '@/lib/db/connect';
import { User } from '@/models/User';
import { MockDb } from '@/lib/db/mock-store';
import { UserRole, Department } from '@/types';

export interface AuthSessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isEmailVerified: boolean;
}

export interface DepartmentAuthResult {
  authorized: boolean;
  userId: string | null;
  role: UserRole | null;
  department: Department | null;
  error?: string;
}

export interface DepartmentAuthOptions {
  requiredDepartment?: Department;
  requiredPermission?: string;
  allowElevatedAdmin?: boolean; // Default true (SUPER_ADMIN and ADMIN bypass department restrictions)
}

export interface SuperAdminAuthResult {
  authorized: boolean;
  userId: string | null;
  role: UserRole | null;
  error?: string;
}

export function hasRequiredRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  if (userRole === UserRole.SUPER_ADMIN) {
    return true; // Super admin has full clearance
  }
  return allowedRoles.includes(userRole);
}

export function isAdminRole(role: UserRole): boolean {
  return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN || role === UserRole.MANAGER;
}

/**
 * Strict elevated admin role predicate for cross-customer administrative operations
 * and financial ledger adjustments. Strictly excludes MANAGER, RIDER, and CUSTOMER.
 */
export function isElevatedAdminRole(role?: string | UserRole | null): boolean {
  if (!role) return false;
  const normalized = (role as string).trim().toLowerCase();
  return (
    normalized === UserRole.SUPER_ADMIN ||
    normalized === UserRole.ADMIN ||
    normalized === 'super_admin' ||
    normalized === 'admin'
  );
}

/**
 * Centralized, DB-verified server-side authorization helper for Department-Based Manager Access.
 * 1. Obtains session server-side via getServerSession(authOptions).
 * 2. Uses session.user.id ONLY as identity reference.
 * 3. Queries MongoDB (or MockDb in explicit offline mode) to fetch live role, department, permissions & isDeleted.
 * 4. Fails closed on database errors, missing accounts, or deactivated users.
 * 5. Rejects MANAGER accounts with missing or null department.
 * 6. Requires BOTH requiredDepartment AND requiredPermission for Manager authorization.
 */
export async function verifyDepartmentAuth(
  options: DepartmentAuthOptions = {}
): Promise<DepartmentAuthResult> {
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch {
    session = null;
  }

  if (!session?.user?.id) {
    return {
      authorized: false,
      userId: null,
      role: null,
      department: null,
      error: 'Unauthenticated: Valid session required',
    };
  }

  const userId = session.user.id;

  const dbConfigured = isDatabaseConfigured();

  let liveRole: UserRole | null = null;
  let liveDept: Department | null = null;
  let livePermissions: string[] = [];
  let isDeleted = false;

  if (dbConfigured) {
    try {
      await connectToDatabase();
    } catch {
      return {
        authorized: false,
        userId,
        role: null,
        department: null,
        error: 'Database error: Fail closed on connection failure',
      };
    }

    if (!isDatabaseConnected()) {
      return {
        authorized: false,
        userId,
        role: null,
        department: null,
        error: 'Database unavailable: Connection is not active',
      };
    }

    try {
      const userDoc = await User.findById(userId).select('role department permissions isDeleted').lean();
      if (!userDoc) {
        return {
          authorized: false,
          userId,
          role: null,
          department: null,
          error: 'Unauthorized: User account not found in database',
        };
      }
      isDeleted = Boolean(userDoc.isDeleted);
      liveRole = userDoc.role as UserRole;
      liveDept = (userDoc.department as Department) || null;
      livePermissions = Array.isArray(userDoc.permissions) ? userDoc.permissions : [];
    } catch {
      return {
        authorized: false,
        userId,
        role: null,
        department: null,
        error: 'Database error: Failed to retrieve user authorization profile',
      };
    }
  } else if (isApprovedMockEnvironment()) {
    // Explicit offline mock mode permitted ONLY when ALLOW_OFFLINE_MOCK_AUTH=true in approved local dev/test with unconfigured database
    const mockUser = MockDb.getUserById(userId);
    if (!mockUser) {
      return {
        authorized: false,
        userId,
        role: null,
        department: null,
        error: 'Unauthorized: User account not found in mock store',
      };
    }
    isDeleted = Boolean(mockUser.isDeleted);
    liveRole = mockUser.role as UserRole;
    liveDept = (mockUser.department as Department) || null;
    livePermissions = mockUser.permissions || [];
  } else {
    // Database unconfigured in unapproved environment (e.g. production, staging, CI, or missing ALLOW_OFFLINE_MOCK_AUTH opt-in)
    return {
      authorized: false,
      userId,
      role: null,
      department: null,
      error: 'Database error: Database is not configured',
    };
  }

  if (isDeleted) {
    return {
      authorized: false,
      userId,
      role: liveRole,
      department: liveDept,
      error: 'Unauthorized: User account has been deactivated',
    };
  }

  // 1. Super Admin & Admin operational clearance
  if (options.allowElevatedAdmin !== false && isElevatedAdminRole(liveRole)) {
    return {
      authorized: true,
      userId,
      role: liveRole,
      department: liveDept,
    };
  }

  // 2. Reject elevated admin if bypass is explicitly disabled
  if (options.allowElevatedAdmin === false && isElevatedAdminRole(liveRole)) {
    return {
      authorized: false,
      userId,
      role: liveRole,
      department: liveDept,
      error: 'Unauthorized: Elevated admin clearance disabled for this action',
    };
  }

  // 3. Reject non-manager roles attempting department actions
  if (liveRole !== UserRole.MANAGER) {
    return {
      authorized: false,
      userId,
      role: liveRole,
      department: liveDept,
      error: 'Unauthorized: Role does not possess department clearance',
    };
  }

  // 4. Reject unassigned managers (missing or null department)
  if (!liveDept) {
    return {
      authorized: false,
      userId,
      role: liveRole,
      department: null,
      error: 'Unauthorized: Manager account has no assigned department',
    };
  }

  // 5. Verify department match
  if (options.requiredDepartment && liveDept !== options.requiredDepartment) {
    return {
      authorized: false,
      userId,
      role: liveRole,
      department: liveDept,
      error: `Unauthorized: Manager department mismatch (Requires: ${options.requiredDepartment}, Found: ${liveDept})`,
    };
  }

  // 6. Verify required permission match
  if (options.requiredPermission && !livePermissions.includes(options.requiredPermission)) {
    return {
      authorized: false,
      userId,
      role: liveRole,
      department: liveDept,
      error: `Unauthorized: Missing required permission [${options.requiredPermission}]`,
    };
  }

  return {
    authorized: true,
    userId,
    role: liveRole,
    department: liveDept,
  };
}

/**
 * Separate explicit Super Admin-only authorization check for administrator-account management and platform setup.
 */
export async function verifySuperAdminAuth(): Promise<SuperAdminAuthResult> {
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch {
    session = null;
  }

  if (!session?.user?.id) {
    return {
      authorized: false,
      userId: null,
      role: null,
      error: 'Unauthenticated: Valid session required',
    };
  }

  const userId = session.user.id;

  const dbConfigured = isDatabaseConfigured();

  let liveRole: UserRole | null = null;
  let isDeleted = false;

  if (dbConfigured) {
    try {
      await connectToDatabase();
    } catch {
      return {
        authorized: false,
        userId,
        role: null,
        error: 'Database error: Fail closed on connection failure',
      };
    }

    if (!isDatabaseConnected()) {
      return {
        authorized: false,
        userId,
        role: null,
        error: 'Database unavailable: Connection is not active',
      };
    }

    try {
      const userDoc = await User.findById(userId).select('role isDeleted').lean();
      if (!userDoc) {
        return {
          authorized: false,
          userId,
          role: null,
          error: 'Unauthorized: Account not found',
        };
      }
      isDeleted = Boolean(userDoc.isDeleted);
      liveRole = userDoc.role as UserRole;
    } catch {
      return {
        authorized: false,
        userId,
        role: null,
        error: 'Database error: Failed to retrieve user authorization profile',
      };
    }
  } else if (isApprovedMockEnvironment()) {
    // Explicit offline mock mode permitted ONLY when ALLOW_OFFLINE_MOCK_AUTH=true in approved local dev/test with unconfigured database
    const mockUser = MockDb.getUserById(userId);
    if (!mockUser) {
      return {
        authorized: false,
        userId,
        role: null,
        error: 'Unauthorized: Account not found',
      };
    }
    isDeleted = Boolean(mockUser.isDeleted);
    liveRole = mockUser.role as UserRole;
  } else {
    // Database unconfigured in unapproved environment (e.g. production, staging, CI, or missing ALLOW_OFFLINE_MOCK_AUTH opt-in)
    return {
      authorized: false,
      userId,
      role: null,
      error: 'Database error: Database is not configured',
    };
  }

  if (isDeleted) {
    return {
      authorized: false,
      userId,
      role: liveRole,
      error: 'Unauthorized: Account has been deactivated',
    };
  }

  if (liveRole !== UserRole.SUPER_ADMIN) {
    return {
      authorized: false,
      userId,
      role: liveRole,
      error: 'Unauthorized: Super Admin clearance required',
    };
  }

  return {
    authorized: true,
    userId,
    role: UserRole.SUPER_ADMIN,
  };
}

