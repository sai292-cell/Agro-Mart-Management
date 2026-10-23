import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

const JWT_ISSUER = 'shivshree-agro-mart';
const JWT_AUDIENCE = 'shivshree-agro-mart-client';
const SALT_ROUNDS = 12;

/**
 * Hash plaintext password using bcrypt with 12 salt rounds
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare password with stored bcrypt hash
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function comparePassword(password, hash) {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

/**
 * Hash raw refresh token for safe storage in DB
 * @param {string} token
 * @returns {string} SHA-256 hash
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Sign short-lived JWT Access Token
 * @param {Object} user - User document or payload
 * @returns {string} Signed JWT
 */
export function signAccessToken(user) {
  const payload = {
    sub: user._id ? user._id.toString() : user.id,
    shopId: user.shopId ? user.shopId.toString() : user.shopId,
    role: user.role,
    name: user.name,
    ...(user.farmerId && { farmerId: user.farmerId }),
    ...(user.customerId && { customerId: user.customerId.toString() }),
  };

  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithm: 'HS256',
  });
}

/**
 * Sign longer-lived JWT Refresh Token
 * @param {Object} user
 * @param {string} jti - Unique token identifier
 * @returns {string} Signed JWT
 */
export function signRefreshToken(user, jti) {
  const payload = {
    sub: user._id ? user._id.toString() : user.id,
    shopId: user.shopId ? user.shopId.toString() : user.shopId,
    jti: jti || crypto.randomUUID(),
  };

  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithm: 'HS256',
  });
}

/**
 * Verify JWT Access Token
 * @param {string} token
 * @returns {Object} Decoded payload
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithms: ['HS256'],
  });
}

/**
 * Verify JWT Refresh Token
 * @param {string} token
 * @returns {Object} Decoded payload
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithms: ['HS256'],
  });
}

/**
 * Returns safe cookie options for refresh token transport
 * HTTP-only, SameSite=lax, Secure in production
 */
export function getRefreshTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: `${env.API_PREFIX}/auth`, // Scoped strictly to auth routes
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  };
}

/**
 * Strips password hash and private credentials from User object
 * @param {Object} user
 * @returns {Object} Safe user data
 */
export function formatSafeUser(user) {
  if (!user) return null;
  const userObj = user.toObject ? user.toObject() : { ...user };

  delete userObj.passwordHash;
  delete userObj.__v;

  return {
    id: userObj._id ? userObj._id.toString() : userObj.id,
    shopId: userObj.shopId ? userObj.shopId.toString() : userObj.shopId,
    name: userObj.name,
    email: userObj.email || null,
    phone: userObj.phone || null,
    farmerId: userObj.farmerId || null,
    role: userObj.role,
    active: userObj.active,
    emailVerified: userObj.emailVerified,
    phoneVerified: userObj.phoneVerified,
    lastLoginAt: userObj.lastLoginAt || null,
    createdAt: userObj.createdAt,
    updatedAt: userObj.updatedAt,
  };
}
