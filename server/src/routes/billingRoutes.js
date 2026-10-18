import { Router } from 'express';
import {
  checkoutInvoice,
  getInvoiceDetails,
  listInvoices,
  recordPaymentAgainstInvoice,
  cancelInvoice,
  listCustomers,
  quickCreateCustomer,
  printInvoiceHtml,
} from '../controllers/billingController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { requireDbReady } from '../middleware/dbReady.js';

const router = Router();

router.use(requireDbReady);
router.use(requireAuth);

// List and search invoices (OWNER, MANAGER, CASHIER, CUSTOMER sandboxed)
router.get('/', listInvoices);

// POS Counter customer lookup and quick register (OWNER, MANAGER, CASHIER)
router.get('/customers', requireRole('OWNER', 'MANAGER', 'CASHIER'), listCustomers);
router.post('/customers', requireRole('OWNER', 'MANAGER', 'CASHIER'), quickCreateCustomer);

// Print / View HTML tax invoice (before /:id)
router.get('/:id/print', printInvoiceHtml);

// View specific invoice details
router.get('/:id', getInvoiceDetails);

// Finalize POS Sale (OWNER, MANAGER, CASHIER)
router.post('/', requireRole('OWNER', 'MANAGER', 'CASHIER'), checkoutInvoice);

// Record payment against an outstanding invoice (OWNER, MANAGER, CASHIER)
router.post('/:id/payments', requireRole('OWNER', 'MANAGER', 'CASHIER'), recordPaymentAgainstInvoice);

// Cancel an invoice with mandatory stock reversal (Strictly restricted to OWNER and MANAGER; CASHIER denied)
router.post('/:id/cancel', requireRole('OWNER', 'MANAGER'), cancelInvoice);

export default router;

