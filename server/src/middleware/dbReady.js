import { isDbConnected, getDbHealthInfo } from '../config/db.js';

/**
 * Middleware ensuring database readiness for business API requests
 * Rejects with HTTP 503 if database is disconnected
 */
export function requireDbReady(req, res, next) {
  if (isDbConnected()) {
    return next();
  }

  return res.status(503).json({
    success: false,
    error: {
      code: 'DATABASE_NOT_READY',
      message: 'The database is currently disconnected or initializing. Please retry in a few moments.',
      database: getDbHealthInfo(),
    },
  });
}
