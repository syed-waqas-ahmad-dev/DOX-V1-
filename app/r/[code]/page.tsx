/**
 * @file app/r/[code]/page.tsx
 * @description Viral referral link landing route for OX Shoes Pakistan.
 * Sets 30-day attribution cookie 'ref_code' and routes friend to signup with 10% welcome bonus.
 * Strict TypeScript: ZERO `any`.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { trackReferralClick } from '@/actions/referral.actions';

interface ReferralRedirectProps {
  params: Promise<{ code: string }>;
}

export default async function ReferralRedirectPage({ params }: ReferralRedirectProps) {
  const resolvedParams = await params;
  const rawCode = resolvedParams.code || '';
  const cleanCode = decodeURIComponent(rawCode).trim().toUpperCase();

  if (cleanCode) {
    try {
      const cookieStore = await cookies();
      cookieStore.set('ref_code', cleanCode, {
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
        sameSite: 'lax',
      });

      await trackReferralClick(cleanCode);
    } catch (err) {
      console.error('Error recording referral cookie:', err);
    }
  }

  // Redirect to signup page with the referral code pre-attached
  redirect(`/signup?ref=${encodeURIComponent(cleanCode)}`);
}
