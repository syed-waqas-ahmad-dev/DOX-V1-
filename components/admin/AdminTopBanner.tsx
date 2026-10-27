'use client';

/**
 * @file components/admin/AdminTopBanner.tsx
 * @description Admin session bar for AdminLayout.
 * Reads session directly from serverSession props.
 */

import { AdminLogoutButton } from '@/components/admin/AdminLogoutButton';
import { User } from 'lucide-react';

interface AdminTopBannerProps {
  serverSession?: {
    user?: {
      name?: string | null;
      email?: string | null;
      role?: string | null;
    };
  } | null;
}

export function AdminTopBanner({ serverSession }: AdminTopBannerProps) {
  const activeUser = {
    name: serverSession?.user?.name || 'Admin',
    email: serverSession?.user?.email || '',
    role: serverSession?.user?.role || 'admin',
  };

  return (
    <div className="bg-neutral-900 border-b border-neutral-800 text-xs px-4 sm:px-6 py-2 flex items-center justify-between text-neutral-300 relative z-40">
      <div className="flex items-center gap-2.5">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <div className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-neutral-400" />
          <span className="font-semibold text-white truncate max-w-[180px] sm:max-w-none">
            {activeUser.name}
          </span>
          <span className="text-neutral-500 text-[11px] hidden md:inline">
            ({activeUser.email})
          </span>
        </div>
        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider">
          {activeUser.role}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <AdminLogoutButton />
      </div>
    </div>
  );
}
