/**
 * @file app/api/admin/env/route.ts
 * @description Secure administrative API route to inspect and configure the 12 Free Stack environment variables.
 * Strictly enforced RBAC: Super Administrator session required.
 * Sensitive secrets are masked to prevent accidental client-side disclosure.
 * Filesystem modifications to .env.local are strictly disabled in production environments.
 * Strict TypeScript: ZERO `any`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserRole } from '@/types';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const FINAL_12_KEYS = [
  'MONGODB_URI',
  'MONGODB_DB_NAME',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'NEXT_PUBLIC_APP_URL',
  'ADMIN_ACCESS_KEY',
  'CRON_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
] as const;

type FinalKey = (typeof FINAL_12_KEYS)[number];

const NON_SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  'NEXT_PUBLIC_APP_URL',
  'MONGODB_DB_NAME',
  'CLOUDINARY_CLOUD_NAME',
]);

function maskSecret(val: string): string {
  if (!val) return '';
  if (val.length <= 8) return '••••••••';
  return `${val.slice(0, 3)}••••••••${val.slice(-3)}`;
}

function readCurrentLocalEnv(): Record<string, string> {
  const current: Record<string, string> = {};
  for (const key of FINAL_12_KEYS) {
    current[key] = process.env[key] || '';
  }

  const envLocalPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    try {
      const content = fs.readFileSync(envLocalPath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const k = trimmed.substring(0, eqIdx).trim();
          let v = trimmed.substring(eqIdx + 1).trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          if (FINAL_12_KEYS.includes(k as FinalKey)) {
            current[k] = v;
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }
  return current;
}

export async function GET() {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }
    const sessionRole = (session?.user as { role?: string } | undefined)?.role;

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required.' },
        { status: 401 }
      );
    }

    if (sessionRole !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Administrator privilege required.' },
        { status: 403 }
      );
    }

    const currentEnv = readCurrentLocalEnv();
    const safeData: Record<string, string> = {};

    for (const key of FINAL_12_KEYS) {
      const rawVal = currentEnv[key] || '';
      if (NON_SENSITIVE_KEYS.has(key)) {
        safeData[key] = rawVal;
      } else {
        safeData[key] = maskSecret(rawVal);
      }
    }

    return NextResponse.json({
      success: true,
      data: safeData,
      totalCount: FINAL_12_KEYS.length,
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to retrieve environment configuration';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }
    const sessionRole = (session?.user as { role?: string } | undefined)?.role;

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required.' },
        { status: 401 }
      );
    }

    if (sessionRole !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Administrator privilege required.' },
        { status: 403 }
      );
    }

    // Strictly disable filesystem overwrites in production
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          success: false,
          error: 'Local filesystem environment updates are disabled in production. Use your hosting deployment provider settings.',
        },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, string>;
    const currentEnv = readCurrentLocalEnv();
    const envLocalPath = path.join(process.cwd(), '.env.local');

    const lines: string[] = [
      '# ==============================================================================',
      '# OX Shoes Pakistan - Local Environment Configuration (12 Keys)',
      '# ==============================================================================',
      '',
    ];

    for (const key of FINAL_12_KEYS) {
      const incoming = body[key];
      // If client sent empty string, masked placeholder, or undefined, preserve existing secret
      let resolvedValue = currentEnv[key] || '';
      if (typeof incoming === 'string' && incoming.trim() !== '' && !incoming.includes('••••')) {
        // Sanitize newlines to prevent configuration file injection
        resolvedValue = incoming.replace(/[\r\n]+/g, '').trim();
      }
      lines.push(`${key}="${resolvedValue}"`);
    }

    lines.push('');
    fs.writeFileSync(envLocalPath, lines.join('\n'), 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'Environment configuration saved securely to .env.local.',
      totalKeys: FINAL_12_KEYS.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update environment configuration';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
