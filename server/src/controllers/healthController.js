import { env } from '../config/env.js';
import { isDbConnected, getDbHealthInfo } from '../config/db.js';

/**
 * Controller for API liveness check endpoint: GET /api/v1/health
 * Reports whether the Express API server process is alive and running
 */
export const getHealth = (req, res) => {
  const dbInfo = getDbHealthInfo();

  res.status(200).json({
    success: true,
    data: {
      status: 'operational',
      service: 'Shivshree Agro Mart OS API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: env.NODE_ENV,
      database: dbInfo,
    },
  });
};

/**
 * Controller for API readiness check endpoint: GET /api/v1/health/ready
 * Reports whether the API is ready to accept business requests (usable database connection)
 * Returns HTTP 200 when ready, HTTP 503 when database is not connected
 */
export const getReadiness = (req, res) => {
  const isReady = isDbConnected();
  const dbInfo = getDbHealthInfo();

  if (isReady) {
    return res.status(200).json({
      success: true,
      data: {
        status: 'ready',
        service: 'Shivshree Agro Mart OS API',
        timestamp: new Date().toISOString(),
        database: dbInfo,
      },
    });
  }

  return res.status(503).json({
    success: false,
    error: {
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database connection is not ready. Business operations are currently unavailable.',
      database: dbInfo,
    },
  });
};
