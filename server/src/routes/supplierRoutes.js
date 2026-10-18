import { Router } from 'express';
import {
  listSuppliers,
  createSupplier,
  getSupplierDetails,
  updateSupplier,
  getSupplierStatement,
  recordSupplierPayment,
  recordSupplierAdjustment,
  recordOpeningBalance,
  reverseLedgerEntry,
  getSupplierReconciliationReport,
} from '../controllers/supplierController.js';
import {
  requireAuth,
  requireRole,
  requireSameShop,
} from '../middleware/authMiddleware.js';

const router = Router();

// Staff role boundary: Only OWNER and MANAGER can manage suppliers and view supplier purchase costs
router.use(requireAuth);
router.use(requireRole('OWNER', 'MANAGER'));
router.use(requireSameShop);

router.get('/', listSuppliers);
router.post('/', createSupplier);

router.get('/:id', getSupplierDetails);
router.patch('/:id', updateSupplier);

router.get('/:id/statement', getSupplierStatement);
router.post('/:id/payments', recordSupplierPayment);
router.post('/:id/adjustments', recordSupplierAdjustment);
router.post('/:id/opening-balance', recordOpeningBalance);
router.post('/:id/entries/:entryId/reverse', reverseLedgerEntry);
router.get('/:id/reconciliation', getSupplierReconciliationReport);

export default router;
