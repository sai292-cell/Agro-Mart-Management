import { verifyAccessToken, formatSafeUser } from '../utils/tokenUtils.js';
import { User } from '../models/User.js';

/**
 * Middleware: requireAuth
 * Extracts and verifies JWT access token from Authorization header or cookies
 */
export async function requireAuth(req, res, next) {
  try {
    let token = null;

    // 1. Check Authorization header: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required. Please log in.',
        },
      });
    }

    // 2. Verify token signature, issuer, audience, and expiration
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      const isExpired = err.name === 'TokenExpiredError';
      return res.status(401).json({
        success: false,
        error: {
          code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
          message: isExpired ? 'Session expired. Please refresh your token.' : 'Invalid authentication token.',
        },
      });
    }

    // 3. Look up active user in DB
    const user = await User.findById(decoded.sub);
    if (!user || !user.active) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'User account not found or has been deactivated.',
        },
      });
    }

    // 4. Attach safe user to request
    req.user = formatSafeUser(user);
    req.userId = user._id;
    req.userRole = user.role;
    req.shopId = user.shopId;
    if (decoded.customerId) {
      req.user.customerId = decoded.customerId;
    }

    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Internal authentication validation failure.',
      },
    });
  }
}

/**
 * Middleware: requireRole
 * Enforces role-based access control
 * @param {string[]} allowedRoles
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Requires one of: [${allowedRoles.join(', ')}]`,
        },
      });
    }

    next();
  };
}

/**
 * Middleware: requireSameShop
 * Ensures authenticated user cannot access or modify resources belonging to another shop
 */
export function requireSameShop(req, res, next) {
  const targetShopId = req.params.shopId || req.body.shopId || req.query.shopId;
  if (!targetShopId) {
    return next();
  }

  if (req.user && req.user.shopId.toString() !== targetShopId.toString()) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CROSS_SHOP_ACCESS_DENIED',
        message: 'You are not authorized to access resources belonging to a different shop.',
      },
    });
  }

  next();
}

/**
 * Middleware: requireCustomerSelf
 * Restricts customer to their own record while allowing OWNER/MANAGER oversight
 */
export function requireCustomerSelf(req, res, next) {
  const targetCustomerId = req.params.customerId || req.body.customerId || req.query.customerId;

  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
    });
  }

  // Owner and Manager can view any customer within their shop
  if (['OWNER', 'MANAGER', 'CASHIER'].includes(req.user.role)) {
    return next();
  }

  // If customer, ensure they are requesting only their own customer ID
  if (req.user.role === 'CUSTOMER') {
    if (!req.user.customerId || (targetCustomerId && req.user.customerId.toString() !== targetCustomerId.toString())) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'CUSTOMER_DATA_SANDBOX_VIOLATION',
          message: 'Customers are strictly restricted to accessing their own account records.',
        },
      });
    }
  }

  next();
}
