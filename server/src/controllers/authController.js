import crypto from 'node:crypto';
import { User } from '../models/User.js';
import { Customer } from '../models/Customer.js';
import { Shop } from '../models/Shop.js';
import { Counter } from '../models/Counter.js';
import { AuditLog } from '../models/AuditLog.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { OtpVerification } from '../models/OtpVerification.js';
import { sendOtpSms } from '../services/smsService.js';
import {
  hashPassword,
  comparePassword,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getRefreshTokenCookieOptions,
  formatSafeUser,
} from '../utils/tokenUtils.js';
import {
  loginSchema,
  customerRegisterSchema,
  customerPasswordLoginSchema,
  ownerResetCustomerPasswordSchema,
  customerLoginRequestSchema,
  customerVerifyOtpSchema,
} from '../validators/authValidators.js';
import { env } from '../config/env.js';

/**
 * POST /api/v1/auth/login
 * Staff and Owner credential authentication
 */
export async function login(req, res, next) {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
          details: parseResult.error.flatten(),
        },
      });
    }

    const { identifier, password, shopId } = parseResult.data;
    const isEmail = identifier.includes('@');
    const query = isEmail
      ? { email: identifier.toLowerCase().trim() }
      : { phone: identifier.trim() };

    if (shopId) {
      query.shopId = shopId;
    }

    // Explicitly select passwordHash which is hidden by default in schema
    const user = await User.findOne(query).select('+passwordHash');

    // Generic error message for both non-existent account and wrong password
    const GENERIC_AUTH_ERROR = {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email, phone number, or password.',
    };

    if (!user || !user.passwordHash) {
      return res.status(401).json({ success: false, error: GENERIC_AUTH_ERROR });
    }

    // Farmer accounts cannot access Owner & Staff portal
    if (user.role === 'CUSTOMER') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PORTAL_ACCESS_DENIED',
          message: 'Farmer accounts cannot access the Shop Owner & Staff portal. Please use the Farmer Portal.',
        },
      });
    }

    if (!user.active) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_DEACTIVATED',
          message: 'Your account has been deactivated. Please contact the shop owner.',
        },
      });
    }

    const passwordMatch = await comparePassword(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: GENERIC_AUTH_ERROR });
    }

    // Generate tokens
    const accessToken = signAccessToken(user);
    const jti = crypto.randomUUID();
    const rawRefreshToken = signRefreshToken(user, jti);

    // Persist refresh token hash for session management and revocation
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await RefreshToken.create({
      userId: user._id,
      shopId: user.shopId,
      tokenHash,
      expiresAt,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Set HTTP-only secure cookie
    res.cookie('refreshToken', rawRefreshToken, getRefreshTokenCookieOptions());

    return res.status(200).json({
      success: true,
      data: {
        accessToken,
        user: formatSafeUser(user),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/refresh
 * Rotates refresh token and issues a new short-lived access token
 */
export async function refresh(req, res, next) {
  try {
    const rawRefreshToken =
      req.cookies?.refreshToken || req.body?.refreshToken;

    if (!rawRefreshToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'REFRESH_TOKEN_REQUIRED',
          message: 'Refresh token must be provided via cookie or request body.',
        },
      });
    }

    // Verify token signature, issuer, audience
    let decoded;
    try {
      decoded = verifyRefreshToken(rawRefreshToken);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is expired or invalid.',
        },
      });
    }

    // Verify active session in database
    const incomingTokenHash = hashToken(rawRefreshToken);
    const storedToken = await RefreshToken.findOne({
      tokenHash: incomingTokenHash,
      revokedAt: null,
    });

    if (!storedToken) {
      // Possible token reuse attack: clear cookie
      res.clearCookie('refreshToken', getRefreshTokenCookieOptions());
      return res.status(401).json({
        success: false,
        error: {
          code: 'REVOKED_REFRESH_TOKEN',
          message: 'Session has been revoked or expired. Please log in again.',
        },
      });
    }

    const user = await User.findById(decoded.sub);
    if (!user || !user.active) {
      res.clearCookie('refreshToken', getRefreshTokenCookieOptions());
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND_OR_INACTIVE',
          message: 'User account is inactive.',
        },
      });
    }

    // Revoke old refresh token (Token Rotation pattern)
    storedToken.revokedAt = new Date();
    await storedToken.save();

    // Preserve customer sandbox link for customer role
    let userPayload = user;
    if (user.role === 'CUSTOMER') {
      const customer = await Customer.findOne({ linkedUserId: user._id, shopId: user.shopId });
      if (customer) {
        userPayload = { ...user.toObject(), customerId: customer._id };
      }
    }

    // Issue new access and refresh tokens
    const newAccessToken = signAccessToken(userPayload);
    const newJti = crypto.randomUUID();
    const newRawRefreshToken = signRefreshToken(userPayload, newJti);
    const newTokenHash = hashToken(newRawRefreshToken);

    await RefreshToken.create({
      userId: user._id,
      shopId: user.shopId,
      tokenHash: newTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    res.cookie('refreshToken', newRawRefreshToken, getRefreshTokenCookieOptions());

    return res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
        user: formatSafeUser(user),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/logout
 * Revokes refresh session and clears authentication cookies
 */
export async function logout(req, res, next) {
  try {
    const rawRefreshToken =
      req.cookies?.refreshToken || req.body?.refreshToken;

    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await RefreshToken.updateOne(
        { tokenHash, revokedAt: null },
        { revokedAt: new Date() }
      );
    }

    // If authenticated user calls logout, optionally revoke all active sessions for this device
    if (req.user?.id) {
      await RefreshToken.updateMany(
        { userId: req.user.id, revokedAt: null },
        { revokedAt: new Date() }
      );
    }

    res.clearCookie('refreshToken', getRefreshTokenCookieOptions());

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/auth/me
 * Returns authenticated user profile
 */
export async function getMe(req, res) {
  return res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
}

/**
 * POST /api/v1/auth/customer/register
 * Self-service registration for Farmers with collision-safe unique Farmer ID generation
 */
export async function registerCustomer(req, res, next) {
  try {
    const parseResult = customerRegisterSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
          details: parseResult.error.flatten(),
        },
      });
    }

    const {
      name,
      phone,
      email,
      password,
      village,
      taluka,
      district,
      state = 'Maharashtra',
      preferredLanguage = 'mr',
      age,
      gender,
      shopId,
    } = parseResult.data;

    const rawDigits = phone.replace(/\D/g, '');
    const cleanPhone = rawDigits.length >= 10 ? rawDigits.slice(-10) : rawDigits;
    const cleanEmail = email ? email.toLowerCase().trim() : null;

    // Resolve shop
    let shop = shopId ? await Shop.findById(shopId) : await Shop.findOne();
    if (!shop) {
      shop = await Shop.create({
        name: 'Shivshree Agro Mart',
        displayName: 'Shivshree Agro Mart',
        state: 'Maharashtra',
        country: 'India',
      });
    }

    // Check for duplicate farmer account by phone within shop
    const existingUserWithPhone = await User.findOne({
      phone: cleanPhone,
      shopId: shop._id,
    });
    if (existingUserWithPhone) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_PHONE',
          message: 'An account with this mobile number is already registered. Please sign in with your Farmer ID and password.',
        },
      });
    }

    // Check for duplicate account by email if provided
    if (cleanEmail) {
      const existingUserWithEmail = await User.findOne({
        email: cleanEmail,
        shopId: shop._id,
      });
      if (existingUserWithEmail) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_EMAIL',
            message: 'An account with this email address is already registered.',
          },
        });
      }
    }

    // Generate collision-safe Farmer ID using atomic Counter
    const year = new Date().getFullYear();
    const seq = await Counter.getNextSequence(shop._id, `FARMER_${year}`);
    const farmerId = `FARM-${year}-${String(seq).padStart(6, '0')}`;

    // Hash password using project standard bcrypt (12 rounds)
    const passwordHash = await hashPassword(password);

    // Create User record with strictly CUSTOMER role
    const user = await User.create({
      shopId: shop._id,
      name: name.trim(),
      phone: cleanPhone,
      email: cleanEmail || undefined,
      farmerId,
      passwordHash,
      role: 'CUSTOMER',
      active: true,
      phoneVerified: false,
      emailVerified: false,
    });

    // Link or create corresponding Customer record to maintain financial relationship integrity
    let customer = await Customer.findOne({ phone: cleanPhone, shopId: shop._id });
    if (customer) {
      customer.linkedUserId = user._id;
      customer.farmerId = farmerId;
      customer.name = name.trim();
      customer.village = village.trim();
      customer.taluka = taluka.trim();
      customer.district = district.trim();
      customer.state = state.trim();
      customer.preferredLanguage = preferredLanguage;
      if (age !== undefined && age !== null) customer.age = age;
      if (gender) customer.gender = gender;
      await customer.save();
    } else {
      customer = await Customer.create({
        shopId: shop._id,
        name: name.trim(),
        phone: cleanPhone,
        farmerId,
        village: village.trim(),
        taluka: taluka.trim(),
        district: district.trim(),
        state: state.trim(),
        preferredLanguage,
        age: age || undefined,
        gender: gender || undefined,
        creditLimitPaise: 0,
        linkedUserId: user._id,
        active: true,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Farmer account registered successfully. Please save your Farmer ID.',
      data: {
        farmerId,
        name: user.name,
        phone: user.phone,
        village: customer.village,
        taluka: customer.taluka,
        district: customer.district,
        preferredLanguage: customer.preferredLanguage,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/customer/login
 * Farmer ID and Password authentication (No OTP required)
 */
export async function customerLogin(req, res, next) {
  try {
    const parseResult = customerPasswordLoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
          details: parseResult.error.flatten(),
        },
      });
    }

    const { farmerId, password, shopId } = parseResult.data;
    const cleanFarmerId = farmerId.trim().toUpperCase();

    const GENERIC_FARMER_AUTH_ERROR = {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid Farmer ID or password.',
    };

    const query = { farmerId: cleanFarmerId, role: 'CUSTOMER' };
    if (shopId) {
      query.shopId = shopId;
    }

    // Explicitly query passwordHash which is hidden by default in User schema
    const user = await User.findOne(query).select('+passwordHash');
    if (!user || !user.passwordHash) {
      return res.status(401).json({ success: false, error: GENERIC_FARMER_AUTH_ERROR });
    }

    if (!user.active) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_DEACTIVATED',
          message: 'Your farmer account has been deactivated. Please contact Shivshree Agro Mart counter.',
        },
      });
    }

    const passwordMatch = await comparePassword(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: GENERIC_FARMER_AUTH_ERROR });
    }

    // Retrieve linked customer profile
    let customer = await Customer.findOne({ linkedUserId: user._id, shopId: user.shopId });
    if (!customer) {
      customer = await Customer.findOne({ farmerId: user.farmerId, shopId: user.shopId });
      if (customer && !customer.linkedUserId) {
        customer.linkedUserId = user._id;
        await customer.save();
      }
    }

    // Issue signed tokens strictly with sandboxed customerId
    const userPayload = {
      ...user.toObject(),
      farmerId: user.farmerId,
      customerId: customer?._id,
    };
    const accessToken = signAccessToken(userPayload);
    const jti = crypto.randomUUID();
    const rawRefreshToken = signRefreshToken(userPayload, jti);

    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await RefreshToken.create({
      userId: user._id,
      shopId: user.shopId,
      tokenHash,
      expiresAt,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    user.lastLoginAt = new Date();
    await user.save();

    res.cookie('refreshToken', rawRefreshToken, getRefreshTokenCookieOptions());

    return res.status(200).json({
      success: true,
      data: {
        accessToken,
        user: {
          ...formatSafeUser(user),
          farmerId: user.farmerId,
          customerId: customer?._id ? customer._id.toString() : null,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/auth/customer/:customerId/reset-password
 * Owner/Manager authorized password reset for a farmer after identity verification
 */
export async function ownerResetCustomerPassword(req, res, next) {
  try {
    const parseResult = ownerResetCustomerPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
          details: parseResult.error.flatten(),
        },
      });
    }

    const { customerId } = req.params;
    const { newPassword, reason } = parseResult.data;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: 'Customer record not found.',
        },
      });
    }

    let user = null;
    if (customer.linkedUserId) {
      user = await User.findById(customer.linkedUserId);
    } else if (customer.farmerId) {
      user = await User.findOne({ farmerId: customer.farmerId, role: 'CUSTOMER' });
    } else if (customer.phone) {
      user = await User.findOne({ phone: customer.phone, shopId: customer.shopId, role: 'CUSTOMER' });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_ACCOUNT_NOT_FOUND',
          message: 'No login account is associated with this customer profile.',
        },
      });
    }

    const newHash = await hashPassword(newPassword);
    user.passwordHash = newHash;
    await user.save();

    // Invalidate existing sessions for this user so they must sign in with new password
    await RefreshToken.updateMany(
      { userId: user._id, revokedAt: null },
      { revokedAt: new Date() }
    );

    // Audit log entry for security tracking (Never log passwords)
    await AuditLog.create({
      shopId: customer.shopId,
      actorUserId: req.user?.id || req.userId,
      action: 'CUSTOMER_PASSWORD_RESET_BY_OWNER',
      entityType: 'CUSTOMER',
      entityId: customer._id.toString(),
      reason: reason || 'Owner-verified in-person identity password reset',
      metadata: {
        customerName: customer.name,
        phone: customer.phone,
        farmerId: customer.farmerId || user.farmerId,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Farmer password has been reset successfully.',
    });
  } catch (err) {
    next(err);
  }
}
