import { Router } from 'express';
import {
  recordStockReceipt,
  recordStockAdjustment,
  getStockOverview,
  listBatches,
  updateBatchStatus,
  listStockMovements,
} from '../controllers/inventoryController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { requireDbReady } from '../middleware/dbReady.js';

const router = Router();

router.use(requireDbReady);
router.use(requireAuth);

// Stock overview & batch lookup (Accessible to OWNER, MANAGER, CASHIER)
router.get('/stock', requireRole('OWNER', 'MANAGER', 'CASHIER'), getStockOverview);
router.get('/batches', requireRole('OWNER', 'MANAGER', 'CASHIER'), listBatches);

// Stock receiving and adjustments restricted to OWNER and MANAGER (CASHIER cannot alter inventory)
router.post('/receipt', requireRole('OWNER', 'MANAGER'), recordStockReceipt);
router.post('/adjustment', requireRole('OWNER', 'MANAGER'), recordStockAdjustment);
router.patch('/batches/:id/status', requireRole('OWNER', 'MANAGER'), updateBatchStatus);

// Authoritative ledger movements view restricted to OWNER and MANAGER
router.get('/movements', requireRole('OWNER', 'MANAGER'), listStockMovements);

export default router;
