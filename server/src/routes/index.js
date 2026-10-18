import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import staffRoutes from './staffRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import productRoutes from './productRoutes.js';
import inventoryRoutes from './inventoryRoutes.js';
import billingRoutes from './billingRoutes.js';
import customerRoutes from './customerRoutes.js';
import supplierRoutes from './supplierRoutes.js';
import purchaseRoutes from './purchaseRoutes.js';
import expenseRoutes from './expenseRoutes.js';
import cashbookRoutes from './cashbookRoutes.js';
import dailyClosingRoutes from './dailyClosingRoutes.js';
import reportRoutes from './reportRoutes.js';

const apiRouter = Router();

// Infrastructure & health checks
apiRouter.use(healthRoutes);

// Authentication & Session endpoints (/api/v1/auth/*)
apiRouter.use('/auth', authRoutes);

// Staff management endpoints (/api/v1/staff/*)
apiRouter.use('/staff', staffRoutes);

// Category endpoints (/api/v1/categories/*)
apiRouter.use('/categories', categoryRoutes);

// Product endpoints (/api/v1/products/*)
apiRouter.use('/products', productRoutes);

// Inventory & stock endpoints (/api/v1/inventory/*)
apiRouter.use('/inventory', inventoryRoutes);

// Billing & Invoicing endpoints (/api/v1/invoices/* and /api/v1/billing/*)
apiRouter.use('/invoices', billingRoutes);
apiRouter.use('/billing', billingRoutes);

// Farmer Credit Ledger & Customer endpoints (/api/v1/customers/*)
apiRouter.use('/customers', customerRoutes);

// Supplier Management & Accounts Payable endpoints (/api/v1/suppliers/*)
apiRouter.use('/suppliers', supplierRoutes);

// Purchase Inward & Bills endpoints (/api/v1/purchases/*)
apiRouter.use('/purchases', purchaseRoutes);

// Operating Expenses endpoints (/api/v1/expenses/*)
apiRouter.use('/expenses', expenseRoutes);

// Cashbook & Drawer Sessions endpoints (/api/v1/cashbook/*)
apiRouter.use('/cashbook', cashbookRoutes);

// Daily Closing & Reconciliation endpoints (/api/v1/daily-closing/*)
apiRouter.use('/daily-closing', dailyClosingRoutes);

// Profitability, Sales & Management Reports endpoints (/api/v1/reports/*)
apiRouter.use('/reports', reportRoutes);

export default apiRouter;


