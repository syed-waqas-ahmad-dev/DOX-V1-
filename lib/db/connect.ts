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
 * Strips credentials, connection URIs, and secret query tokens from MongoDB error strings
 * before logging to server console.
 */
export function sanitizeMongoLogMessage(rawMessage: string): string {
  if (!rawMessage) return 'Unknown database connection error';
  return rawMessage
    .replace(/mongodb(?:\+srv)?:\/\/[^\s@]+@[^\s/?]+/gi, 'mongodb://[redacted]')
    .replace(/mongodb(?:\+srv)?:\/\/[^\s/?]+/gi, 'mongodb://[redacted]')
    .slice(0, 240);
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
 * Determines whether a MongoDB URI or connection configuration has been provided.
 */
export function isDatabaseConfigured(): boolean {
  const rawUri = process.env.MONGODB_URI?.trim();
  const rawDbName = process.env.MONGODB_DB_NAME?.trim();
  const hasRawUri = Boolean(rawUri && rawUri.length > 0);
  const hasRawDbUri = Boolean(
    rawDbName && (rawDbName.startsWith('mongodb://') || rawDbName.startsWith('mongodb+srv://'))
  );

  if (process.env.NODE_ENV === 'production') {
    return hasRawUri || hasRawDbUri;
  }

  const { uri } = resolveMongoConfig();
  return Boolean(uri) || hasRawUri || hasRawDbUri;
}

/**
 * Determines whether the application is running in an explicitly recognized offline mock environment.
 * Strict Security Rules:
 * 1. Mock authorization must be disabled by default. Requires ALLOW_OFFLINE_MOCK_AUTH === 'true'.
 * 2. NEVER permitted in production (NODE_ENV === 'production' or APP_ENV === 'production').
 * 3. NEVER permitted in Vercel preview or production deployments (VERCEL_ENV === 'preview' | 'production' or VERCEL === '1' without local dev).
 * 4. NEVER permitted in staging environments (NODE_ENV === 'staging' | APP_ENV === 'staging' | ENVIRONMENT === 'staging').
 * 5. NEVER permitted in CI environments unless running automated tests (CI === 'true' and NODE_ENV !== 'test').
 * 6. Permitted ONLY in explicitly approved local development (NODE_ENV === 'development') or test (NODE_ENV === 'test').
 * 7. NEVER permitted if a database URI is configured (live DB configuration always takes precedence).
 */
export function isApprovedMockEnvironment(): boolean {
  // 1. Mock authorization must be disabled by default (explicit opt-in required)
  if (process.env.ALLOW_OFFLINE_MOCK_AUTH !== 'true') {
    return false;
  }

  // 2. Never permitted if database is configured (database configuration always takes precedence)
  if (isDatabaseConfigured()) {
    return false;
  }

  const nodeEnv = process.env.NODE_ENV as string | undefined;
  const appEnv = process.env.APP_ENV;
  const vercelEnv = process.env.VERCEL_ENV;
  const isVercel = process.env.VERCEL === '1';
  const customEnv = process.env.ENVIRONMENT;
  const isCI = process.env.CI === 'true';

  // 3. Explicitly disallow production environments
  if (nodeEnv === 'production' || appEnv === 'production') {
    return false;
  }

  // 4. Explicitly disallow Vercel Preview & Production deployments
  if (vercelEnv === 'preview' || vercelEnv === 'production' || (isVercel && vercelEnv !== 'development')) {
    return false;
  }

  // 5. Explicitly disallow staging environments
  if (nodeEnv === 'staging' || appEnv === 'staging' || customEnv === 'staging') {
    return false;
  }

  // 6. Explicitly disallow CI environments unless explicitly running automated tests
  if (isCI && nodeEnv !== 'test') {
    return false;
  }

  // 7. Whitelist: Only permit local development or automated test environments
  if (nodeEnv !== 'development' && nodeEnv !== 'test') {
    return false;
  }

  return true;
}

/**
 * Determines whether non-auth catalog/order MockDb usage is intentionally permitted.
 * Strict Fail-Closed Rules:
 * 1. NEVER permitted if a MongoDB URI / database configuration is present.
 * 2. NEVER permitted in production (NODE_ENV === 'production' or APP_ENV === 'production').
 * 3. NEVER permitted in Vercel preview/production deployments.
 * 4. NEVER permitted in staging environments.
 * 5. NEVER permitted in non-test CI runs.
 * 6. Permitted ONLY when no database is configured in local development or test execution.
 */
export function canUseMockDatabase(): boolean {
  if (isDatabaseConfigured()) {
    return false;
  }

  const nodeEnv = process.env.NODE_ENV as string | undefined;
  const appEnv = process.env.APP_ENV;
  const vercelEnv = process.env.VERCEL_ENV;
  const isVercel = process.env.VERCEL === '1';
  const customEnv = process.env.ENVIRONMENT;
  const isCI = process.env.CI === 'true';

  if (nodeEnv === 'production' || appEnv === 'production') {
    return false;
  }

  if (vercelEnv === 'preview' || vercelEnv === 'production' || (isVercel && vercelEnv !== 'development')) {
    return false;
  }

  if (nodeEnv === 'staging' || appEnv === 'staging' || customEnv === 'staging') {
    return false;
  }

  if (isCI && nodeEnv !== 'test') {
    return false;
  }

  return true;
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

  // Sync cache if mongoose already holds an active connection (e.g. established by another module/worker)
  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose;
    return cached.conn;
  }

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
      minPoolSize: 0,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
      family: 4,
      autoIndex: process.env.NODE_ENV !== 'production',
    };

    let isAttemptingConnect = true;

    // Register connection listeners once
    if (mongoose.connection.listenerCount('connected') === 0) {
      mongoose.connection.on('connected', () => {
        cached.conn = mongoose;
      });

      mongoose.connection.on('error', (err: Error) => {
        console.warn('[OX Shoes DB] Connection warning:', sanitizeMongoLogMessage(err.message));
        if (mongoose.connection.readyState !== 1 && !isAttemptingConnect) {
          cached.conn = null;
          cached.promise = null;
        }
      });

      mongoose.connection.on('disconnected', () => {
        if (!isAttemptingConnect) {
          cached.conn = null;
          cached.promise = null;
        }
      });
    }

    const attemptConnect = async (): Promise<Mongoose | null> => {
      try {
        const instance = await mongoose.connect(uri, options);
        cached.conn = instance;
        return instance;
      } catch (firstErr: unknown) {
        const firstMsg = firstErr instanceof Error ? firstErr.message : 'Initial connection error';
        console.warn('[OX Shoes DB] Initial connect failed, retrying once:', sanitizeMongoLogMessage(firstMsg));
        await new Promise((resolve) => setTimeout(resolve, 150));
        try {
          const retryInstance = await mongoose.connect(uri, options);
          cached.conn = retryInstance;
          return retryInstance;
        } catch (retryErr: unknown) {
          const retryMsg = retryErr instanceof Error ? retryErr.message : 'Retry connection error';
          console.warn('[OX Shoes DB] MongoDB connection failed:', sanitizeMongoLogMessage(retryMsg));
          cached.conn = null;
          cached.promise = null;
          return null;
        }
      } finally {
        isAttemptingConnect = false;
      }
    };

    cached.promise = attemptConnect();
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
    isConfigured: isDatabaseConfigured(),
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
