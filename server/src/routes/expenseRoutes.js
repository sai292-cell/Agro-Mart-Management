import { Router } from 'express';
import { requireAuth, requireRole, requireSameShop } from '../middleware/authMiddleware.js';
import {
  listExpenses,
  createExpense,
  getExpenseById,
  approveExpense,
  rejectExpense,
  reverseExpense,
  getExpenseCategoriesSummary,
} from '../controllers/expenseController.js';

const router = Router();

// Staff operating expenses endpoints
router.use(requireAuth);
router.use(requireSameShop);

// List & view expenses
router.get('/', requireRole('OWNER', 'MANAGER', 'CASHIER'), listExpenses);
router.get('/categories/summary', requireRole('OWNER', 'MANAGER'), getExpenseCategoriesSummary);
router.get('/:id', requireRole('OWNER', 'MANAGER', 'CASHIER'), getExpenseById);

// Submit / record expense
router.post('/', requireRole('OWNER', 'MANAGER', 'CASHIER'), createExpense);

// Owner / Manager approval, rejection, and reversal
router.patch('/:id/approve', requireRole('OWNER', 'MANAGER'), approveExpense);
router.patch('/:id/reject', requireRole('OWNER', 'MANAGER'), rejectExpense);
router.post('/:id/reverse', requireRole('OWNER', 'MANAGER'), reverseExpense);

export default router;
