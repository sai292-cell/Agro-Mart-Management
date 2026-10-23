import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file if available
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  BODY_LIMIT: z.string().default('1mb'),
  API_PREFIX: z.string().default('/api/v1'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI must be provided in server environment').default('mongodb://localhost:27017/shivshree_agro_mart'),

  // JWT configuration
  JWT_ACCESS_SECRET: z.string().min(16).default('shivshree_agro_mart_default_jwt_access_secret_key_32_chars!'),
  JWT_REFRESH_SECRET: z.string().min(16).default('shivshree_agro_mart_default_jwt_refresh_secret_key_32_chars!'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Rate limiting for auth routes (15 minutes window, 10 attempts by default)
  AUTH_RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform((val) => parseInt(val, 10)),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.string().default('10').transform((val) => parseInt(val, 10)),

  // Development-only testing helpers (Strictly forbidden in production)
  DEV_ALLOW_TEST_OTP: z.string().default('true').transform((val) => val === 'true'),

  // SMS Gateway Configuration (Fast2SMS, Twilio, or Mock console)
  SMS_PROVIDER: z.enum(['mock', 'fast2sms', 'twilio']).default('mock'),
  FAST2SMS_API_KEY: z.string().optional().default(''),
  TWILIO_ACCOUNT_SID: z.string().optional().default(''),
  TWILIO_AUTH_TOKEN: z.string().optional().default(''),
  TWILIO_FROM_PHONE: z.string().optional().default(''),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid server environment configuration:');
  console.error(parsedEnv.error.format());
  process.exit(1);
}

// In production, enforce that dev test OTP is strictly disabled
if (parsedEnv.data.NODE_ENV === 'production' && parsedEnv.data.DEV_ALLOW_TEST_OTP) {
  console.error('❌ FATAL: DEV_ALLOW_TEST_OTP cannot be enabled in production environment!');
  process.exit(1);
}

// In production, enforce that default JWT secrets are replaced with secure unique secrets
if (parsedEnv.data.NODE_ENV === 'production') {
  const defaultAccess = 'shivshree_agro_mart_default_jwt_access_secret_key_32_chars!';
  const defaultRefresh = 'shivshree_agro_mart_default_jwt_refresh_secret_key_32_chars!';
  if (parsedEnv.data.JWT_ACCESS_SECRET === defaultAccess || parsedEnv.data.JWT_REFRESH_SECRET === defaultRefresh) {
    console.error('❌ FATAL: Default JWT secrets cannot be used in production environment. Configure unique JWT_ACCESS_SECRET and JWT_REFRESH_SECRET in your production environment.');
    process.exit(1);
  }
}

export const env = parsedEnv.data;

/**
 * Sanitizes a MongoDB connection URI to mask credentials for safe logging
 * @param {string} uri
 * @returns {string} Sanitized URI
 */
export function sanitizeMongoUri(uri) {
  if (!uri || typeof uri !== 'string') return '[empty]';
  return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@.+)/i, '$1*****$3');
}
