import { Router } from 'express';
import {
  listCustomers,
  getCustomerDetails,
  getCustomerStatement,
  recordCustomerAccountPayment,
  recordCustomerAdjustment,
  recordOpeningBalance,
  reverseLedgerEntry,
  updateCustomerCreditLimit,
  getCustomerReconciliationReport,
  getMyCreditProfile,
  getMyPassbook,
} from '../controllers/customerController.js';
import { quickCreateCustomer } from '../controllers/billingController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { requireDbReady } from '../middleware/dbReady.js';

const router = Router();

router.use(requireDbReady);
router.use(requireAuth);

// 1. Customer Self-Service Routes (CUSTOMER Role)
router.get('/my/profile', requireRole('CUSTOMER'), getMyCreditProfile);
router.get('/my/passbook', requireRole('CUSTOMER'), getMyPassbook);

// 2. Shop-wide Credit Integrity & Reconciliation Report (OWNER, MANAGER)
router.get('/reconciliation/report', requireRole('OWNER', 'MANAGER'), getCustomerReconciliationReport);

// 3. Ledger Reversal (OWNER, MANAGER)
router.post('/ledger/:entryId/reversal', requireRole('OWNER', 'MANAGER'), reverseLedgerEntry);

// 4. Staff Customer Operations (OWNER, MANAGER, CASHIER)
router.get('/', requireRole('OWNER', 'MANAGER', 'CASHIER'), listCustomers);
router.post('/', requireRole('OWNER', 'MANAGER', 'CASHIER'), quickCreateCustomer);
router.get('/:id', getCustomerDetails);
router.get('/:id/statement', getCustomerStatement);

// 5. Payment Collections (OWNER, MANAGER, CASHIER)
router.post('/:id/payments', requireRole('OWNER', 'MANAGER', 'CASHIER'), recordCustomerAccountPayment);

// 6. Authorized Adjustments, Opening Balance & Credit Limits (OWNER, MANAGER only; CASHIER denied)
router.post('/:id/adjustments', requireRole('OWNER', 'MANAGER'), recordCustomerAdjustment);
router.post('/:id/opening-balance', requireRole('OWNER', 'MANAGER'), recordOpeningBalance);
router.patch('/:id/credit-limit', requireRole('OWNER', 'MANAGER'), updateCustomerCreditLimit);

export default router;
