import { Router } from 'express';
import {
  listStaff,
  createStaff,
  updateStaffRole,
  updateStaffStatus,
} from '../controllers/staffController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { requireDbReady } from '../middleware/dbReady.js';

const router = Router();

// Ensure DB is connected and user is authenticated
router.use(requireDbReady);
router.use(requireAuth);

// List staff accounts for current shop (Accessible to OWNER and MANAGER)
router.get('/', requireRole('OWNER', 'MANAGER'), listStaff);

// Staff management operations strictly restricted to OWNER
router.post('/', requireRole('OWNER'), createStaff);
router.patch('/:id/role', requireRole('OWNER'), updateStaffRole);
router.patch('/:id/status', requireRole('OWNER'), updateStaffStatus);

export default router;
