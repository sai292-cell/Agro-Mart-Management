import { Router } from 'express';
import { requireAuth, requireRole, requireSameShop } from '../middleware/authMiddleware.js';
import {
  getDailyClosingSummary,
  getDailyClosingHistory,
} from '../controllers/dailyClosingController.js';

const router = Router();

router.use(requireAuth);
router.use(requireSameShop);
router.use(requireRole('OWNER', 'MANAGER'));

router.get('/summary', getDailyClosingSummary);
router.get('/history', getDailyClosingHistory);

export default router;
