import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { isElevatedAdminRole, verifyDepartmentAuth } from '@/lib/auth-guard';
import { Department, UserRole } from '@/types';
import AdminOrderDetailClient from './AdminOrderDetailClient';

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const role = session.user.role;

  if (isElevatedAdminRole(role)) {
    return <AdminOrderDetailClient params={params} />;
  }

  if (role === UserRole.MANAGER || role === 'manager') {
    // Orders manager with orders:read
    const ordersAuth = await verifyDepartmentAuth({
      requiredDepartment: Department.ORDERS,
      requiredPermission: 'orders:read',
    });
    if (ordersAuth.authorized) {
      return <AdminOrderDetailClient params={params} />;
    }

    // Delivery manager with delivery:view can also view order for dispatch
    const deliveryAuth = await verifyDepartmentAuth({
      requiredDepartment: Department.DELIVERY,
      requiredPermission: 'delivery:view',
    });
    if (deliveryAuth.authorized) {
      return <AdminOrderDetailClient params={params} />;
    }
  }

  redirect('/admin?error=unauthorized');
}
