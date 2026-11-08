import { z } from 'zod';
import { ADMIN_PERMISSIONS, DEPARTMENT_PERMISSIONS, type AdminPermission } from '@/lib/admin/permissions';
import { UserRole, Department } from '@/types';

export const CreateAdminSchema = z.object({
  name: z.string().trim().min(1, 'Full Name is required'),
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  role: z.nativeEnum(UserRole).default(UserRole.ADMIN),
  department: z.nativeEnum(Department).nullable().optional().default(null),
  permissions: z.array(z.enum([...ADMIN_PERMISSIONS] as [AdminPermission, ...AdminPermission[]])).default([]),
}).refine((data) => {
  // 1. Enforce department requirement for Managers
  if (data.role === UserRole.MANAGER && !data.department) {
    return false;
  }
  return true;
}, {
  message: "Department is required for managers",
  path: ["department"],
}).refine((data) => {
  // 2. Enforce department-specific permission boundary for Managers
  if (data.role === UserRole.MANAGER && data.department) {
    const allowed = DEPARTMENT_PERMISSIONS[data.department] || [];
    return data.permissions.every(p => (allowed as string[]).includes(p));
  }
  return true;
}, {
  message: "One or more permissions do not belong to the selected department",
  path: ["permissions"],
});

export type CreateAdminInput = z.infer<typeof CreateAdminSchema>;
