import { env } from '../config/env.js';

/**
 * Controller for API health check endpoint
 * Reports API process state without making false claims about MongoDB connection
 */
export const getHealth = (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'operational',
      service: 'Shivshree Agro Mart OS API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: env.NODE_ENV,
      database: {
        status: 'pending_setup',
        connected: false,
        note: 'Database connection is scheduled for Milestone 3',
      },
    },
  });
};
