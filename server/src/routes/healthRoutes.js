import { Router } from 'express';
import { getHealth, getReadiness } from '../controllers/healthController.js';

const router = Router();

// GET /api/v1/health (Liveness)
router.get('/health', getHealth);

// GET /api/v1/health/ready (Readiness)
router.get('/health/ready', getReadiness);

export default router;
