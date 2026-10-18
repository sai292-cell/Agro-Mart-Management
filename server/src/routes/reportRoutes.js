import { Router } from 'express';
import { requireAuth, requireRole, requireSameShop } from '../middleware/authMiddleware.js';
import {
  getSalesReport,
  getProfitabilityReport,
  getExpensesReport,
  getReceivablesAndPayables,
  getInventoryValuationReport,
  getFinancialSummary,
} from '../controllers/reportController.js';

const router = Router();

router.use(requireAuth);
router.use(requireSameShop);
router.use(requireRole('OWNER', 'MANAGER'));

router.get('/sales', getSalesReport);
router.get('/profitability', getProfitabilityReport);
router.get('/expenses', getExpensesReport);
router.get('/receivables-payables', getReceivablesAndPayables);
router.get('/inventory-valuation', getInventoryValuationReport);
router.get('/financial-summary', getFinancialSummary);

export default router;
