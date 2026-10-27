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
