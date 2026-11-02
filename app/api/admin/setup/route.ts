import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { User } from '@/models/User';
import { UserRole } from '@/types';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const requiredAccessKey = process.env.ADMIN_ACCESS_KEY?.trim();
    if (!requiredAccessKey) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error: ADMIN_ACCESS_KEY is not configured.' },
        { status: 500 }
      );
    }

    // Authenticate setup request via header or body key
    const headerKey = req.headers.get('x-admin-access-key')?.trim();
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // Body may be empty if configuring purely via environment variables
    }

    const providedKey = headerKey || (typeof body.setupKey === 'string' ? body.setupKey.trim() : '');

    if (!providedKey || providedKey !== requiredAccessKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid setup access key provided.' },
        { status: 401 }
      );
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      return NextResponse.json(
        { success: false, error: 'Database service is currently unavailable.' },
        { status: 503 }
      );
    }

    // Ensure schema indexes (including unique super_admin index) are initialized safely.
    // If initialization fails, halt setup to prevent proceeding without uniqueness guarantees.
    try {
      await User.init();
    } catch (indexError: unknown) {
      const errorMsg = indexError instanceof Error ? indexError.message : 'Unknown index initialization error';
      console.error('[SETUP ERROR] User model index initialization failed:', errorMsg);
      return NextResponse.json(
        {
          success: false,
          error: `Database index initialization failed: ${errorMsg}. Setup halted to prevent unconstrained account provisioning.`,
        },
        { status: 500 }
      );
    }

    // Idempotency check: Ensure only one active Super Admin can ever be provisioned
    const existingSuperAdmin = await User.findOne({ role: UserRole.SUPER_ADMIN, isDeleted: { $ne: true } });
    if (existingSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Super Admin is already provisioned. Subsequent setup attempts are rejected for security.',
        },
        { status: 409 }
      );
    }

    // Read credentials from validated environment variables or validated payload
    const emailCandidate = (
      (typeof body.email === 'string' ? body.email : '') ||
      process.env.SUPER_ADMIN_EMAIL ||
      ''
    ).toLowerCase().trim();

    const passwordCandidate = (
      (typeof body.password === 'string' ? body.password : '') ||
      process.env.SUPER_ADMIN_PASSWORD ||
      ''
    ).trim();

    const nameCandidate = (
      (typeof body.name === 'string' ? body.name : '') ||
      process.env.SUPER_ADMIN_NAME ||
      'Primary Super Administrator'
    ).trim();

    if (!emailCandidate || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCandidate)) {
      return NextResponse.json(
        { success: false, error: 'A valid email address is required for Super Admin provisioning.' },
        { status: 400 }
      );
    }

    if (!passwordCandidate || passwordCandidate.length < 10) {
      return NextResponse.json(
        { success: false, error: 'A strong password with at least 10 characters is required for Super Admin provisioning.' },
        { status: 400 }
      );
    }

    // Check if a user with this email already exists
    const existingUser = await User.findOne({ email: emailCandidate });
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(passwordCandidate, salt);

    if (existingUser) {
      existingUser.role = UserRole.SUPER_ADMIN;
      existingUser.password = hashedPassword;
      existingUser.isEmailVerified = true;
      existingUser.isPhoneVerified = true;
      existingUser.isDeleted = false;
      await existingUser.save();
    } else {
      await User.create({
        name: nameCandidate,
        email: emailCandidate,
        password: hashedPassword,
        role: UserRole.SUPER_ADMIN,
        isEmailVerified: true,
        isPhoneVerified: true,
        isDeleted: false,
        referralCode: 'OX-SUPERADMIN',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Super Administrator successfully provisioned.',
    });
  } catch (error: unknown) {
    // Handle concurrent duplicate key violations at database level (unique index on role: super_admin or email)
    if (
      error &&
      typeof error === 'object' &&
      ('code' in error || 'codeName' in error) &&
      ((error as { code?: number }).code === 11000 || (error as { codeName?: string }).codeName === 'DuplicateKey')
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Super Admin is already provisioned or email already exists in system.',
        },
        { status: 409 }
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error during Super Admin provisioning.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed. Super Admin provisioning must be performed via POST with authorization.' },
    { status: 405 }
  );
}
