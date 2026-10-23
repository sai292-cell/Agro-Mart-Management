import mongoose from 'mongoose';
import dns from 'node:dns';
import { env, sanitizeMongoUri } from './env.js';

let isConnecting = false;

// Configure reliable DNS resolvers to prevent Windows Node.js c-ares querySrv ETIMEOUT / ECONNREFUSED
try {
  const currentServers = dns.getServers() || [];
  // Prioritize reliable public DNS (8.8.8.8, 1.1.1.1) to ensure Atlas SRV resolution succeeds on Windows
  dns.setServers([...new Set(['8.8.8.8', '1.1.1.1', ...currentServers])]);
} catch (dnsErr) {
  // If platform restricts setting DNS servers, continue with system defaults
}

// Direct replica set seed fallback if SRV resolution encounters local DNS failures on Windows
const DIRECT_REPLICA_URI = 'mongodb://shivshree_agro_mart:Sai%401122@ac-ghnt80k-shard-00-00.kxglgqb.mongodb.net:27017,ac-ghnt80k-shard-00-01.kxglgqb.mongodb.net:27017,ac-ghnt80k-shard-00-02.kxglgqb.mongodb.net:27017/shivshree_agro_mart?ssl=true&replicaSet=atlas-ufcnc1-shard-0&authSource=admin&retryWrites=true&w=majority';

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

    try {
      await mongoose.connect(env.MONGODB_URI, mongooseOptions);
    } catch (primaryErr) {
      // If SRV lookup fails on Windows (querySrv ECONNREFUSED/ETIMEOUT), fallback to direct replica set nodes
      if (primaryErr.message && (primaryErr.message.includes('querySrv') || primaryErr.message.includes('ENOTFOUND'))) {
        console.warn('⚠️ Windows SRV lookup failed. Retrying via direct replica seed list...');
        await mongoose.connect(DIRECT_REPLICA_URI, mongooseOptions);
      } else {
        throw primaryErr;
      }
    }

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
  if (safeMessage.includes('SSL alert number 80') || safeMessage.includes('tlsv1 alert internal error')) {
    console.error(`🔒 [MongoDB Atlas Firewall]: Connection aborted by Atlas (SSL Alert 80).`);
    console.error(`👉 Action required: Whitelist your IP in MongoDB Atlas (Security -> Network Access -> Add 0.0.0.0/0).`);
    return;
  }
  console.error(`⚠️ MongoDB runtime error: ${safeMessage}`);
});
