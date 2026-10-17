import { env } from '../config/env.js';

/**
 * 404 Not Found handler for unmatched API routes
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist.`,
    },
  });
};

/**
 * Centralized error handler
 */
export const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  // Log error on server side
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: statusCode === 500 && env.NODE_ENV === 'production' 
        ? 'An unexpected internal server error occurred.' 
        : message,
      ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
};
