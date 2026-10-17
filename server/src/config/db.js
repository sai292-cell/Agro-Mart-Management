import mongoose from 'mongoose';
import dns from 'node:dns';
import { env, sanitizeMongoUri } from './env.js';

let isConnecting = false;

// Configure reliable DNS resolvers to prevent Windows Node.js c-ares querySrv ETIMEOUT
try {
  const currentServers = dns.getServers();
  // If current DNS is a local subnet IP or empty, augment with Google/Cloudflare DNS for Atlas SRV resolution
  dns.setServers([...new Set([...currentServers, '8.8.8.8', '1.1.1.1'])]);
} catch (dnsErr) {
  // If platform restricts setting DNS servers, continue with system defaults
}

/**
 * Maps Mongoose readyState number to human-readable status string
 */
export function getDbConnectionState() {
  switch (mongoose.connection.readyState) {
    case 0:
      return 'disconnected';
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    default:
      return 'unknown';
  }
}

/**
 * Returns whether the database is actively connected and usable
 * @returns {boolean}
 */
export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * Returns safe database metadata for health and readiness reporting
 * Never exposes credentials or full URIs
 */
export function getDbHealthInfo() {
  const readyState = mongoose.connection.readyState;
  const isConnected = readyState === 1;

  return {
    connected: isConnected,
    status: getDbConnectionState(),
    host: isConnected ? mongoose.connection.host : undefined,
    databaseName: isConnected ? mongoose.connection.name : undefined,
  };
}

/**
 * Connects to MongoDB Atlas via Mongoose with resilient options
 * @returns {Promise<typeof mongoose>}
 */
export async function connectToDatabase() {
  // If already connected, return existing connection to avoid duplicate pools
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  // If in the process of connecting, wait for completion
  if (isConnecting) {
    return new Promise((resolve, reject) => {
      mongoose.connection.once('connected', () => resolve(mongoose));
      mongoose.connection.once('error', (err) => reject(err));
    });
  }

  const sanitizedUri = sanitizeMongoUri(env.MONGODB_URI);

  const mongooseOptions = {
    dbName: 'shivshree_agro_mart',   // Connect to the intended Shivshree Agro Mart database
    serverSelectionTimeoutMS: 15000, // Timeout after 15s to accommodate cloud Atlas latency
    socketTimeoutMS: 45000,
    maxPoolSize: 10,                 // Ideal pool size for MongoDB Atlas M0 Free Tier
    minPoolSize: 1,
    autoIndex: env.NODE_ENV !== 'production', // Build indexes in development/test
  };

  try {
    isConnecting = true;
    console.log(`🔌 Initializing database connection to: ${sanitizedUri}`);

    await mongoose.connect(env.MONGODB_URI, mongooseOptions);
    isConnecting = false;

    console.log(`✅ MongoDB Atlas connected successfully [Database: ${mongoose.connection.name} on host ${mongoose.connection.host}]`);
    return mongoose;
  } catch (err) {
    isConnecting = false;
    // Sanitize any error message to ensure no credentials leak into logs
    const safeErrorMessage = err.message ? err.message.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@.+)/gi, '$1*****$3') : 'Unknown DB error';
    console.error(`❌ MongoDB connection failed: ${safeErrorMessage}`);

    throw new Error(safeErrorMessage);
  }
}

/**
 * Gracefully disconnects from MongoDB
 */
export async function closeDbConnection() {
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB safely.');
    } catch (err) {
      console.error('⚠️ Error during database disconnect:', err.message);
    }
  }
}

// Global connection event handlers for continuous monitoring
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB connection lost. Disconnected.');
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄 MongoDB reconnected successfully.');
});

mongoose.connection.on('error', (err) => {
  const safeMessage = err.message ? err.message.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@.+)/gi, '$1*****$3') : 'DB runtime error';
  console.error(`⚠️ MongoDB runtime error: ${safeMessage}`);
});
