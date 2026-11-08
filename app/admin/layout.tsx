import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AdminTopBanner } from '@/components/admin/AdminTopBanner';
import { isElevatedAdminRole, verifyDepartmentAuth } from '@/lib/auth-guard';
import { UserRole } from '@/types';

export const metadata: Metadata = {
  title: 'Admin Console',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const role = session.user.role;

  // 1. Elevated admin roles (super_admin, admin) retain broad access
  if (isElevatedAdminRole(role)) {
    return (
      <>
        <AdminTopBanner serverSession={session} />
        {children}
      </>
    );
  }

  // 2. MANAGER must be authoritatively verified against live server-side database state
  if (role === UserRole.MANAGER || role === 'manager') {
    const authResult = await verifyDepartmentAuth();
    if (
      !authResult.authorized ||
      authResult.role !== UserRole.MANAGER ||
      !authResult.department
    ) {
      redirect('/my-account');
    }

    return (
      <>
        <AdminTopBanner serverSession={session} />
        {children}
      </>
    );
  }

  // 3. Any other role (customer, rider, etc.) fails closed
  redirect('/my-account');
}