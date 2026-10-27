/**
 * @file lib/admin/permissions.ts
 * @description Canonical RBAC permissions for OX Shoes administrators.
 * Strict TypeScript: ZERO `any`.
 */

export const ADMIN_PERMISSIONS = [
  'products:read',
  'products:write',
  'products:delete',
  'orders:read',
  'orders:update_status',
  'orders:assign_courier',
  'marketing:manage',
  'finance:view_reports',
] as const;

export type AdminPermission = typeof ADMIN_PERMISSIONS[number];

export function isValidPermission(p: string): p is AdminPermission {
  return (ADMIN_PERMISSIONS as readonly string[]).includes(p);
}
