import { z } from 'zod';
import { ADMIN_PERMISSIONS, type AdminPermission } from '@/lib/admin/permissions';

export const CreateAdminSchema = z.object({
  name: z.string().trim().min(1, 'Full Name is required'),
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  permissions: z.array(z.enum([...ADMIN_PERMISSIONS] as [AdminPermission, ...AdminPermission[]])).default([]),
});

export type CreateAdminInput = z.infer<typeof CreateAdminSchema>;
