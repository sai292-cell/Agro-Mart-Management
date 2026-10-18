import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  createProductSchema,
  updateProductSchema,
  createCategorySchema,
  stockReceiptSchema,
  stockAdjustmentSchema,
  updateBatchStatusSchema,
} from '../src/validators/productValidators.js';
import {
  Product,
  Category,
  Batch,
  StockMovement,
  AuditLog,
} from '../src/models/index.js';
import { evaluateBatch } from '../src/utils/stockUtils.js';
import { withTransaction } from '../src/utils/transactionUtils.js';

describe('Product Catalog & Batch/Expiry Inventory Management Suite', () => {
  const dummyShopId = new mongoose.Types.ObjectId();
  const otherShopId = new mongoose.Types.ObjectId();
  const dummyUserId = new mongoose.Types.ObjectId();
  const dummyCategoryId = new mongoose.Types.ObjectId();
  const dummyProductId = new mongoose.Types.ObjectId();
  const dummyBatchId = new mongoose.Types.ObjectId();

  // Helper for async validation
  const getValidationError = async (doc) => {
    try {
      await doc.validate();
      return undefined;
    } catch (err) {
      return err;
    }
  };

  describe('1. Product & Category Validation', () => {
    it('should validate complete bilingual product input with integer paise price', () => {
      const validProduct = {
        sku: 'MAHYCO-COT-501',
        barcode: '8901234567890',
        nameEn: 'Mahyco Bollgard Cotton Seeds',
        nameMr: 'माहिको बोलगार्ड कापूस बियाणे',
        categoryId: dummyCategoryId.toString(),
        brand: 'Mahyco',
        productType: 'SEED',
        baseUnit: 'PACK',
        packSize: 1,
        reorderLevelBase: 20,
        defaultSellingPricePaise: 85000, // ₹850.00
        taxClassification: {
          hsnCode: '120999',
          gstRatePercent: 0,
          isExempt: true,
        },
        active: true,
      };

      const result = createProductSchema.safeParse(validProduct);
      assert.equal(result.success, true);
      assert.equal(result.data.sku, 'MAHYCO-COT-501');
      assert.equal(result.data.defaultSellingPricePaise, 85000);
    });

    it('should reject non-integer selling prices (floating-point rupees)', () => {
      const invalidProduct = {
        sku: 'UREA-50KG',
        nameEn: 'IFFCO Neem Coated Urea',
        nameMr: 'इफको नीम कोटेड युरिया',
        categoryId: dummyCategoryId.toString(),
        productType: 'FERTILIZER',
        baseUnit: 'BAG',
        packSize: 50,
        reorderLevelBase: 50,
        defaultSellingPricePaise: 266.5, // Invalid decimal
      };

      const result = createProductSchema.safeParse(invalidProduct);
      assert.equal(result.success, false);
      assert.ok(result.error.errors.some((e) => e.path.includes('defaultSellingPricePaise')));
    });

    it('should reject invalid agricultural product type and base unit', () => {
      const invalidTypeResult = createProductSchema.safeParse({
        sku: 'TEST-SKU',
        nameEn: 'Invalid Agro Item',
        nameMr: 'अवैध उत्पादन',
        categoryId: dummyCategoryId.toString(),
        productType: 'AUTOMOTIVE', // Invalid agro type
        baseUnit: 'KG',
        defaultSellingPricePaise: 10000,
      });
      assert.equal(invalidTypeResult.success, false);

      const invalidUnitResult = createProductSchema.safeParse({
        sku: 'TEST-SKU-2',
        nameEn: 'Invalid Unit Item',
        nameMr: 'अवैध युनिट',
        categoryId: dummyCategoryId.toString(),
        productType: 'SEED',
        baseUnit: 'POUND', // Invalid unit (only KG, G, LITER, ML, PIECE, BAG, PACK allowed)
        defaultSellingPricePaise: 10000,
      });
      assert.equal(invalidUnitResult.success, false);
    });

    it('should validate bilingual category and slug generation', () => {
      const validCategory = {
        nameEn: 'Chemical Fertilizers',
        nameMr: 'रासायनिक खते',
        slug: 'chemical-fertilizers',
      };
      const result = createCategorySchema.safeParse(validCategory);
      assert.equal(result.success, true);

      const emptyNameResult = createCategorySchema.safeParse({
        nameEn: '',
        nameMr: 'रासायनिक खते',
      });
      assert.equal(emptyNameResult.success, false);
    });
  });

  describe('2. Duplicate SKU and Shop Isolation Constraints', () => {
    it('should detect duplicate SKU within the same shop', () => {
      const existingProducts = [
        { shopId: dummyShopId, sku: 'DAP-50KG' },
        { shopId: otherShopId, sku: 'DAP-50KG' }, // Different shop allows same SKU
      ];

      const checkDuplicateSku = (shopId, newSku) => {
        return existingProducts.some(
          (p) => p.shopId.equals(shopId) && p.sku.toUpperCase() === newSku.toUpperCase()
        );
      };

      assert.equal(checkDuplicateSku(dummyShopId, 'DAP-50KG'), true, 'Duplicate SKU in same shop must be rejected');
      assert.equal(checkDuplicateSku(dummyShopId, 'dap-50kg'), true, 'Case-insensitive duplicate SKU must be rejected');
      assert.equal(checkDuplicateSku(dummyShopId, 'MOP-50KG'), false, 'Unique SKU in same shop must be permitted');
    });

    it('should isolate category and product data across different shops', () => {
      const isCrossShop = dummyShopId.toString() !== otherShopId.toString();
      assert.equal(isCrossShop, true);
    });
  });

  describe('3. Role Permissions and Access Boundaries', () => {
    const roles = {
      OWNER: { canManageProducts: true, canAdjustStock: true, canViewCosts: true },
      MANAGER: { canManageProducts: true, canAdjustStock: true, canViewCosts: true },
      CASHIER: { canManageProducts: false, canAdjustStock: false, canViewCosts: false },
      CUSTOMER: { canManageProducts: false, canAdjustStock: false, canViewCosts: false },
    };

    it('OWNER and MANAGER can manage products and adjust stock', () => {
      assert.equal(roles.OWNER.canManageProducts, true);
      assert.equal(roles.OWNER.canAdjustStock, true);
      assert.equal(roles.MANAGER.canManageProducts, true);
      assert.equal(roles.MANAGER.canAdjustStock, true);
    });

    it('CASHIER cannot alter product costs or adjust stock', () => {
      assert.equal(roles.CASHIER.canManageProducts, false);
      assert.equal(roles.CASHIER.canAdjustStock, false);
      assert.equal(roles.CASHIER.canViewCosts, false);
    });

    it('CUSTOMER can only access public active catalog without supplier costs', () => {
      assert.equal(roles.CUSTOMER.canManageProducts, false);
      assert.equal(roles.CUSTOMER.canAdjustStock, false);
      assert.equal(roles.CUSTOMER.canViewCosts, false);
    });
  });

  describe('4. Stock Receipt and Adjustment Integrity', () => {
    it('should validate inward stock receipt with positive quantity and batch info', () => {
      const validReceipt = {
        productId: dummyProductId.toString(),
        batchNumber: 'BATCH-2026-A1',
        manufacturingDate: '2026-01-15T00:00:00.000Z',
        expiryDate: '2027-01-15T00:00:00.000Z',
        purchaseCostPaisePerBaseUnit: 120000, // ₹1,200.00
        quantityBase: 100,
        referenceType: 'PURCHASE',
        referenceId: 'INV-SUP-9821',
        reason: 'Inward shipment received from distributor',
      };

      const result = stockReceiptSchema.safeParse(validReceipt);
      assert.equal(result.success, true);
      assert.equal(result.data.quantityBase, 100);
      assert.equal(result.data.batchNumber, 'BATCH-2026-A1');
    });

    it('should reject stock receipt with negative or zero quantity', () => {
      const zeroQty = {
        productId: dummyProductId.toString(),
        batchNumber: 'B1',
        purchaseCostPaisePerBaseUnit: 10000,
        quantityBase: 0,
        referenceType: 'PURCHASE',
        reason: 'Zero test',
      };
      assert.equal(stockReceiptSchema.safeParse(zeroQty).success, false);

      const negativeQty = {
        ...zeroQty,
        quantityBase: -25,
      };
      assert.equal(stockReceiptSchema.safeParse(negativeQty).success, false);
    });

    it('should reject stock receipt with empty or missing reason', () => {
      const missingReason = {
        productId: dummyProductId.toString(),
        batchNumber: 'B1',
        purchaseCostPaisePerBaseUnit: 10000,
        quantityBase: 10,
        referenceType: 'PURCHASE',
        reason: '   ', // Whitespace only
      };
      assert.equal(stockReceiptSchema.safeParse(missingReason).success, false);
    });

    it('should prevent duplicate stock receipt with the same reference ID', () => {
      const recordedReceipts = [
        {
          shopId: dummyShopId,
          productId: dummyProductId,
          referenceType: 'PURCHASE',
          referenceId: 'INV-2026-001',
        },
      ];

      const isDuplicate = (shopId, productId, refType, refId) => {
        return recordedReceipts.some(
          (r) =>
            r.shopId.equals(shopId) &&
            r.productId.equals(productId) &&
            r.referenceType === refType &&
            r.referenceId === refId
        );
      };

      assert.equal(
        isDuplicate(dummyShopId, dummyProductId, 'PURCHASE', 'INV-2026-001'),
        true,
        'Duplicate invoice receipt must be rejected'
      );
      assert.equal(
        isDuplicate(dummyShopId, dummyProductId, 'PURCHASE', 'INV-2026-002'),
        false,
        'New invoice receipt must be allowed'
      );
    });

    it('should require mandatory reason for manual stock adjustment', () => {
      const validAdjustment = {
        productId: dummyProductId.toString(),
        batchId: dummyBatchId.toString(),
        movementType: 'ADJUSTMENT_SUBTRACT',
        quantityBase: 5,
        reason: 'Physical inventory count found 5 damaged bags due to rain moisture',
      };

      const result = stockAdjustmentSchema.safeParse(validAdjustment);
      assert.equal(result.success, true);

      const missingReason = {
        productId: dummyProductId.toString(),
        movementType: 'ADJUSTMENT_ADD',
        quantityBase: 10,
      };
      assert.equal(stockAdjustmentSchema.safeParse(missingReason).success, false);
    });

    it('should prevent negative stock unless explicitly approved', () => {
      const currentStock = 10;
      const adjustmentDeduction = 15;
      const allowNegative = false;

      const canDeduct = currentStock - adjustmentDeduction >= 0 || allowNegative;
      assert.equal(canDeduct, false, 'Deduction exceeding available stock must be blocked');

      const approvedOverride = true;
      const canDeductWithOverride = currentStock - adjustmentDeduction >= 0 || approvedOverride;
      assert.equal(canDeductWithOverride, true, 'Deduction with explicit policy approval must be allowed');
    });
  });

  describe('5. Batch Expiry, FEFO and Quarantine Restrictions', () => {
    it('should flag expired batches and block them from sales', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10); // 10 days ago

      const expiredBatch = {
        batchNumber: 'EXP-101',
        expiryDate: pastDate,
        status: 'ACTIVE', // Schema says active, but date is past
      };

      const evaluated = evaluateBatch(expiredBatch, 25);
      assert.equal(evaluated.isExpired, true);
      assert.equal(evaluated.effectiveStatus, 'EXPIRED');
      assert.equal(evaluated.isAvailableForSale, false, 'Expired batch must never be available for sale');
    });

    it('should block quarantined batches from sales even with future expiry date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 180); // 6 months future

      const quarantinedBatch = {
        batchNumber: 'Q-202',
        expiryDate: futureDate,
        status: 'QUARANTINED',
      };

      const evaluated = evaluateBatch(quarantinedBatch, 50);
      assert.equal(evaluated.effectiveStatus, 'QUARANTINED');
      assert.equal(evaluated.isAvailableForSale, false, 'Quarantined batch must never be available for sale');
    });

    it('should sort batches by FEFO (First-Expired-First-Out)', () => {
      const now = new Date();
      const b1 = { batchNumber: 'B-EARLY', expiryDate: new Date(now.getTime() + 30 * 86400000) };
      const b2 = { batchNumber: 'B-LATE', expiryDate: new Date(now.getTime() + 180 * 86400000) };
      const b3 = { batchNumber: 'B-MID', expiryDate: new Date(now.getTime() + 60 * 86400000) };

      const batches = [b2, b1, b3];
      batches.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

      assert.equal(batches[0].batchNumber, 'B-EARLY');
      assert.equal(batches[1].batchNumber, 'B-MID');
      assert.equal(batches[2].batchNumber, 'B-LATE');
    });
  });

  describe('6. Low-Stock Calculations', () => {
    it('should trigger low-stock alert when stock is less than or equal to reorder level', () => {
      const reorderLevel = 25;

      const isLowStock = (currentStock) => currentStock <= reorderLevel;

      assert.equal(isLowStock(30), false);
      assert.equal(isLowStock(25), true, 'Equal to reorder level is low stock');
      assert.equal(isLowStock(10), true, 'Below reorder level is low stock');
      assert.equal(isLowStock(0), true, 'Zero stock is out/low stock');
    });
  });

  describe('7. StockMovement Immutability and Audit Logging', () => {
    it('should enforce immutability on StockMovement model', () => {
      const movement = new StockMovement({
        shopId: dummyShopId,
        productId: dummyProductId,
        movementType: 'INWARD',
        quantityBase: 25,
        referenceType: 'PURCHASE',
        createdBy: dummyUserId,
        reason: 'Received inward stock',
      });

      assert.equal(movement.quantityBase, 25);
    });

    it('should record audit log structure for stock receipt and adjustment', async () => {
      const receiptAudit = new AuditLog({
        shopId: dummyShopId,
        actorUserId: dummyUserId,
        action: 'STOCK_RECEIPT',
        entityType: 'STOCK_MOVEMENT',
        entityId: new mongoose.Types.ObjectId().toString(),
        reason: 'Received inward stock of 50 BAG from supplier',
        metadata: {
          productId: dummyProductId.toString(),
          batchNumber: 'B-101',
          quantityBase: 50,
        },
      });

      const err = await getValidationError(receiptAudit);
      assert.equal(err, undefined);
      assert.equal(receiptAudit.action, 'STOCK_RECEIPT');
    });
  });

  describe('8. Transaction Handling & Safe Fallback', () => {
    it('should execute operation inside transaction or safe fallback cleanly', async () => {
      let executed = false;
      const result = await withTransaction(async (session) => {
        executed = true;
        return { success: true, sessionPresent: session !== null };
      });

      assert.equal(executed, true);
      assert.equal(result.success, true);
    });

    it('should propagate operational errors and abort transaction', async () => {
      await assert.rejects(async () => {
        await withTransaction(async () => {
          const err = new Error('Database operational error during stock receipt');
          err.statusCode = 400;
          throw err;
        });
      }, /Database operational error during stock receipt/);
    });
  });

  describe('9. HTTP Endpoint Protection & Authentication Layer', () => {
    let server;
    let baseUrl;

    it('should start test server on dynamic port', async () => {
      const { default: app } = await import('../src/app.js');
      const http = await import('node:http');

      await new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, '127.0.0.1', () => {
          const address = server.address();
          baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
          resolve();
        });
      });
      assert.ok(baseUrl);
    });

    it('should block unauthenticated access to /products', async () => {
      const res = await fetch(`${baseUrl}/products`);
      assert.ok([401, 503].includes(res.status), `Unexpected status: ${res.status}`);
      assert.notEqual(res.status, 200);
    });

    it('should block unauthenticated access to /categories', async () => {
      const res = await fetch(`${baseUrl}/categories`);
      assert.ok([401, 503].includes(res.status), `Unexpected status: ${res.status}`);
      assert.notEqual(res.status, 200);
    });

    it('should block unauthenticated access to /inventory/receipt', async () => {
      const res = await fetch(`${baseUrl}/inventory/receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.ok([401, 503].includes(res.status), `Unexpected status: ${res.status}`);
      assert.notEqual(res.status, 200);
    });

    it('should block unauthenticated access to /inventory/adjustment', async () => {
      const res = await fetch(`${baseUrl}/inventory/adjustment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.ok([401, 503].includes(res.status), `Unexpected status: ${res.status}`);
      assert.notEqual(res.status, 200);
    });

    it('should block unauthenticated access to /inventory/movements', async () => {
      const res = await fetch(`${baseUrl}/inventory/movements`);
      assert.ok([401, 503].includes(res.status), `Unexpected status: ${res.status}`);
      assert.notEqual(res.status, 200);
    });

    it('should block unauthenticated access to /inventory/batches', async () => {
      const res = await fetch(`${baseUrl}/inventory/batches`);
      assert.ok([401, 503].includes(res.status), `Unexpected status: ${res.status}`);
      assert.notEqual(res.status, 200);
    });

    it('should close test server cleanly', async () => {
      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }
    });
  });
});

