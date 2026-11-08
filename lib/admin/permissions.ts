import { Department } from '@/types';

/**
 * Master registry of all administrator and manager permissions.
 *
 * Runtime consumer alignment:
 * - products:read, products:write, products:delete, stock:update -> actions/product.actions.ts
 * - orders:read, orders:update_status -> actions/order.actions.ts
 * - delivery:view, delivery:partners, delivery:dispatch, delivery:settle -> actions/delivery.actions.ts
 * - returns:read -> actions/return.actions.ts
 *
 * Backward-compatibility retention:
 * - orders:assign_courier, returns:write, delivery:read, delivery:write:
 *   Retained so existing stored Manager documents in MongoDB remain valid.
 * - marketing:manage, finance:view_reports:
 *   Retained for existing admin accounts; excluded from all departments (no Marketing/Finance department).
 */
export const ADMIN_PERMISSIONS = [
  'products:read',
  'products:write',
  'products:delete',
  'stock:update',
  'orders:read',
  'orders:update_status',
  'orders:assign_courier',
  'returns:read',
  'returns:write',
  'delivery:read',
  'delivery:write',
  'delivery:view',
  'delivery:partners',
  'delivery:dispatch',
  'delivery:settle',
  'marketing:manage',
  'finance:view_reports',
] as const;

export type AdminPermission = typeof ADMIN_PERMISSIONS[number];

/**
 * Canonical mapping of permissions allowed for each department.
 * Managers can only be assigned permissions within their department's boundary.
 */
export const DEPARTMENT_PERMISSIONS: Record<Department, AdminPermission[]> = {
  [Department.INVENTORY]: ['products:read', 'products:write', 'products:delete', 'stock:update'],
  [Department.ORDERS]: ['orders:read', 'orders:update_status', 'orders:assign_courier'],
  [Department.RETURNS]: ['returns:read', 'returns:write'],
  [Department.DELIVERY]: [
    'delivery:view',
    'delivery:partners',
    'delivery:dispatch',
    'delivery:settle', // Allowed but NOT default
    'delivery:read',   // Legacy compatibility
    'delivery:write',  // Legacy compatibility
  ],
};

/**
 * Default permissions assigned when a Manager is provisioned.
 * delivery:settle is explicitly excluded from defaults.
 */
export const DEFAULT_MANAGER_PERMISSIONS: Record<Department, AdminPermission[]> = {
  [Department.INVENTORY]: ['products:read'],
  [Department.ORDERS]: ['orders:read'],
  [Department.RETURNS]: ['returns:read'],
  [Department.DELIVERY]: ['delivery:view', 'delivery:partners', 'delivery:dispatch'],
};

export function isValidPermission(p: string): p is AdminPermission {
  return (ADMIN_PERMISSIONS as readonly string[]).includes(p);
}
