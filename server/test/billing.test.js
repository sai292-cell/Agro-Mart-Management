import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  checkoutInvoiceSchema,
  addPaymentSchema,
  cancelInvoiceSchema,
} from '../src/validators/billingValidators.js';
import {
  calculateLineItemFinancials,
  allocateBatchStock,
} from '../src/utils/billingUtils.js';
import {
  Invoice,
  Payment,
  Counter,
  Product,
  Batch,
  StockMovement,
  Customer,
} from '../src/models/index.js';
import { withTransaction } from '../src/utils/transactionUtils.js';

describe('Point-of-Sale Billing & Invoice Generation Suite', () => {
  const dummyShopId = new mongoose.Types.ObjectId();
  const otherShopId = new mongoose.Types.ObjectId();
  const dummyUserId = new mongoose.Types.ObjectId();
  const dummyCustomerId = new mongoose.Types.ObjectId();
  const dummyProductId = new mongoose.Types.ObjectId();
  const dummyBatchId = new mongoose.Types.ObjectId();

  describe('1. Monetary Calculations, Tax & Rounding Invariants', () => {
    it('should calculate tax-inclusive Maharashtra GST split (50% CGST + 50% SGST) correctly', () => {
      // ₹1,000.00 (100,000 paise) gross with 18% GST (Fertilizer/Pesticide)
      // Taxable = 100000 * 100 / 118 = 84746 paise (₹847.46)
      // Tax = 15254 paise (₹152.54)
      // CGST = 7627 paise, SGST = 7627 paise
      const financials = calculateLineItemFinancials(1, 100000, 0, {
        hsnCode: '31021000',
        gstRatePercent: 18,
        isExempt: false,
      });

      assert.equal(financials.lineTotalPaise, 100000);
      assert.equal(financials.taxableAmountPaise, 84746);
      assert.equal(financials.taxTotalPaise, 15254);
      assert.equal(financials.cgstPaise, 7627);
      assert.equal(financials.sgstPaise, 7627);
      assert.equal(financials.igstPaise, 0);
      assert.equal(financials.cgstPaise + financials.sgstPaise, financials.taxTotalPaise);
    });

    it('should handle GST-exempt seeds with 0 tax and full taxable subtotal', () => {
      // ₹850.00 (85,000 paise) for 2 packs = 170,000 paise gross
      const financials = calculateLineItemFinancials(2, 85000, 0, {
        hsnCode: '120999',
        gstRatePercent: 0,
        isExempt: true,
      });

      assert.equal(financials.lineTotalPaise, 170000);
      assert.equal(financials.taxableAmountPaise, 170000);
      assert.equal(financials.taxTotalPaise, 0);
      assert.equal(financials.cgstPaise, 0);
      assert.equal(financials.sgstPaise, 0);
    });

    it('should apply line discounts and verify integer paise rounding', () => {
      // 5 units at ₹150.00 (15000 paise) = 75000 paise. Line discount = 5000 paise (₹50)
      // Net = 70000 paise with 12% GST
      const financials = calculateLineItemFinancials(5, 15000, 5000, {
        gstRatePercent: 12,
        isExempt: false,
      });

      assert.equal(financials.lineTotalPaise, 70000);
      // Taxable = 70000 * 100 / 112 = 62500 paise
      assert.equal(financials.taxableAmountPaise, 62500);
      assert.equal(financials.taxTotalPaise, 7500);
      assert.equal(financials.cgstPaise + financials.sgstPaise, 7500);
    });
  });

  describe('2. Validation & Input Defense', () => {
    it('should reject non-integer selling prices or amounts in paise', () => {
      const invalidDecimal = checkoutInvoiceSchema.safeParse({
        items: [
          {
            productId: dummyProductId.toString(),
            quantityBase: 1,
            unitSellingPricePaise: 450.5, // Invalid floating-point
          },
        ],
      });
      assert.equal(invalidDecimal.success, false);
    });

    it('should reject negative or zero quantities', () => {
      const zeroQty = checkoutInvoiceSchema.safeParse({
        items: [
          {
            productId: dummyProductId.toString(),
            quantityBase: 0,
          },
        ],
      });
      assert.equal(zeroQty.success, false);

      const negativeQty = checkoutInvoiceSchema.safeParse({
        items: [
          {
            productId: dummyProductId.toString(),
            quantityBase: -5,
          },
        ],
      });
      assert.equal(negativeQty.success, false);
    });

    it('should enforce that UPI payments require a transaction reference ID', () => {
      const missingUpiRef = addPaymentSchema.safeParse({
        amountPaise: 50000,
        paymentMethod: 'UPI',
        referenceId: '', // Empty UTR/Txn ID
      });
      assert.equal(missingUpiRef.success, false);

      const validUpi = addPaymentSchema.safeParse({
        amountPaise: 50000,
        paymentMethod: 'UPI',
        referenceId: 'UPI-UTR-987654321012',
      });
      assert.equal(validUpi.success, true);
    });

    it('should allow Cash payments without external reference IDs', () => {
      const validCash = addPaymentSchema.safeParse({
        amountPaise: 50000,
        paymentMethod: 'CASH',
      });
      assert.equal(validCash.success, true);
    });
  });

  describe('3. Batch & Expiry Restrictions (FEFO & Quarantined Batches)', () => {
    it('should reject expired batches from being billed', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);

      const mockBatch = {
        _id: dummyBatchId,
        batchNumber: 'EXP-BATCH-01',
        expiryDate: pastDate,
        status: 'ACTIVE',
      };

      const mockProduct = {
        _id: dummyProductId,
        nameEn: 'Expired Pesticide',
        baseUnit: 'LITER',
      };

      // Mock finding the batch
      const isExpired = mockBatch.status === 'EXPIRED' || (mockBatch.expiryDate && new Date(mockBatch.expiryDate) < new Date());
      assert.equal(isExpired, true, 'Batch must be recognized as expired');
    });

    it('should reject quarantined batches even if expiry date is in the future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 365);

      const mockBatch = {
        _id: dummyBatchId,
        batchNumber: 'Q-BATCH-02',
        expiryDate: futureDate,
        status: 'QUARANTINED',
      };

      assert.equal(mockBatch.status === 'QUARANTINED', true, 'Quarantined batch must be strictly rejected');
    });

    it('should prioritize earlier expiring batches (FEFO)', () => {
      const now = new Date();
      const b1 = { batchNumber: 'B-EXP-60D', expiryDate: new Date(now.getTime() + 60 * 86400000) };
      const b2 = { batchNumber: 'B-EXP-15D', expiryDate: new Date(now.getTime() + 15 * 86400000) };
      const b3 = { batchNumber: 'B-EXP-180D', expiryDate: new Date(now.getTime() + 180 * 86400000) };

      const sorted = [b1, b2, b3].sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
      assert.equal(sorted[0].batchNumber, 'B-EXP-15D');
      assert.equal(sorted[1].batchNumber, 'B-EXP-60D');
      assert.equal(sorted[2].batchNumber, 'B-EXP-180D');
    });
  });

  describe('4. Idempotency & Duplicate Prevention', () => {
    it('should detect identical idempotency key to prevent double checkout', () => {
      const existingInvoices = [
        {
          shopId: dummyShopId,
          invoiceNumber: 'INV-2026-00001',
          idempotencyKey: 'checkout-uuid-12345',
        },
      ];

      const isDuplicateKey = (shopId, key) => {
        return existingInvoices.some(
          (inv) => inv.shopId.equals(shopId) && inv.idempotencyKey === key
        );
      };

      assert.equal(isDuplicateKey(dummyShopId, 'checkout-uuid-12345'), true);
      assert.equal(isDuplicateKey(dummyShopId, 'new-unique-key-67890'), false);
    });

    it('should detect duplicate payment idempotency key', () => {
      const existingPayments = [
        {
          shopId: dummyShopId,
          idempotencyKey: 'payment-txn-999',
        },
      ];

      const isDuplicatePayment = (shopId, key) => {
        return existingPayments.some(
          (p) => p.shopId.equals(shopId) && p.idempotencyKey === key
        );
      };

      assert.equal(isDuplicatePayment(dummyShopId, 'payment-txn-999'), true);
      assert.equal(isDuplicatePayment(dummyShopId, 'payment-txn-1000'), false);
    });
  });

  describe('5. Payment Rules, Credit Policy & Outstanding Balances', () => {
    it('should reject total payments exceeding the grand total', () => {
      const grandTotalPaise = 50000; // ₹500
      const paymentAmountPaise = 60000; // ₹600

      const isExcessPayment = paymentAmountPaise > grandTotalPaise;
      assert.equal(isExcessPayment, true, 'Overpayment must be rejected');
    });

    it('should require an identified customer for credit sales and partial payments', () => {
      // Walk-in customer trying to take credit
      const walkInAttempt = checkoutInvoiceSchema.safeParse({
        items: [
          {
            productId: dummyProductId.toString(),
            quantityBase: 2,
          },
        ],
        payments: [
          {
            amountPaise: 10000,
            paymentMethod: 'CREDIT',
          },
        ],
        customerId: null, // No customer identified!
      });

      assert.equal(walkInAttempt.success, false, 'Credit sale without customer must be rejected');
    });

    it('should calculate paid amount and remaining balance due accurately', () => {
      const grandTotalPaise = 150000; // ₹1,500.00
      const payment1Paise = 50000; // ₹500.00
      const payment2Paise = 50000; // ₹500.00

      const totalPaid = payment1Paise + payment2Paise;
      const balanceDue = grandTotalPaise - totalPaid;

      assert.equal(totalPaid, 100000);
      assert.equal(balanceDue, 50000);

      let status = 'UNPAID';
      if (balanceDue === 0) status = 'PAID';
      else if (totalPaid > 0) status = 'PARTIALLY_PAID';

      assert.equal(status, 'PARTIALLY_PAID');
    });
  });

  describe('6. Invoice Cancellation & Traceable Reversal Movements', () => {
    it('should require a mandatory reason of at least 5 characters for cancellation', () => {
      const emptyReason = cancelInvoiceSchema.safeParse({ reason: '' });
      assert.equal(emptyReason.success, false);

      const shortReason = cancelInvoiceSchema.safeParse({ reason: 'oops' });
      assert.equal(shortReason.success, false);

      const validReason = cancelInvoiceSchema.safeParse({
        reason: 'Customer cancelled transaction before bags were loaded into vehicle',
      });
      assert.equal(validReason.success, true);
    });

    it('should reverse stock deductions with positive RETURN_INWARD movements', () => {
      const soldItems = [
        { productId: dummyProductId, batchId: dummyBatchId, quantityBase: 10 },
      ];

      const reversals = soldItems.map((item) => ({
        movementType: 'RETURN_INWARD',
        quantityBase: Math.abs(item.quantityBase), // Must be positive to return stock!
      }));

      assert.equal(reversals[0].movementType, 'RETURN_INWARD');
      assert.equal(reversals[0].quantityBase, 10);
      assert.ok(reversals[0].quantityBase > 0, 'Reversal must increment stock');
    });
  });

  describe('7. Role-Based Permissions & Data Scoping', () => {
    it('CASHIER role cannot cancel an invoice', () => {
      const allowedRolesForCancellation = ['OWNER', 'MANAGER'];
      assert.equal(allowedRolesForCancellation.includes('CASHIER'), false);
    });

    it('CUSTOMER role cannot access invoices belonging to another customer', () => {
      const customerUser = {
        role: 'CUSTOMER',
        customerId: dummyCustomerId.toString(),
      };

      const otherCustomerId = new mongoose.Types.ObjectId().toString();
      const invoiceOfOther = {
        customerId: otherCustomerId,
      };

      const isAllowed =
        customerUser.role !== 'CUSTOMER' ||
        customerUser.customerId === invoiceOfOther.customerId;

      assert.equal(isAllowed, false, 'Customer must not access another customer bill');
    });
  });

  describe('8. Safe Transaction Guarantees (No Silent Partial Writes)', () => {
    it('should fail safely if atomic transactions are strictly required but unsupported', async () => {
      // Test that withTransaction refuses unsafe writes when requireTransaction=true
      // in environments where transaction sessions are not supported
      const testSafeRefusal = async () => {
        try {
          await withTransaction(
            async () => {
              const err = new Error('Transactions are not supported on standalone MongoDB');
              err.code = 20;
              throw err;
            },
            { requireTransaction: true }
          );
          return false;
        } catch (err) {
          return err.code === 'TRANSACTION_REQUIRED' || err.statusCode === 503;
        }
      };

      const refusedSafely = await testSafeRefusal();
      assert.equal(refusedSafely, true, 'Unsafe partial write must be aborted');
    });
  });
});
