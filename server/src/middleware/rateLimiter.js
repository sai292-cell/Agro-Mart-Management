import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * Rate limiter for authentication and login endpoints
 * Mitigates brute-force credential stuffing and password guessing
 */
export const authRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS, // 15 minutes
  max: env.AUTH_RATE_LIMIT_MAX_REQUESTS,   // Max 10 attempts
  standardHeaders: true,                   // Return standard RateLimit-* headers
  legacyHeaders: false,                    // Disable X-RateLimit-* headers
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many login or verification attempts from this IP address. Please wait 15 minutes before trying again.',
      },
    });
  },
});
