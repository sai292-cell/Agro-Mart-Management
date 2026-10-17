import { Router } from 'express';
import healthRoutes from './healthRoutes.js';

const apiRouter = Router();

// Mount modules
apiRouter.use(healthRoutes);

export default apiRouter;
