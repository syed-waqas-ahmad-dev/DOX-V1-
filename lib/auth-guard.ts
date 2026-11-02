/**
 * @file lib/auth-guard.ts
 * @description Authentication and authorization guard helpers for server actions and routes.
 * Enforces role-based access control (super_admin, admin, manager, customer).
 * Strict TypeScript: ZERO `any`.
 */

import { UserRole } from '@/types';

export interface AuthSessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isEmailVerified: boolean;
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

