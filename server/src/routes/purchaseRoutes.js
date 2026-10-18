import { Router } from 'express';
import {
  listPurchases,
  createPurchase,
  getPurchaseDetails,
  receivePurchase,
  cancelPurchase,
  recordPurchaseReturn,
} from '../controllers/purchaseController.js';
import {
  requireAuth,
  requireRole,
  requireSameShop,
} from '../middleware/authMiddleware.js';

const router = Router();

// Staff role boundary: Only OWNER and MANAGER can manage inward purchases and costs
router.use(requireAuth);
router.use(requireRole('OWNER', 'MANAGER'));
router.use(requireSameShop);

router.get('/', listPurchases);
router.post('/', createPurchase);

router.get('/:id', getPurchaseDetails);
router.post('/:id/receive', receivePurchase);
router.post('/:id/cancel', cancelPurchase);
router.post('/:id/return', recordPurchaseReturn);

export default router;
