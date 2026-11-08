import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { isElevatedAdminRole, verifyDepartmentAuth } from '@/lib/auth-guard';
import { User } from '@/models/User';
import { connectToDatabase } from '@/lib/db/connect';
import { UserRole, Department } from '@/types';
import AdminDashboardClient from './AdminDashboardClient';

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const role = session.user.role as UserRole;

  if (isElevatedAdminRole(role)) {
    return (
      <AdminDashboardClient
        userRole={role}
        userDepartment={null}
        userPermissions={[]}
      />
    );
  }

  if (role === UserRole.MANAGER || (role as string) === 'manager') {
    const auth = await verifyDepartmentAuth();
    if (!auth.authorized || !auth.department || !auth.userId) {
      redirect('/my-account');
    }

    await connectToDatabase();
    const userDoc = await User.findById(auth.userId).select('permissions').lean();
    const permissions = Array.isArray(userDoc?.permissions) ? (userDoc.permissions as string[]) : [];

    return (
      <AdminDashboardClient
        userRole={UserRole.MANAGER}
        userDepartment={auth.department}
        userPermissions={permissions}
      />
    );
  }

  redirect('/my-account');
}
