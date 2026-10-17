import { Router } from 'express';
import {
  login,
  logout,
  refresh,
  getMe,
  requestCustomerOtp,
  verifyCustomerOtp,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
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

// Customer phone OTP authentication
router.post('/customer/login-request', authRateLimiter, requestCustomerOtp);
router.post('/customer/verify-otp', authRateLimiter, verifyCustomerOtp);

export default router;
