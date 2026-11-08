import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { isElevatedAdminRole, verifyDepartmentAuth } from '@/lib/auth-guard';
import { Department, UserRole } from '@/types';
import DeliveryPartnersClient from './DeliveryPartnersClient';

export default async function DeliveryPartnersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const role = session.user.role;

  if (isElevatedAdminRole(role)) {
    return <DeliveryPartnersClient />;
  }

  if (role === UserRole.MANAGER || role === 'manager') {
    const auth = await verifyDepartmentAuth({
      requiredDepartment: Department.DELIVERY,
      requiredPermission: 'delivery:partners',
    });
    if (auth.authorized) {
      return <DeliveryPartnersClient />;
    }
  }

  redirect('/admin?error=unauthorized');
}
