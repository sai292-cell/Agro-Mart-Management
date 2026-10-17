import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import staffRoutes from './staffRoutes.js';

const apiRouter = Router();

// Infrastructure & health checks
apiRouter.use(healthRoutes);

// Authentication & Session endpoints (/api/v1/auth/*)
apiRouter.use('/auth', authRoutes);

// Staff management endpoints (/api/v1/staff/*)
apiRouter.use('/staff', staffRoutes);

export default apiRouter;
