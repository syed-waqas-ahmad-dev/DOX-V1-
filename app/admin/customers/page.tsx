import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { isElevatedAdminRole } from '@/lib/auth-guard';
import AdminCustomersClient from './AdminCustomersClient';

export default async function AdminCustomersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  if (!isElevatedAdminRole(session.user.role)) {
    redirect('/admin?error=unauthorized');
  }

  return <AdminCustomersClient />;
}
