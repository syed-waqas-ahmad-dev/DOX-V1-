import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdminsList, type AdminUserItem } from './actions';
import { ManageAdminsClient } from './ManageAdminsClient';

export default async function ManageAdminsPage() {
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email?.toLowerCase();
  const sessionRole = (session?.user as { role?: string } | undefined)?.role;

  // Access control strictly checks super_admin (or primary superadmin email)
  const isSuperAdmin =
    sessionRole === 'super_admin' ||
    sessionEmail === 'ahmadsyedwaqas4@gmail.com';

  if (!isSuperAdmin) {
    redirect('/admin?error=unauthorized');
  }

  // Load admins via Server Action
  const res = await getAdminsList();
  const admins: AdminUserItem[] = res.success && res.data ? res.data : [];

  return (
    <ManageAdminsClient
      initialAdmins={admins}
      isSuperAdmin={isSuperAdmin}
    />
  );
}
