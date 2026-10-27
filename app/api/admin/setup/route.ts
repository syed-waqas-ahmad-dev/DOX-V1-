import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { MockDb } from '@/lib/db/mock-store';

declare global {
  var __oxRealAdmin:
    | {
        name: string;
        email: string;
        password: string;
        phone: string;
        role: string;
        accountStatus: string;
        isVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
      }
    | undefined;
}

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db;

    // Step A: DELETE dummy data
    if (db) {
      await db.collection('users').deleteMany({
        email: { $in: ['dummy_customer@example.com', 'customer@oxshoes.com', 'hamza@test.com'] },
      });
      await db.collection('orders').deleteMany({
        $or: [
          { customerEmail: 'dummy_customer@example.com' },
          { 'shippingAddress.phone': '+923339876543' },
          { 'shippingAddress.fullName': 'Hamza Bilal Qureshi' },
        ],
      });
    }

    // Step B: CREATE REAL ADMIN
    const email = 'ahmadsyedwaqas4@gmail.com';
    const plainPassword = 'M@l@kD@wood123';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const adminData = {
      name: 'Manager Dawood Khan',
      email: email,
      password: hashedPassword,
      phone: '+923265695170',
      role: 'admin',
      accountStatus: 'Verified Admin',
      isVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Upsert: if exists update, else create in MongoDB
    if (db) {
      await db.collection('users').updateOne(
        { email: email },
        { $set: adminData },
        { upsert: true }
      );
    }

    // Store in global memory for resilient sandbox & offline execution
    global.__oxRealAdmin = adminData;

    return NextResponse.json({
      success: true,
      message: 'DONE: Dummy deleted, Real Admin created',
      login: {
        url: '/login',
        email: 'ahmadsyedwaqas4@gmail.com',
        password: 'M@l@kD@wood123',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error during admin setup';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
