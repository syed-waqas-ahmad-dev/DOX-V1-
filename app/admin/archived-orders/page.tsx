import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { isElevatedAdminRole, verifyDepartmentAuth } from '@/lib/auth-guard';
import { Department, UserRole } from '@/types';
import ArchivedOrdersClient from './ArchivedOrdersClient';

export default async function ArchivedOrdersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const role = session.user.role;

  if (isElevatedAdminRole(role)) {
    return <ArchivedOrdersClient />;
  }

  if (role === UserRole.MANAGER || role === 'manager') {
    const auth = await verifyDepartmentAuth({
      requiredDepartment: Department.ORDERS,
      requiredPermission: 'orders:read',
    });
    if (auth.authorized) {
      return <ArchivedOrdersClient />;
    }
  }

  redirect('/admin?error=unauthorized');
}
