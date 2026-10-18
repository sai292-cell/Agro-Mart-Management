import crypto from 'node:crypto';
import { User } from '../models/User.js';
import { Customer } from '../models/Customer.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { OtpVerification } from '../models/OtpVerification.js';
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
 * POST /api/v1/auth/customer/login-request
 * Requests a short-lived one-time code for verified farmer login
 */
export async function requestCustomerOtp(req, res, next) {
  try {
    const parseResult = customerLoginRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
        },
      });
    }

    const { phone, shopId } = parseResult.data;
    const cleanPhone = phone.trim();

    // Check if customer exists in Customer directory
    const query = { phone: cleanPhone };
    if (shopId) query.shopId = shopId;

    const customer = await Customer.findOne(query);

    // Generic safe response to prevent phone number enumeration
    if (!customer) {
      return res.status(200).json({
        success: true,
        message: 'If your mobile number is registered with Shivshree Agro Mart, an OTP has been sent.',
      });
    }

    // Generate 6-digit OTP
    const rawOtp = env.DEV_ALLOW_TEST_OTP && env.NODE_ENV !== 'production'
      ? '123456'
      : crypto.randomInt(100000, 999999).toString();

    const otpHash = await hashPassword(rawOtp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Invalidate any previous pending OTPs for this phone
    await OtpVerification.deleteMany({ phone: cleanPhone, shopId: customer.shopId });

    await OtpVerification.create({
      shopId: customer.shopId,
      customerId: customer._id,
      phone: cleanPhone,
      otpHash,
      expiresAt,
    });

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully to registered mobile number.',
      ...(env.DEV_ALLOW_TEST_OTP && env.NODE_ENV !== 'production' && {
        devNotice: 'Development mode active. Test OTP is: 123456',
      }),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/customer/verify-otp
 * Verifies customer OTP and issues sandboxed customer tokens
 */
export async function verifyCustomerOtp(req, res, next) {
  try {
    const parseResult = customerVerifyOtpSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
        },
      });
    }

    const { phone, otp, shopId } = parseResult.data;
    const cleanPhone = phone.trim();

    const query = { phone: cleanPhone };
    if (shopId) query.shopId = shopId;

    const verificationRecord = await OtpVerification.findOne({
      ...query,
      expiresAt: { $gt: new Date() },
    });

    if (!verificationRecord) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'OTP_EXPIRED_OR_INVALID',
          message: 'The OTP has expired or was not requested. Please request a new code.',
        },
      });
    }

    // Check attempts limit
    if (verificationRecord.attempts >= 3) {
      await OtpVerification.deleteOne({ _id: verificationRecord._id });
      return res.status(429).json({
        success: false,
        error: {
          code: 'MAX_ATTEMPTS_EXCEEDED',
          message: 'Maximum OTP verification attempts exceeded. Please request a new code.',
        },
      });
    }

    const isMatch = await comparePassword(otp, verificationRecord.otpHash);
    if (!isMatch) {
      verificationRecord.attempts += 1;
      await verificationRecord.save();
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OTP',
          message: 'Invalid verification code. Please check and try again.',
        },
      });
    }

    // Look up customer
    const customer = await Customer.findById(verificationRecord.customerId);
    if (!customer || !customer.active) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: 'Customer profile not found or inactive.',
        },
      });
    }

    // Ensure customer has a linked User account with CUSTOMER role
    let user = customer.linkedUserId
      ? await User.findById(customer.linkedUserId)
      : null;

    if (!user) {
      user = await User.create({
        shopId: customer.shopId,
        name: customer.name,
        phone: cleanPhone,
        role: 'CUSTOMER', // Strictly enforced on backend
        phoneVerified: true,
        active: true,
      });

      customer.linkedUserId = user._id;
      await customer.save();
    }

    // Clean up OTP record
    await OtpVerification.deleteOne({ _id: verificationRecord._id });

    // Issue tokens with customerId attached
    const userPayload = { ...user.toObject(), customerId: customer._id };
    const accessToken = signAccessToken(userPayload);
    const jti = crypto.randomUUID();
    const rawRefreshToken = signRefreshToken(userPayload, jti);

    await RefreshToken.create({
      userId: user._id,
      shopId: user.shopId,
      tokenHash: hashToken(rawRefreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    res.cookie('refreshToken', rawRefreshToken, getRefreshTokenCookieOptions());

    return res.status(200).json({
      success: true,
      data: {
        accessToken,
        user: {
          ...formatSafeUser(user),
          customerId: customer._id.toString(),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}
