import { isDbConnected, getDbHealthInfo, connectToDatabase } from '../config/db.js';

/**
 * Middleware ensuring database readiness for business API requests
 * Attempts on-demand reconnection before rejecting with HTTP 503 if database is disconnected
 */
export async function requireDbReady(req, res, next) {
  if (isDbConnected()) {
    return next();
  }

  try {
    await connectToDatabase();
    if (isDbConnected()) {
      return next();
    }
  } catch (err) {
    // Proceed to 503 error response
  }

  return res.status(503).json({
    success: false,
    error: {
      code: 'DATABASE_NOT_READY',
      message: 'The database is currently disconnected. If using MongoDB Atlas, make sure your IP is whitelisted in Network Access (or set to 0.0.0.0/0).',
      database: getDbHealthInfo(),
    },
  });
}

