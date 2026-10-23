import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  Shop,
  User,
  Customer,
  Category,
  Product,
  Batch,
  StockMovement,
  AuditLog,
} from '../src/models/index.js';

describe('Foundational Mongoose Schemas Validation', () => {
  const dummyShopId = new mongoose.Types.ObjectId();
  const dummyUserId = new mongoose.Types.ObjectId();
  const dummyCategoryId = new mongoose.Types.ObjectId();
  const dummyProductId = new mongoose.Types.ObjectId();

  // Helper for async validation
  const getValidationError = async (doc) => {
    try {
      await doc.validate();
      return undefined;
    } catch (err) {
      return err;
    }
  };

  describe('Shop Model', () => {
    it('should validate valid shop data with defaults', async () => {
      const shop = new Shop({
        name: 'Shivshree Agro Mart',
      });
      const err = await getValidationError(shop);
      assert.equal(err, undefined);
      assert.equal(shop.state, 'Maharashtra');
      assert.equal(shop.country, 'India');
      assert.equal(shop.preferredLanguage, 'mr');
      assert.equal(shop.active, true);
    });

    it('should reject invalid preferredLanguage', async () => {
      const shop = new Shop({
        preferredLanguage: 'fr',
      });
      const err = await getValidationError(shop);
      assert.ok(err?.errors?.preferredLanguage);
    });
  });

  describe('User Model & Roles', () => {
    it('should accept allowed roles: OWNER, MANAGER, CASHIER, CUSTOMER', async () => {
      for (const role of ['OWNER', 'MANAGER', 'CASHIER', 'CUSTOMER']) {
        const user = new User({
          shopId: dummyShopId,
          name: 'Staff Member',
          role,
        });
        const err = await getValidationError(user);
        assert.equal(err, undefined, `Role ${role} should be valid`);
      }
    });

    it('should reject invalid roles', async () => {
      const user = new User({
        shopId: dummyShopId,
        name: 'Attacker',
        role: 'SUPERADMIN',
      });
      const err = await getValidationError(user);
      assert.ok(err?.errors?.role);
    });

    it('should require shopId and name', async () => {
      const user = new User({});
      const err = await getValidationError(user);
      assert.ok(err?.errors?.shopId);
      assert.ok(err?.errors?.name);
    });

    it('should validate email format when provided', async () => {
      const invalidUser = new User({
        shopId: dummyShopId,
        name: 'Test',
        email: 'invalid-email',
      });
      const err = await getValidationError(invalidUser);
      assert.ok(err?.errors?.email);

      const validUser = new User({
        shopId: dummyShopId,
        name: 'Test',
        email: 'Farmer.Patil@Example.Com',
      });
      const validErr = await getValidationError(validUser);
      assert.equal(validErr, undefined);
      assert.equal(validUser.email, 'farmer.patil@example.com');
    });

    it('should accept farmerId and trim/uppercase it on User model', async () => {
      const user = new User({
        shopId: dummyShopId,
        name: 'Farmer Patil',
        role: 'CUSTOMER',
        farmerId: 'farm-2026-000001',
      });
      const err = await getValidationError(user);
      assert.equal(err, undefined);
      assert.equal(user.farmerId, 'FARM-2026-000001');
    });
  });

  describe('Customer Model & Credit Limit', () => {
    it('should validate customer with non-negative integer paise credit limit, farmerId, and Maharashtra state default', async () => {
      const customer = new Customer({
        shopId: dummyShopId,
        name: 'Ramesh Patil',
        farmerId: 'farm-2026-000001',
        village: 'Rahata',
        taluka: 'Rahata',
        district: 'Ahmednagar',
        creditLimitPaise: 5000000, // ₹50,000
        age: 38,
        gender: 'MALE',
      });
      const err = await getValidationError(customer);
      assert.equal(err, undefined);
      assert.equal(customer.creditLimitPaise, 5000000);
      assert.equal(customer.farmerId, 'FARM-2026-000001');
      assert.equal(customer.state, 'Maharashtra');
      assert.equal(customer.age, 38);
      assert.equal(customer.gender, 'MALE');
    });

    it('should reject negative credit limit', async () => {
      const customer = new Customer({
        shopId: dummyShopId,
        name: 'Ramesh Patil',
        creditLimitPaise: -100,
      });
      const err = await getValidationError(customer);
      assert.ok(err?.errors?.creditLimitPaise);
    });

    it('should reject non-integer decimal credit limit', async () => {
      const customer = new Customer({
        shopId: dummyShopId,
        name: 'Ramesh Patil',
        creditLimitPaise: 500.5,
      });
      const err = await getValidationError(customer);
      assert.ok(err?.errors?.creditLimitPaise);
    });

    it('should reject invalid gender or age under 18', async () => {
      const customer = new Customer({
        shopId: dummyShopId,
        name: 'Young Farmer',
        age: 15, // Under 18
        gender: 'INVALID_GENDER',
      });
      const err = await getValidationError(customer);
      assert.ok(err?.errors?.age);
      assert.ok(err?.errors?.gender);
    });
  });

  describe('Category Model', () => {
    it('should validate bilingual category and slug', async () => {
      const category = new Category({
        shopId: dummyShopId,
        nameEn: 'Fertilizers',
        nameMr: 'रासायनिक खते',
        slug: 'fertilizers',
      });
      const err = await getValidationError(category);
      assert.equal(err, undefined);
    });

    it('should require shopId, nameEn, nameMr, and slug', async () => {
      const category = new Category({});
      const err = await getValidationError(category);
      assert.ok(err?.errors?.shopId);
      assert.ok(err?.errors?.nameEn);
      assert.ok(err?.errors?.nameMr);
      assert.ok(err?.errors?.slug);
    });
  });

  describe('Product Model & Units', () => {
    it('should accept valid agricultural base units (KG, G, LITER, ML, PIECE, BAG, PACK)', async () => {
      for (const unit of ['KG', 'G', 'LITER', 'ML', 'PIECE', 'BAG', 'PACK']) {
        const product = new Product({
          shopId: dummyShopId,
          sku: `SKU-${unit}`,
          nameEn: 'Product',
          nameMr: 'उत्पादन',
          categoryId: dummyCategoryId,
          productType: 'FERTILIZER',
          baseUnit: unit,
          packSize: 50,
          reorderLevelBase: 10,
          defaultSellingPricePaise: 120000, // ₹1,200
        });
        const err = await getValidationError(product);
        assert.equal(err, undefined, `Base unit ${unit} should be valid`);
      }
    });

    it('should reject invalid base unit', async () => {
      const product = new Product({
        shopId: dummyShopId,
        sku: 'SKU-001',
        nameEn: 'Product',
        nameMr: 'उत्पादन',
        categoryId: dummyCategoryId,
        productType: 'FERTILIZER',
        baseUnit: 'TONNE',
        packSize: 1,
        defaultSellingPricePaise: 10000,
      });
      const err = await getValidationError(product);
      assert.ok(err?.errors?.baseUnit);
    });

    it('should reject negative selling price', async () => {
      const product = new Product({
        shopId: dummyShopId,
        sku: 'SKU-NEG',
        nameEn: 'Product',
        nameMr: 'उत्पादन',
        categoryId: dummyCategoryId,
        productType: 'SEED',
        baseUnit: 'PACK',
        packSize: 1,
        defaultSellingPricePaise: -500,
      });
      const err = await getValidationError(product);
      assert.ok(err?.errors?.defaultSellingPricePaise);
    });

    it('should reject non-integer selling price (paise)', async () => {
      const product = new Product({
        shopId: dummyShopId,
        sku: 'SKU-DEC',
        nameEn: 'Product',
        nameMr: 'उत्पादन',
        categoryId: dummyCategoryId,
        productType: 'SEED',
        baseUnit: 'PACK',
        packSize: 1,
        defaultSellingPricePaise: 150.75,
      });
      const err = await getValidationError(product);
      assert.ok(err?.errors?.defaultSellingPricePaise);
    });
  });

  describe('Batch Model & Expiry', () => {
    it('should validate batch with active status and integer cost', async () => {
      const batch = new Batch({
        shopId: dummyShopId,
        productId: dummyProductId,
        batchNumber: 'B-2026-001',
        manufacturingDate: new Date('2026-01-01'),
        expiryDate: new Date('2027-12-31'),
        purchaseCostPaisePerBaseUnit: 95000,
        status: 'ACTIVE',
      });
      const err = await getValidationError(batch);
      assert.equal(err, undefined);
    });

    it('should reject invalid batch status', async () => {
      const batch = new Batch({
        shopId: dummyShopId,
        productId: dummyProductId,
        batchNumber: 'B-002',
        purchaseCostPaisePerBaseUnit: 5000,
        status: 'DAMAGED_UNKNOWN',
      });
      const err = await getValidationError(batch);
      assert.ok(err?.errors?.status);
    });
  });

  describe('StockMovement Model & Immutability', () => {
    it('should validate stock movement with non-zero signed quantity', async () => {
      const movement = new StockMovement({
        shopId: dummyShopId,
        productId: dummyProductId,
        movementType: 'INWARD',
        quantityBase: 100,
        referenceType: 'PURCHASE',
        referenceId: 'PUR-001',
        createdBy: dummyUserId,
        reason: 'Received inward shipment from supplier',
      });
      const err = await getValidationError(movement);
      assert.equal(err, undefined);
    });

    it('should reject zero quantity movement', async () => {
      const movement = new StockMovement({
        shopId: dummyShopId,
        productId: dummyProductId,
        movementType: 'ADJUSTMENT_ADD',
        quantityBase: 0,
        referenceType: 'ADJUSTMENT',
        createdBy: dummyUserId,
        reason: 'Zero adjustment test',
      });
      const err = await getValidationError(movement);
      assert.ok(err?.errors?.quantityBase);
    });
  });

  describe('AuditLog Model', () => {
    it('should validate audit log entry', async () => {
      const log = new AuditLog({
        shopId: dummyShopId,
        actorUserId: dummyUserId,
        action: 'PRICE_UPDATE',
        entityType: 'PRODUCT',
        entityId: dummyProductId.toString(),
        reason: 'Annual MRP revision',
        metadata: { oldPricePaise: 40000, newPricePaise: 45000 },
      });
      const err = await getValidationError(log);
      assert.equal(err, undefined);
    });

    it('should require action and entityType', async () => {
      const log = new AuditLog({
        shopId: dummyShopId,
        entityId: '123',
      });
      const err = await getValidationError(log);
      assert.ok(err?.errors?.action);
      assert.ok(err?.errors?.entityType);
    });
  });
});
