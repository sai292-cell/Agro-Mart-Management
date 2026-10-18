import { Router } from 'express';
import {
  listCategories,
  createCategory,
  updateCategory,
} from '../controllers/categoryController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { requireDbReady } from '../middleware/dbReady.js';

const router = Router();

router.use(requireDbReady);
router.use(requireAuth);

// All authenticated roles (OWNER, MANAGER, CASHIER, CUSTOMER) can view categories
router.get('/', listCategories);

// Category management operations restricted to OWNER and MANAGER
router.post('/', requireRole('OWNER', 'MANAGER'), createCategory);
router.patch('/:id', requireRole('OWNER', 'MANAGER'), updateCategory);

export default router;
