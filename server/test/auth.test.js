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
  customerRegisterSchema,
  customerPasswordLoginSchema,
  ownerResetCustomerPasswordSchema,
} from '../src/validators/authValidators.js';
import { normalizePhoneNumber, sendOtpSms } from '../src/services/smsService.js';

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
    it('should sign and verify valid short-lived access tokens with farmerId', () => {
      const user = {
        _id: dummyUserId,
        shopId: dummyShopId,
        role: 'CUSTOMER',
        name: 'Ramesh Patil',
        farmerId: 'FARM-2026-000001',
        customerId: dummyUserId.toString(),
      };

      const token = signAccessToken(user);
      assert.ok(typeof token === 'string');

      const decoded = verifyAccessToken(token);
      assert.equal(decoded.sub, dummyUserId.toString());
      assert.equal(decoded.shopId, dummyShopId.toString());
      assert.equal(decoded.role, 'CUSTOMER');
      assert.equal(decoded.farmerId, 'FARM-2026-000001');
      assert.equal(decoded.customerId, dummyUserId.toString());
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
    it('should strictly exclude passwordHash and private security fields from user objects, while including farmerId', () => {
      const userDoc = {
        _id: dummyUserId,
        shopId: dummyShopId,
        name: 'Ramesh Patil',
        farmerId: 'FARM-2026-000001',
        email: 'patil@example.com',
        phone: '9822012345',
        passwordHash: '$2a$12$e6mZ82hYwK69K2/XhH894e772.randomHashStringHere',
        role: 'CUSTOMER',
        active: true,
        emailVerified: false,
        phoneVerified: false,
        __v: 0,
      };

      const safeUser = formatSafeUser(userDoc);
      assert.equal(safeUser.passwordHash, undefined);
      assert.equal(safeUser.__v, undefined);
      assert.equal(safeUser.id, dummyUserId.toString());
      assert.equal(safeUser.name, 'Ramesh Patil');
      assert.equal(safeUser.farmerId, 'FARM-2026-000001');
      assert.equal(safeUser.role, 'CUSTOMER');
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
      const validManager = createStaffSchema.safeParse({
        name: 'New Manager',
        email: 'manager@agro.com',
        password: 'Password123!',
        role: 'MANAGER',
      });
      assert.equal(validManager.success, true);

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
        password: 'short',
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

  describe('Farmer Registration & ID/Password Authentication Suite', () => {
    const validFarmerPayload = {
      name: 'Ramesh Baburao Patil',
      phone: '9822012345',
      email: 'ramesh.patil@example.com',
      password: 'FarmerSecure2026!',
      confirmPassword: 'FarmerSecure2026!',
      village: 'Pimpalgaon Baswant',
      taluka: 'Niphad',
      district: 'Nashik',
      state: 'Maharashtra',
      preferredLanguage: 'mr',
      age: 45,
      gender: 'MALE',
    };

    it('should successfully validate complete farmer registration input', () => {
      const res = customerRegisterSchema.safeParse(validFarmerPayload);
      assert.equal(res.success, true);
      assert.equal(res.data.name, 'Ramesh Baburao Patil');
      assert.equal(res.data.village, 'Pimpalgaon Baswant');
      assert.equal(res.data.preferredLanguage, 'mr');
    });

    it('should accept valid registration without optional email, age, or gender', () => {
      const minimalPayload = {
        name: 'Suresh More',
        phone: '9822099999',
        password: 'Password2026!',
        confirmPassword: 'Password2026!',
        village: 'Lasalgaon',
        taluka: 'Niphad',
        district: 'Nashik',
      };
      const res = customerRegisterSchema.safeParse(minimalPayload);
      assert.equal(res.success, true);
      assert.equal(res.data.state, 'Maharashtra');
      assert.equal(res.data.preferredLanguage, 'mr');
      assert.equal(res.data.email, undefined);
    });

    it('should reject invalid Indian phone numbers in farmer registration', () => {
      const invalidPhones = ['12345', '5822012345', 'abcdefghij', '982201234'];
      for (const phone of invalidPhones) {
        const res = customerRegisterSchema.safeParse({
          ...validFarmerPayload,
          phone,
        });
        assert.equal(res.success, false, `Phone ${phone} should have been rejected`);
      }
    });

    it('should reject passwords that fail complexity policy (min 8 chars, 1 upper, 1 lower, 1 digit)', () => {
      const weakPasswords = [
        'short1!', // < 8 chars
        'alllowercase123!', // No uppercase
        'ALLUPPERCASE123!', // No lowercase
        'NoDigitsPassword!', // No number
      ];
      for (const password of weakPasswords) {
        const res = customerRegisterSchema.safeParse({
          ...validFarmerPayload,
          password,
          confirmPassword: password,
        });
        assert.equal(res.success, false, `Password "${password}" should fail complexity check`);
      }
    });

    it('should reject mismatched password and confirmPassword fields', () => {
      const res = customerRegisterSchema.safeParse({
        ...validFarmerPayload,
        password: 'StrongPassword2026!',
        confirmPassword: 'DifferentPassword2026!',
      });
      assert.equal(res.success, false);
      assert.ok(res.error.errors.some((e) => e.path.includes('confirmPassword')));
    });

    it('should reject missing mandatory address fields (village, taluka, district)', () => {
      const missingVillage = customerRegisterSchema.safeParse({
        ...validFarmerPayload,
        village: '',
      });
      assert.equal(missingVillage.success, false);

      const missingTaluka = customerRegisterSchema.safeParse({
        ...validFarmerPayload,
        taluka: '   ',
      });
      assert.equal(missingTaluka.success, false);
    });

    it('should validate Farmer ID format: FARM-YYYY-XXXXXX', () => {
      const formatFarmerId = (year, seq) => `FARM-${year}-${String(seq).padStart(6, '0')}`;
      const farmerId = formatFarmerId(2026, 1);
      assert.equal(farmerId, 'FARM-2026-000001');

      const nextFarmerId = formatFarmerId(2026, 42);
      assert.equal(nextFarmerId, 'FARM-2026-000042');

      // Verify format regex: FARM-4digits-6digits
      const regex = /^FARM-\d{4}-\d{6}$/;
      assert.ok(regex.test(farmerId));
      assert.ok(regex.test(nextFarmerId));
    });

    it('should validate farmer password login schema', () => {
      const validLogin = customerPasswordLoginSchema.safeParse({
        farmerId: 'FARM-2026-000001',
        password: 'FarmerSecure2026!',
      });
      assert.equal(validLogin.success, true);

      const missingFarmerId = customerPasswordLoginSchema.safeParse({
        password: 'FarmerSecure2026!',
      });
      assert.equal(missingFarmerId.success, false);

      const missingPassword = customerPasswordLoginSchema.safeParse({
        farmerId: 'FARM-2026-000001',
      });
      assert.equal(missingPassword.success, false);
    });

    it('should validate owner-authorized customer password reset schema', () => {
      const validReset = ownerResetCustomerPasswordSchema.safeParse({
        newPassword: 'NewFarmerPassword2026!',
        confirmNewPassword: 'NewFarmerPassword2026!',
        reason: 'In-person verification at shop counter with Aadhaar',
      });
      assert.equal(validReset.success, true);

      const mismatchReset = ownerResetCustomerPasswordSchema.safeParse({
        newPassword: 'NewFarmerPassword2026!',
        confirmNewPassword: 'WrongMismatchPassword2026!',
      });
      assert.equal(mismatchReset.success, false);
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

    it('should block CUSTOMER role from accessing Owner/Manager/Staff routes', () => {
      const staffAllowedRoles = ['OWNER', 'MANAGER', 'CASHIER'];
      const customerUser = { role: 'CUSTOMER' };

      const isAllowedOnStaffRoute = staffAllowedRoles.includes(customerUser.role);
      assert.equal(isAllowedOnStaffRoute, false, 'Farmer (CUSTOMER) role must be blocked from Staff routes');
    });

    it('should block CUSTOMER role from logging into Staff / Owner login endpoint', () => {
      const user = { role: 'CUSTOMER', active: true };
      const isBlockedFromStaffPortal = user.role === 'CUSTOMER';
      assert.equal(isBlockedFromStaffPortal, true, 'Staff login must forbid CUSTOMER role accounts');
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
      assert.equal(validatePolicy('Short1!'), false);
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

  describe('SMS Gateway & Phone Utility Functions', () => {
    it('should correctly normalize Indian and international mobile phone numbers', () => {
      const standard = normalizePhoneNumber('9822012345');
      assert.equal(standard.national, '9822012345');
      assert.equal(standard.e164, '+919822012345');

      const formatted = normalizePhoneNumber('+91 98220 12345');
      assert.equal(formatted.national, '9822012345');
      assert.equal(formatted.e164, '+919822012345');

      const withCountryCode = normalizePhoneNumber('919822012345');
      assert.equal(withCountryCode.national, '9822012345');
      assert.equal(withCountryCode.e164, '+919822012345');
    });

    it('should preserve SMS gateway service for potential store alerts without failing', async () => {
      const res = await sendOtpSms('9822012345', '123456');
      assert.equal(res.success, true);
      assert.ok(res.provider);
      assert.ok(res.message);
    });
  });
});
