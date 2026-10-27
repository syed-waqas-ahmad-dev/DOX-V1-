/**
 * @file lib/db/connect.ts
 * @description Enterprise singleton MongoDB connection manager for OX Shoes.
 * Utilizes NodeJS global caching to prevent duplicate connections during Next.js hot-reloads.
 * Strict TypeScript: ZERO `any`.
 */

import mongoose, { type Mongoose } from 'mongoose';

/**
 * Interface representing the cached connection structure in NodeJS global scope
 */
interface MongooseConnectionCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose | null> | null;
}

// Extend NodeJS Global interface to store the mongoose connection safely
declare global {
  var mongooseConnectionCache: MongooseConnectionCache | undefined;
}

// Initialize cached object from global or default empty cache
const cached: MongooseConnectionCache = global.mongooseConnectionCache ?? {
  conn: null,
  promise: null,
};

if (!global.mongooseConnectionCache) {
  global.mongooseConnectionCache = cached;
}

/**
 * Resolves the appropriate MongoDB URI and database name, handling swapped or placeholder environment variables.
 */
function resolveMongoConfig(): { uri: string | null; dbName?: string } {
  let uri = process.env.MONGODB_URI?.trim();
  let dbName = process.env.MONGODB_DB_NAME?.trim();

  // If MONGODB_DB_NAME contains a full mongodb URI (e.g. accidentally pasted into DB_NAME field)
  if (dbName && (dbName.startsWith('mongodb://') || dbName.startsWith('mongodb+srv://'))) {
    if (!uri || uri.includes('cluster0.abcde.mongodb.net') || uri.includes('example.com')) {
      uri = dbName;
      dbName = undefined;
    }
  }

  // If URI is missing or contains unconfigured dummy placeholder, fallback to instant mock store
  if (!uri || uri.includes('cluster0.abcde.mongodb.net') || uri.includes('example.com')) {
    return { uri: null, dbName: 'shoes_app_db' };
  }

  // Extract database name from connection string if not specified or clean up
  if (dbName && (dbName.startsWith('mongodb://') || dbName.startsWith('mongodb+srv://'))) {
    dbName = undefined;
  }

  return { uri, dbName: dbName || 'shoes_app_db' };
}

/**
 * Checks if the singleton connection is currently in an active and ready state.
 */
export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Establishes or retrieves the cached singleton MongoDB connection.
 * Configured with enterprise connection pooling, fail-fast buffering, and graceful offline fallback.
 *
 * @returns Promise resolving to active Mongoose instance or null if offline/mock mode
 */
export async function connectToDatabase(): Promise<Mongoose | null> {
  // Fail fast, don't hang requests if disconnected
  mongoose.set('bufferCommands', false);
  mongoose.set('strictQuery', true);

  // Return active connection if already established and ready
  if (cached.conn && cached.conn.connection.readyState === 1) {
    return cached.conn;
  }

  const { uri, dbName } = resolveMongoConfig();

  // If no valid MongoDB URI is available or it is a placeholder, operate in graceful mock mode
  if (!uri) {
    return null;
  }

  // If a connection attempt is in-flight, await the same promise
  if (!cached.promise) {
    const options: mongoose.ConnectOptions = {
      ...(dbName ? { dbName } : {}),
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 2000, // Fail fast in 2 seconds
      family: 4,
      autoIndex: process.env.NODE_ENV !== 'production',
    };

    // Register connection listeners once
    if (mongoose.connection.listenerCount('connected') === 0) {
      mongoose.connection.on('connected', () => {
        // Connection established successfully
      });

      mongoose.connection.on('error', (err: Error) => {
        // Log cleanly without uncaught exception
        console.warn('[OX Shoes DB] Connection warning:', err.message);
      });

      mongoose.connection.on('disconnected', () => {
        cached.conn = null;
        cached.promise = null;
      });
    }

    cached.promise = mongoose
      .connect(uri, options)
      .then((mongooseInstance) => {
        cached.conn = mongooseInstance;
        return mongooseInstance;
      })
      .catch((err: Error) => {
        console.warn('[OX Shoes DB] MongoDB not connected — falling back to mock store:', err.message);
        cached.conn = null;
        cached.promise = null;
        return null;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch {
    cached.promise = null;
    cached.conn = null;
    return null;
  }

  return cached.conn;
}

/**
 * Returns human-readable connection status and pool statistics.
 */
export function getConnectionState(): {
  status: 'disconnected' | 'connected' | 'connecting' | 'disconnecting' | 'uninitialized';
  readyState: number;
  host: string | null;
  database: string | null;
  isConfigured: boolean;
} {
  const readyState = mongoose.connection.readyState;
  const statusMap: Record<number, 'disconnected' | 'connected' | 'connecting' | 'disconnecting'> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const status = statusMap[readyState] ?? 'uninitialized';
  const { uri, dbName } = resolveMongoConfig();

  return {
    status,
    readyState,
    host: mongoose.connection.host || null,
    database: mongoose.connection.name || dbName || null,
    isConfigured: Boolean(uri),
  };
}

/**
 * Gracefully closes the database connection (useful for unit tests & serverless teardown).
 */
export async function disconnectFromDatabase(): Promise<void> {
  if (cached.conn) {
    await mongoose.disconnect();
    cached.conn = null;
    cached.promise = null;
  }
}
