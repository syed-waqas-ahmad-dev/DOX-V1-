import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { isElevatedAdminRole, verifyDepartmentAuth } from '@/lib/auth-guard';
import { Department, UserRole } from '@/types';
import OxShoesAdminClient from './OxShoesAdminClient';

export default async function OxShoesAdminPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const role = session.user.role;

  if (isElevatedAdminRole(role)) {
    return <OxShoesAdminClient />;
  }

  if (role === UserRole.MANAGER || role === 'manager') {
    const auth = await verifyDepartmentAuth({
      requiredDepartment: Department.INVENTORY,
      requiredPermission: 'products:read',
    });
    if (auth.authorized) {
      return <OxShoesAdminClient />;
    }
  }

  redirect('/admin?error=unauthorized');
}
