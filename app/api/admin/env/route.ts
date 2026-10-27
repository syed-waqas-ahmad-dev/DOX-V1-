/**
 * @file app/api/admin/env/route.ts
 * @description API route to read and update ONLY the 12 Free Stack environment variables for OX Shoes.
 * Strict TypeScript: ZERO `any`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

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

export async function GET() {
  try {
    const envData: Record<string, string> = {};

    // First populate from process.env
    for (const key of FINAL_12_KEYS) {
      envData[key] = process.env[key] || '';
    }

    // Try reading .env.local if present
    const envLocalPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envLocalPath)) {
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
          if (FINAL_12_KEYS.includes(k as (typeof FINAL_12_KEYS)[number])) {
            envData[k] = v;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: envData,
      totalCount: FINAL_12_KEYS.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to read env configuration';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, string>;
    const envLocalPath = path.join(process.cwd(), '.env.local');

    const lines: string[] = [
      '# ==============================================================================',
      '# OX Shoes Pakistan - Local Environment Configuration (12 Keys)',
      '# ==============================================================================',
      '',
    ];

    for (const key of FINAL_12_KEYS) {
      const val = body[key] !== undefined ? body[key] : process.env[key] || '';
      lines.push(`${key}="${val}"`);
    }

    lines.push('');
    fs.writeFileSync(envLocalPath, lines.join('\n'), 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'Environment configuration saved successfully to .env.local.',
      totalKeys: FINAL_12_KEYS.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update env configuration';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
