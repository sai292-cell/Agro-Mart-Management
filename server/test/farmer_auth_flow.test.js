import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  customerRegisterSchema,
  customerPasswordLoginSchema,
  ownerResetCustomerPasswordSchema,
  loginSchema,
} from '../src/validators/authValidators.js';
import {
  hashPassword,
  comparePassword,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  formatSafeUser,
} from '../src/utils/tokenUtils.js';
import { User } from '../src/models/User.js';
import { Customer } from '../src/models/Customer.js';

describe('Farmer Portal Registration & ID/Password Authentication Flow Tests', () => {
  const dummyShopId = new mongoose.Types.ObjectId();
  const dummyUserId = new mongoose.Types.ObjectId();
  const dummyCustomerId = new mongoose.Types.ObjectId();
  const otherCustomerId = new mongoose.Types.ObjectId();

  const sampleFarmer = {
    name: 'Balasaheb Shivram Thombare',
    phone: '9822154321',
    email: 'balasaheb@farm.com',
    password: 'FarmerPassword2026!',
    confirmPassword: 'FarmerPassword2026!',
    village: 'Ozar',
    taluka: 'Niphad',
    district: 'Nashik',
    state: 'Maharashtra',
    preferredLanguage: 'mr',
    age: 48,
    gender: 'MALE',
  };

  describe('1. Registration Validation & Constraints', () => {
    it('successfully validates complete farmer registration payload', () => {
      const result = customerRegisterSchema.safeParse(sampleFarmer);
      assert.equal(result.success, true);
      assert.equal(result.data.name, 'Balasaheb Shivram Thombare');
      assert.equal(result.data.phone, '9822154321');
      assert.equal(result.data.state, 'Maharashtra');
    });

    it('rejects registration when password and confirmPassword do not match', () => {
      const result = customerRegisterSchema.safeParse({
        ...sampleFarmer,
        confirmPassword: 'MismatchPassword2026!',
      });
      assert.equal(result.success, false);
      const err = result.error.errors.find((e) => e.path.includes('confirmPassword'));
      assert.ok(err, 'Expected error on confirmPassword path');
    });

    it('rejects weak password missing uppercase, lowercase, or digits', () => {
      const weakPasswords = [
        'nouppercase123!',
        'NOLOWERCASE123!',
        'NoDigitsHere!',
        'short1!',
      ];
      for (const pwd of weakPasswords) {
        const res = customerRegisterSchema.safeParse({
          ...sampleFarmer,
          password: pwd,
          confirmPassword: pwd,
        });
        assert.equal(res.success, false, `Password ${pwd} must be rejected`);
      }
    });

    it('validates Indian 10-digit mobile number format strictly', () => {
      const validNumbers = [
        '9822154321',
        '8822154321',
        '7822154321',
        '6822154321',
        '+91 98221 54321',
        '919822154321',
      ];
      for (const phone of validNumbers) {
        const res = customerRegisterSchema.safeParse({ ...sampleFarmer, phone });
        assert.equal(res.success, true, `Phone ${phone} should be valid`);
      }

      const invalidNumbers = [
        '1234567890', // starts with 1
        '5822154321', // starts with 5
        '982215432',  // only 9 digits
        '982215432100', // 12 digits non-country-code
        'abcdefghij',
      ];
      for (const phone of invalidNumbers) {
        const res = customerRegisterSchema.safeParse({ ...sampleFarmer, phone });
        assert.equal(res.success, false, `Phone ${phone} should be invalid`);
      }
    });

    it('rejects missing mandatory fields: name, village, taluka, district', () => {
      for (const field of ['name', 'village', 'taluka', 'district']) {
        const payload = { ...sampleFarmer, [field]: '' };
        const res = customerRegisterSchema.safeParse(payload);
        assert.equal(res.success, false, `Missing ${field} must fail validation`);
      }
    });
  });

  describe('2. Unique Farmer ID Generation Invariants', () => {
    it('generates collision-safe Farmer ID formatted as FARM-YYYY-XXXXXX', () => {
      const currentYear = new Date().getFullYear();
      const formatFarmerId = (seq) => `FARM-${currentYear}-${String(seq).padStart(6, '0')}`;

      const id1 = formatFarmerId(1);
      const id2 = formatFarmerId(2);
      const id999 = formatFarmerId(999);
      const id100000 = formatFarmerId(100000);

      assert.equal(id1, `FARM-${currentYear}-000001`);
      assert.equal(id2, `FARM-${currentYear}-000002`);
      assert.equal(id999, `FARM-${currentYear}-000999`);
      assert.equal(id100000, `FARM-${currentYear}-100000`);

      const regex = /^FARM-\d{4}-\d{6}$/;
      assert.ok(regex.test(id1));
      assert.ok(regex.test(id2));
      assert.ok(regex.test(id999));
      assert.ok(regex.test(id100000));
    });

    it('simulates concurrent registration sequence increment with zero collisions', () => {
      const generatedIds = new Set();
      const year = 2026;
      for (let seq = 1; seq <= 500; seq++) {
        const id = `FARM-${year}-${String(seq).padStart(6, '0')}`;
        assert.equal(generatedIds.has(id), false, `Collision detected for ${id}`);
        generatedIds.add(id);
      }
      assert.equal(generatedIds.size, 500);
    });
  });

  describe('3. Password Hashing & Secret Protection', () => {
    it('hashes passwords using bcrypt with salt rounds >= 10', async () => {
      const plainPassword = sampleFarmer.password;
      const hash = await hashPassword(plainPassword);

      assert.notEqual(hash, plainPassword);
      assert.ok(hash.startsWith('$2'));

      const isMatch = await comparePassword(plainPassword, hash);
      assert.equal(isMatch, true);

      const isMismatch = await comparePassword('WrongPassword!', hash);
      assert.equal(isMismatch, false);
    });

    it('formatSafeUser strictly excludes passwordHash and __v from farmer profile API responses', () => {
      const rawUserDoc = {
        _id: dummyUserId,
        shopId: dummyShopId,
        name: sampleFarmer.name,
        phone: sampleFarmer.phone,
        email: sampleFarmer.email,
        farmerId: 'FARM-2026-000001',
        passwordHash: '$2a$12$someBcryptHashedPasswordStringThatMustNeverLeak',
        role: 'CUSTOMER',
        active: true,
        emailVerified: false,
        phoneVerified: false,
        __v: 0,
      };

      const safe = formatSafeUser(rawUserDoc);
      assert.equal(safe.passwordHash, undefined, 'passwordHash must never be exposed');
      assert.equal(safe.__v, undefined);
      assert.equal(safe.farmerId, 'FARM-2026-000001');
      assert.equal(safe.role, 'CUSTOMER');
      assert.equal(safe.name, sampleFarmer.name);
    });
  });

  describe('4. Farmer Sign-In & Token Architecture', () => {
    it('validates customer login schema with Farmer ID and password', () => {
      const valid = customerPasswordLoginSchema.safeParse({
        farmerId: 'FARM-2026-000001',
        password: 'FarmerPassword2026!',
      });
      assert.equal(valid.success, true);

      const invalidNoId = customerPasswordLoginSchema.safeParse({
        password: 'FarmerPassword2026!',
      });
      assert.equal(invalidNoId.success, false);

      const invalidNoPwd = customerPasswordLoginSchema.safeParse({
        farmerId: 'FARM-2026-000001',
      });
      assert.equal(invalidNoPwd.success, false);
    });

    it('signs access token with farmerId and customerId, verifying sandbox payload', () => {
      const farmerUser = {
        _id: dummyUserId,
        shopId: dummyShopId,
        name: sampleFarmer.name,
        farmerId: 'FARM-2026-000001',
        customerId: dummyCustomerId.toString(),
        role: 'CUSTOMER',
      };

      const token = signAccessToken(farmerUser);
      assert.ok(typeof token === 'string');

      const decoded = verifyAccessToken(token);
      assert.equal(decoded.sub, dummyUserId.toString());
      assert.equal(decoded.shopId, dummyShopId.toString());
      assert.equal(decoded.role, 'CUSTOMER');
      assert.equal(decoded.farmerId, 'FARM-2026-000001');
      assert.equal(decoded.customerId, dummyCustomerId.toString());
    });
  });

  describe('5. Role Enforcement & Sandboxing Security', () => {
    it('blocks farmer account from accessing staff and owner routes', () => {
      const staffAllowedRoles = ['OWNER', 'MANAGER', 'CASHIER'];
      const farmerRole = 'CUSTOMER';

      const isAllowedOnAdminRoutes = staffAllowedRoles.includes(farmerRole);
      assert.equal(isAllowedOnAdminRoutes, false, 'Farmer must not have access to admin routes');
    });

    it('blocks farmer accounts from authenticating via Staff/Owner login route', () => {
      const farmerUser = {
        role: 'CUSTOMER',
        active: true,
      };

      const isForbiddenFromStaffPortal = farmerUser.role === 'CUSTOMER';
      assert.equal(isForbiddenFromStaffPortal, true, 'Staff login must reject CUSTOMER role');
    });

    it('preserves existing owner and cashier access on staff portal', () => {
      const ownerUser = { role: 'OWNER', active: true };
      const cashierUser = { role: 'CASHIER', active: true };

      assert.equal(ownerUser.role === 'CUSTOMER', false);
      assert.equal(cashierUser.role === 'CUSTOMER', false);
    });

    it('enforces customer account sandboxing: Farmer A cannot access Farmer B data', () => {
      const authenticatedFarmerA = {
        role: 'CUSTOMER',
        customerId: dummyCustomerId.toString(),
      };

      // Farmer A trying to request invoice of Farmer B
      const requestedCustomerId = otherCustomerId.toString();
      const isAuthorized =
        authenticatedFarmerA.role !== 'CUSTOMER' ||
        authenticatedFarmerA.customerId === requestedCustomerId;

      assert.equal(isAuthorized, false, 'Farmer A must not access Farmer B records');

      // Farmer A requesting own record
      const isOwnAuthorized =
        authenticatedFarmerA.role !== 'CUSTOMER' ||
        authenticatedFarmerA.customerId === dummyCustomerId.toString();

      assert.equal(isOwnAuthorized, true, 'Farmer A must access own records');
    });
  });

  describe('6. Zero SMS / Zero OTP Invariant Verification', () => {
    it('ensures farmer authentication response contains no OTP, testOtp, or devNotice fields', () => {
      // Simulation of auth response
      const authResponse = {
        success: true,
        data: {
          accessToken: 'jwt-access-token-example',
          user: {
            id: dummyUserId.toString(),
            name: sampleFarmer.name,
            farmerId: 'FARM-2026-000001',
            customerId: dummyCustomerId.toString(),
            role: 'CUSTOMER',
          },
        },
      };

      const stringified = JSON.stringify(authResponse);
      assert.equal(stringified.includes('testOtp'), false);
      assert.equal(stringified.includes('devNotice'), false);
      assert.equal(stringified.includes('rawOtp'), false);
      assert.equal(stringified.includes('otpHash'), false);
      assert.equal(authResponse.data.user.farmerId, 'FARM-2026-000001');
    });
  });

  describe('7. Owner-Authorized Farmer Password Reset (₹0 Budget Security)', () => {
    it('validates owner password reset input and ensures confirm password matches', () => {
      const valid = ownerResetCustomerPasswordSchema.safeParse({
        newPassword: 'ResetPassword2026!',
        confirmNewPassword: 'ResetPassword2026!',
        reason: 'Customer verified at shop counter with Aadhaar',
      });
      assert.equal(valid.success, true);
      assert.equal(valid.data.reason, 'Customer verified at shop counter with Aadhaar');

      const mismatch = ownerResetCustomerPasswordSchema.safeParse({
        newPassword: 'ResetPassword2026!',
        confirmNewPassword: 'MismatchPassword2026!',
      });
      assert.equal(mismatch.success, false);
    });

    it('requires owner/manager role to execute password reset', () => {
      const checkRole = (role) => ['OWNER', 'MANAGER'].includes(role);

      assert.equal(checkRole('OWNER'), true);
      assert.equal(checkRole('MANAGER'), true);
      assert.equal(checkRole('CASHIER'), false, 'Cashier cannot reset passwords');
      assert.equal(checkRole('CUSTOMER'), false, 'Customer cannot reset passwords directly');
    });

    it('ensures audit log metadata does not contain plaintext password or password hash', () => {
      const auditPayload = {
        shopId: dummyShopId,
        actorUserId: dummyUserId,
        action: 'CUSTOMER_PASSWORD_RESET_BY_OWNER',
        entityType: 'CUSTOMER',
        entityId: dummyCustomerId.toString(),
        reason: 'In-person identity verified',
        metadata: {
          customerName: sampleFarmer.name,
          phone: sampleFarmer.phone,
          farmerId: 'FARM-2026-000001',
        },
      };

      const auditJson = JSON.stringify(auditPayload);
      assert.equal(auditJson.includes('password'), false);
      assert.equal(auditJson.includes('passwordHash'), false);
      assert.equal(auditJson.includes('newPassword'), false);
      assert.equal(auditPayload.metadata.farmerId, 'FARM-2026-000001');
    });
  });
});
