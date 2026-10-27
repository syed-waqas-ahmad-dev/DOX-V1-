import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AdminTopBanner } from '@/components/admin/AdminTopBanner';

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

  if (role !== 'super_admin' && role !== 'admin') {
    redirect('/my-account');
  }

  return (
    <>
      <AdminTopBanner serverSession={session} />
      {children}
    </>
  );
}