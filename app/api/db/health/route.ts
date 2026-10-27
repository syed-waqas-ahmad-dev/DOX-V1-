/**
 * @file app/api/db/health/route.ts
 * @description API endpoint to check MongoDB Atlas connection status and pool statistics.
 * Strict TypeScript: ZERO `any`.
 */

import { NextResponse } from 'next/server';
import { getConnectionState, connectToDatabase } from '@/lib/db/connect';
import mongoose from 'mongoose';

export async function GET() {
  const initialState = getConnectionState();

  let canConnect = false;
  let latencyMs = 0;
  let activeCollections: string[] = [];
  let connectionError: string | null = null;

  if (process.env.MONGODB_URI) {
    const start = Date.now();
    try {
      await connectToDatabase();
      latencyMs = Date.now() - start;
      canConnect = true;
      if (mongoose.connection.db) {
        const collections = await mongoose.connection.db.listCollections().toArray();
        activeCollections = collections.map((c) => c.name);
      }
    } catch (err: unknown) {
      connectionError = err instanceof Error ? err.message : 'Unknown database error';
    }
  }

  const updatedState = getConnectionState();

  return NextResponse.json({
    status: canConnect ? 'connected' : updatedState.status,
    readyState: updatedState.readyState,
    database: updatedState.database,
    host: updatedState.host,
    isConfigured: updatedState.isConfigured,
    latencyMs,
    activeCollections,
    registeredModels: Object.keys(mongoose.models),
    connectionError,
    timestamp: new Date().toISOString(),
  });
}
