import { Router } from 'express';
import {
  listProducts,
  createProduct,
  getProductDetails,
  updateProduct,
  toggleProductStatus,
  listLowStockProducts,
} from '../controllers/productController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { requireDbReady } from '../middleware/dbReady.js';

const router = Router();

router.use(requireDbReady);
router.use(requireAuth);

// Low-stock alert view (Accessible to OWNER, MANAGER, CASHIER)
router.get('/reorder/low-stock', requireRole('OWNER', 'MANAGER', 'CASHIER'), listLowStockProducts);

// List products (All authenticated roles; customer receives sanitized catalog)
router.get('/', listProducts);

// Product details with FEFO batches
router.get('/:id', getProductDetails);

// Product management operations strictly restricted to OWNER and MANAGER
router.post('/', requireRole('OWNER', 'MANAGER'), createProduct);
router.patch('/:id', requireRole('OWNER', 'MANAGER'), updateProduct);
router.patch('/:id/status', requireRole('OWNER', 'MANAGER'), toggleProductStatus);

export default router;
