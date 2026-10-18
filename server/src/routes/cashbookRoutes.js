import { Router } from 'express';
import { requireAuth, requireRole, requireSameShop } from '../middleware/authMiddleware.js';
import {
  getActiveSession,
  openSession,
  closeSession,
  listSessions,
  getCashMovements,
} from '../controllers/cashbookController.js';

const router = Router();

router.use(requireAuth);
router.use(requireSameShop);

// Operational drawer controls for cashier and managers
router.get('/session/current', requireRole('OWNER', 'MANAGER', 'CASHIER'), getActiveSession);
router.post('/session/open', requireRole('OWNER', 'MANAGER', 'CASHIER'), openSession);
router.post('/session/close', requireRole('OWNER', 'MANAGER', 'CASHIER'), closeSession);

// Historical logs and movements restricted to Owner and Manager
router.get('/sessions', requireRole('OWNER', 'MANAGER'), listSessions);
router.get('/movements', requireRole('OWNER', 'MANAGER'), getCashMovements);

export default router;
