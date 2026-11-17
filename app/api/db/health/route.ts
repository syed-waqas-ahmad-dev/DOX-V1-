/**
 * @file app/api/db/health/route.ts
 * @description API endpoint to check MongoDB Atlas connection status and pool statistics.
 * Strict TypeScript: ZERO `any`.
 */

import { NextResponse } from 'next/server';
import {
  getConnectionState,
  connectToDatabase,
  isDatabaseConfigured,
  sanitizeMongoLogMessage,
} from '@/lib/db/connect';
import mongoose from 'mongoose';

export async function GET() {
  let canConnect = false;
  let latencyMs = 0;
  let activeCollections: string[] = [];
  let connectionError: string | null = null;

  if (isDatabaseConfigured()) {
    const start = Date.now();
    try {
      const conn = await connectToDatabase();
      latencyMs = Date.now() - start;
      canConnect = Boolean(conn && mongoose.connection.readyState === 1);
      if (canConnect && mongoose.connection.db) {
        const collections = await mongoose.connection.db.listCollections().toArray();
        activeCollections = collections.map((c) => c.name);
      } else if (!canConnect) {
        connectionError = 'Database connection unavailable';
      }
    } catch (err: unknown) {
      connectionError =
        err instanceof Error ? sanitizeMongoLogMessage(err.message) : 'Database connection unavailable';
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
