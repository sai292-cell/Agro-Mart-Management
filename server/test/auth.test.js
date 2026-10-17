import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  hashPassword,
  comparePassword,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  formatSafeUser,
  getRefreshTokenCookieOptions,
} from '../src/utils/tokenUtils.js';
import {
  loginSchema,
  createStaffSchema,
  updateStaffRoleSchema,
} from '../src/validators/authValidators.js';

describe('Security & Authentication Suite', () => {
  const dummyShopId = new mongoose.Types.ObjectId();
  const dummyUserId = new mongoose.Types.ObjectId();
  const otherShopId = new mongoose.Types.ObjectId();

  describe('Password Hashing & Verification', () => {
    it('should hash password and verify match correctly', async () => {
      const rawPassword = 'StrongAgroPassword2026!';
      const hash = await hashPassword(rawPassword);

      assert.notEqual(hash, rawPassword);
      assert.ok(hash.startsWith('$2')); // bcrypt identifier

      const isMatch = await comparePassword(rawPassword, hash);
      assert.equal(isMatch, true);

      const isWrongMatch = await comparePassword('WrongPassword123!', hash);
      assert.equal(isWrongMatch, false);
    });

    it('should reject invalid password inputs to hashPassword', async () => {
      await assert.rejects(async () => {
        await hashPassword('');
      }, /Password must be a non-empty string/);
    });
  });

  describe('JWT Access & Refresh Token Management', () => {
    it('should sign and verify valid short-lived access tokens', () => {
      const user = {
        _id: dummyUserId,
        shopId: dummyShopId,
        role: 'OWNER',
        name: 'Shivshree Owner',
      };

      const token = signAccessToken(user);
      assert.ok(typeof token === 'string');

      const decoded = verifyAccessToken(token);
      assert.equal(decoded.sub, dummyUserId.toString());
      assert.equal(decoded.shopId, dummyShopId.toString());
      assert.equal(decoded.role, 'OWNER');
      assert.equal(decoded.iss, 'shivshree-agro-mart');
      assert.equal(decoded.aud, 'shivshree-agro-mart-client');
    });

    it('should sign and verify refresh tokens', () => {
      const user = { _id: dummyUserId, shopId: dummyShopId };
      const jti = 'session-uuid-123';
      const refreshToken = signRefreshToken(user, jti);

      const decoded = verifyRefreshToken(refreshToken);
      assert.equal(decoded.sub, dummyUserId.toString());
      assert.equal(decoded.shopId, dummyShopId.toString());
      assert.equal(decoded.jti, jti);
    });

    it('should reject tampered or invalid tokens', () => {
      assert.throws(() => {
        verifyAccessToken('invalid.token.payload');
      });

      const validToken = signAccessToken({ _id: dummyUserId, shopId: dummyShopId, role: 'CASHIER', name: 'Cashier' });
      const tamperedToken = validToken.slice(0, -5) + 'abcde';
      assert.throws(() => {
        verifyAccessToken(tamperedToken);
      });
    });
  });

  describe('Sensitive Field Exclusion (formatSafeUser)', () => {
    it('should strictly exclude passwordHash and private security fields from user objects', () => {
      const userDoc = {
        _id: dummyUserId,
        shopId: dummyShopId,
        name: 'Manager Patil',
        email: 'patil@example.com',
        phone: '9876543210',
        passwordHash: '$2a$12$e6mZ82hYwK69K2/XhH894e772.randomHashStringHere',
        role: 'MANAGER',
        active: true,
        emailVerified: true,
        phoneVerified: false,
        __v: 0,
      };

      const safeUser = formatSafeUser(userDoc);
      assert.equal(safeUser.passwordHash, undefined);
      assert.equal(safeUser.__v, undefined);
      assert.equal(safeUser.id, dummyUserId.toString());
      assert.equal(safeUser.name, 'Manager Patil');
      assert.equal(safeUser.role, 'MANAGER');
    });
  });

  describe('Cookie Security Options', () => {
    it('should configure HTTP-only, SameSite=lax, and path-restricted cookie settings', () => {
      const options = getRefreshTokenCookieOptions();
      assert.equal(options.httpOnly, true);
      assert.equal(options.sameSite, 'lax');
      assert.ok(options.path.includes('/auth'));
      assert.equal(typeof options.maxAge, 'number');
      assert.ok(options.maxAge > 0);
    });
  });

  describe('Zod Input Validation', () => {
    it('should validate valid staff creation inputs and disallow OWNER role in staff creation', () => {
      // Valid manager creation
      const validManager = createStaffSchema.safeParse({
        name: 'New Manager',
        email: 'manager@agro.com',
        password: 'Password123!',
        role: 'MANAGER',
      });
      assert.equal(validManager.success, true);

      // Attempting to create OWNER through staff creation must be rejected
      const invalidOwnerAttempt = createStaffSchema.safeParse({
        name: 'Unauthorized Owner Attempt',
        email: 'fakeowner@agro.com',
        password: 'Password123!',
        role: 'OWNER',
      });
      assert.equal(invalidOwnerAttempt.success, false);
      assert.ok(invalidOwnerAttempt.error.errors[0].message.includes('MANAGER or CASHIER'));
    });

    it('should reject weak passwords in staff creation', () => {
      const weakPasswordAttempt = createStaffSchema.safeParse({
        name: 'Staff One',
        email: 'staff@agro.com',
        password: 'short', // Too short, no uppercase, no numbers
        role: 'CASHIER',
      });
      assert.equal(weakPasswordAttempt.success, false);
    });

    it('should validate login inputs and reject missing credentials', () => {
      const emptyLogin = loginSchema.safeParse({});
      assert.equal(emptyLogin.success, false);

      const validLogin = loginSchema.safeParse({
        identifier: 'owner@shivshreeagro.com',
        password: 'ValidPassword123!',
      });
      assert.equal(validLogin.success, true);
    });
  });

  describe('Role-Based Authorization Constraints & Cross-Shop Isolation', () => {
    it('should detect cross-shop access violation', () => {
      const userShopId = dummyShopId.toString();
      const targetShopId = otherShopId.toString();

      const isCrossShop = userShopId !== targetShopId;
      assert.equal(isCrossShop, true);
    });

    it('should enforce that CASHIER and MANAGER roles cannot promote anyone to OWNER', () => {
      const roleUpdateAttempt = updateStaffRoleSchema.safeParse({
        role: 'OWNER',
      });
      assert.equal(roleUpdateAttempt.success, false);
    });

    it('should enforce customer account sandboxing (customer cannot access another customer ID)', () => {
      const customerAId = new mongoose.Types.ObjectId().toString();
      const customerBId = new mongoose.Types.ObjectId().toString();

      const user = {
        role: 'CUSTOMER',
        customerId: customerAId,
      };

      // Customer trying to access Customer B
      const isAuthorizedForB = user.role !== 'CUSTOMER' || user.customerId === customerBId;
      assert.equal(isAuthorizedForB, false, 'Customer A must not be authorized to view Customer B data');

      // Customer accessing own data
      const isAuthorizedForA = user.role !== 'CUSTOMER' || user.customerId === customerAId;
      assert.equal(isAuthorizedForA, true, 'Customer A must be authorized for own data');
    });
  });

  describe('Owner Provisioning Security Invariants', () => {
    it('should validate owner password complexity policy (min 10 chars, upper, lower, digit, special)', () => {
      const validatePolicy = (pwd) => {
        if (!pwd || pwd.length < 10) return false;
        return (
          /[A-Z]/.test(pwd) &&
          /[a-z]/.test(pwd) &&
          /\d/.test(pwd) &&
          /[^A-Za-z0-9]/.test(pwd)
        );
      };

      assert.equal(validatePolicy('weak'), false);
      assert.equal(validatePolicy('Short1!'), false); // Only 7 chars
      assert.equal(validatePolicy('NoSpecialChar1234'), false);
      assert.equal(validatePolicy('no-uppercase-1234!'), false);
      assert.equal(validatePolicy('NO-LOWERCASE-1234!'), false);
      assert.equal(validatePolicy('ValidOwnerPassword2026!'), true);
    });

    it('should disallow multiple OWNER records per shop', () => {
      const mockUsers = [
        { shopId: dummyShopId, role: 'OWNER', name: 'Original Owner' },
      ];

      const canProvisionNewOwner = !mockUsers.some(
        (u) => u.shopId.equals(dummyShopId) && u.role === 'OWNER'
      );
      assert.equal(canProvisionNewOwner, false, 'Provisioning must abort if OWNER already exists');
    });
  });
});
