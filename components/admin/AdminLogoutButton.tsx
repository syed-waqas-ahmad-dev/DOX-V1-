'use client';

/**
 * @file components/admin/AdminLogoutButton.tsx
 * @description Role-agnostic Admin Sign Out Button.
 * Uses NextAuth signOut with redirect to /login.
 */

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';

interface AdminLogoutButtonProps {
  variant?: 'button' | 'icon' | 'badge';
  className?: string;
}

export function AdminLogoutButton({ variant = 'button', className = '' }: AdminLogoutButtonProps) {
  const handleLogout = () => {
    signOut({ callbackUrl: '/login' });
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleLogout}
        className={`p-2 rounded-lg bg-neutral-800 hover:bg-red-950/50 hover:text-red-400 text-neutral-300 transition-colors border border-neutral-700 cursor-pointer ${className}`}
        title="Sign Out"
        aria-label="Sign Out"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={`text-neutral-300 hover:text-white hover:bg-red-950/60 hover:border-red-500/40 font-bold transition-all flex items-center gap-1.5 bg-neutral-800/90 px-3 py-1.5 rounded-lg border border-neutral-700 cursor-pointer text-xs ${className}`}
      title="Sign out of current session"
      aria-label="Sign out"
    >
      <LogOut className="h-3.5 w-3.5 text-red-400" />
      <span>Logout</span>
    </button>
  );
}
