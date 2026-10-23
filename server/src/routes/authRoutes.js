import { Router } from 'express';
import {
  login,
  logout,
  refresh,
  getMe,
  registerCustomer,
  customerLogin,
  ownerResetCustomerPassword,
} from '../controllers/authController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { requireDbReady } from '../middleware/dbReady.js';

const router = Router();

// Gating all auth routes with database readiness
router.use(requireDbReady);

// Staff and Owner login
router.post('/login', authRateLimiter, login);

// Session refresh and logout
router.post('/refresh', refresh);
router.post('/logout', logout);

// Authenticated current user profile
router.get('/me', requireAuth, getMe);

// Farmer Registration & ID/Password Authentication (Zero SMS OTP required)
router.post('/customer/register', authRateLimiter, registerCustomer);
router.post('/customer/login', authRateLimiter, customerLogin);

// Owner/Manager authorized farmer password reset (₹0 Budget verified recovery)
router.patch(
  '/customer/:customerId/reset-password',
  requireAuth,
  requireRole('OWNER', 'MANAGER'),
  ownerResetCustomerPassword
);

export default router;
