'use client';

import { SessionProvider } from 'next-auth/react';
import React from 'react';
import { CartDrawer } from '@/components/layout/CartDrawer';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <CartDrawer />
    </SessionProvider>
  );
}


