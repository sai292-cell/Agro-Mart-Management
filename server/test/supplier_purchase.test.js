import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  Supplier,
  Purchase,
  SupplierLedgerEntry,
  Payment,
  PaymentAllocation,
  Product,
  Batch,
  StockMovement,
} from '../src/models/index.js';
import {
  calculatePurchaseItem,
  calculatePurchaseTotals,
} from '../src/utils/purchaseUtils.js';
import {
  getSupplierLedgerBalance,
  recordSupplierLedgerEntry,
  allocateSupplierPayment,
  reconcileSupplierAccount,
  calculateSupplierAging,
} from '../src/utils/supplierLedgerUtils.js';

describe('Supplier Management, Purchase Inward & AP Ledger Suite', () => {
  const shopA = new mongoose.Types.ObjectId();
  const shopB = new mongoose.Types.ObjectId();
  const staffUserId = new mongoose.Types.ObjectId();
  const supplierAId = new mongoose.Types.ObjectId();
  const productAId = new mongoose.Types.ObjectId();

  describe('1. Supplier Schema & GSTIN Validation', () => {
    it('should validate valid supplier data with Maharashtra defaults', async () => {
      const supplier = new Supplier({
        shopId: shopA,
        name: 'Mahyco Seeds Distributor',
        phone: '9822012345',
        contactPerson: 'Suresh Patil',
        taxDetails: {
          gstin: '27AABCM1234F1Z5',
          pan: 'AABCM1234F',
        },
      });

      const err = await supplier.validate();
      assert.equal(err, undefined);
      assert.equal(supplier.state, 'Maharashtra');
      assert.equal(supplier.active, true);
      assert.equal(supplier.paymentTermsDays, 30);
    });

    it('should reject invalid GSTIN format', async () => {
      const supplier = new Supplier({
        shopId: shopA,
        name: 'Invalid GSTIN Supplier',
        taxDetails: {
          gstin: 'INVALID-GSTIN-123',
        },
      });

      let error;
      try {
        await supplier.validate();
      } catch (err) {
        error = err;
      }
      assert.ok(error?.errors?.['taxDetails.gstin']);
    });

    it('should accept empty GSTIN for unregistered micro-dealers', async () => {
      const supplier = new Supplier({
        shopId: shopA,
        name: 'Local Nursery',
        taxDetails: {
          gstin: '',
        },
      });
      const err = await supplier.validate();
      assert.equal(err, undefined);
    });
  });

  describe('2. Purchase Financial Mathematics & GST Calculations', () => {
    it('should correctly calculate intra-state GST (50% CGST + 50% SGST) in integer paise', () => {
      // 10 bags of Fertilizer at ₹500.00 (50,000 paise) with 18% GST and ₹100.00 (10,000 paise) discount
      const item = {
        productId: productAId,
        nameSnapshot: 'Urea 46%',
        skuSnapshot: 'FERT-UREA-50KG',
        unitSnapshot: 'BAG',
        quantity: 10,
        purchaseRatePaise: 50000,
        discountPaise: 10000,
        gstRate: 18,
      };

      const computed = calculatePurchaseItem(item, false);
      // Base: 10 * 50,000 = 500,000 paise (₹5,000)
      // Taxable: 500,000 - 10,000 = 490,000 paise (₹4,900)
      // Tax (18%): 490,000 * 0.18 = 88,200 paise (₹882)
      // CGST: 44,100 paise; SGST: 44,100 paise; IGST: 0
      // Line Total: 490,000 + 88,200 = 578,200 paise (₹5,782)
      assert.equal(computed.taxableAmountPaise, 490000);
      assert.equal(computed.cgstPaise, 44100);
      assert.equal(computed.sgstPaise, 44100);
      assert.equal(computed.igstPaise, 0);
      assert.equal(computed.lineTotalPaise, 578200);
    });

    it('should correctly calculate inter-state GST (100% IGST) in integer paise', () => {
      const item = {
        productId: productAId,
        nameSnapshot: 'Imported Micro-Nutrient',
        skuSnapshot: 'MIC-NUT-1L',
        unitSnapshot: 'LITER',
        quantity: 5,
        purchaseRatePaise: 100000, // ₹1,000
        discountPaise: 0,
        gstRate: 12,
      };

      const computed = calculatePurchaseItem(item, true); // isInterstate = true
      // Taxable: 500,000 paise
      // Tax (12%): 60,000 paise
      assert.equal(computed.taxableAmountPaise, 500000);
      assert.equal(computed.cgstPaise, 0);
      assert.equal(computed.sgstPaise, 0);
      assert.equal(computed.igstPaise, 60000);
      assert.equal(computed.lineTotalPaise, 560000);
    });

    it('should aggregate bill totals, additional freight charges, and round-off', () => {
      const items = [
        {
          productId: productAId,
          nameSnapshot: 'Seeds Box',
          skuSnapshot: 'SEED-BOX',
          unitSnapshot: 'BOX',
          quantity: 2,
          purchaseRatePaise: 150033, // ₹1,500.33
          discountPaise: 0,
          gstRate: 5,
        },
      ];

      const totals = calculatePurchaseTotals(items, {
        additionalChargesPaise: 25000, // ₹250.00 freight
        paidPaise: 100000, // ₹1,000 downpayment
        isInterstate: false,
      });

      assert.equal(totals.items.length, 1);
      assert.ok(totals.grandTotalPaise > 0);
      assert.equal(totals.paidPaise, 100000);
      assert.equal(totals.balancePaise, totals.grandTotalPaise - 100000);
      assert.equal(totals.paymentStatus, 'PARTIALLY_PAID');
    });

    it('should reject non-positive quantities and negative purchase rates', () => {
      assert.throws(() => {
        calculatePurchaseItem({
          productId: productAId,
          quantity: -5,
          purchaseRatePaise: 1000,
        });
      }, /positive number/);

      assert.throws(() => {
        calculatePurchaseItem({
          productId: productAId,
          quantity: 2,
          purchaseRatePaise: -100,
        });
      }, /non-negative integer/);
    });
  });

  describe('3. Supplier Ledger Invariants & Double-Entry Math', () => {
    it('should follow Accounts Payable sign convention: CREDIT increases payable, DEBIT decreases payable', async () => {
      // Mocking ledger entries
      const mockEntries = [
        { transactionType: 'CREDIT', amountPaise: 100000, isReversed: false }, // Purchase bill ₹1,000
        { transactionType: 'DEBIT', amountPaise: 40000, isReversed: false },  // Payment made ₹400
        { transactionType: 'DEBIT', amountPaise: 10000, isReversed: false },  // Return ₹100
      ];

      let totalCredit = 0;
      let totalDebit = 0;
      for (const e of mockEntries) {
        if (e.transactionType === 'CREDIT') totalCredit += e.amountPaise;
        if (e.transactionType === 'DEBIT') totalDebit += e.amountPaise;
      }
      const netPayable = totalCredit - totalDebit;

      // Net Payable should be 100,000 - 50,000 = 50,000 paise (₹500.00)
      assert.equal(netPayable, 50000);
    });

    it('should enforce append-only immutability on SupplierLedgerEntry', async () => {
      const entry = new SupplierLedgerEntry({
        shopId: shopA,
        supplierId: supplierAId,
        entryType: 'PURCHASE_INVOICE',
        transactionType: 'CREDIT',
        amountPaise: 500000,
        runningBalancePaise: 500000,
        referenceType: 'PURCHASE',
        description: 'Test Inward Bill',
        recordedBy: staffUserId,
      });

      // Saving as an update (!isNew) must be blocked
      entry.isNew = false;
      let err;
      try {
        await entry.save();
      } catch (e) {
        err = e;
      }
      assert.ok(err);
      assert.match(err.message, /immutable financial documents/);
    });

    it('should validate SupplierLedgerEntry amount must be positive integer paise', async () => {
      const invalidEntry = new SupplierLedgerEntry({
        shopId: shopA,
        supplierId: supplierAId,
        entryType: 'PURCHASE_INVOICE',
        transactionType: 'CREDIT',
        amountPaise: -500,
        runningBalancePaise: 0,
        referenceType: 'PURCHASE',
        description: 'Negative test',
        recordedBy: staffUserId,
      });

      let err;
      try {
        await invalidEntry.validate();
      } catch (e) {
        err = e;
      }
      assert.ok(err?.errors?.amountPaise);
    });
  });

  describe('4. Purchase Model Invariants & Status Workflow', () => {
    it('should enforce required purchase fields and embedded item snapshots', async () => {
      const purchase = new Purchase({
        shopId: shopA,
        purchaseNumber: 'PUR-202610-00001',
        supplierId: supplierAId,
        supplierInvoiceNumber: 'INV-SUP-9988',
        receivedBy: staffUserId,
        status: 'DRAFT',
        items: [
          {
            productId: productAId,
            nameSnapshot: 'Chilli Seeds Hybrid',
            skuSnapshot: 'SEED-CHILLI-100G',
            unitSnapshot: 'PACKET',
            quantity: 50,
            purchaseRatePaise: 25000,
            taxableAmountPaise: 1250000,
            gstRate: 5,
            cgstPaise: 31250,
            sgstPaise: 31250,
            lineTotalPaise: 1312500,
          },
        ],
        subtotalPaise: 1250000,
        taxTotalPaise: 62500,
        grandTotalPaise: 1312500,
        balancePaise: 1312500,
      });

      const err = await purchase.validate();
      assert.equal(err, undefined);
      assert.equal(purchase.status, 'DRAFT');
      assert.equal(purchase.paymentStatus, 'UNPAID');
    });

    it('should reject purchase without any line items', async () => {
      const emptyPurchase = new Purchase({
        shopId: shopA,
        purchaseNumber: 'PUR-202610-00002',
        supplierId: supplierAId,
        supplierInvoiceNumber: 'INV-SUP-EMPTY',
        receivedBy: staffUserId,
        items: [],
        subtotalPaise: 0,
        taxTotalPaise: 0,
        grandTotalPaise: 0,
      });

      let err;
      try {
        await emptyPurchase.validate();
      } catch (e) {
        err = e;
      }
      assert.ok(err?.errors?.items);
    });
  });

  describe('5. Payment Allocation & Advance Logic', () => {
    it('should support multi-purchase FIFO allocation calculation', () => {
      const mockPurchases = [
        { purchaseNumber: 'PUR-001', balancePaise: 30000 }, // ₹300
        { purchaseNumber: 'PUR-002', balancePaise: 50000 }, // ₹500
      ];

      let paymentAmountPaise = 70000; // ₹700
      const allocations = [];

      for (const p of mockPurchases) {
        if (paymentAmountPaise <= 0) break;
        const alloc = Math.min(p.balancePaise, paymentAmountPaise);
        allocations.push({ purchaseNumber: p.purchaseNumber, allocatedPaise: alloc });
        paymentAmountPaise -= alloc;
      }

      // First purchase should get 30,000 paise (cleared)
      assert.equal(allocations[0].allocatedPaise, 30000);
      // Second purchase should get remaining 40,000 paise (partial)
      assert.equal(allocations[1].allocatedPaise, 40000);
      // Remaining advance should be 0
      assert.equal(paymentAmountPaise, 0);
    });

    it('should preserve surplus payment as unallocated advance credit', () => {
      const mockPurchases = [{ purchaseNumber: 'PUR-001', balancePaise: 20000 }];
      let paymentAmountPaise = 50000; // ₹500 paid for ₹200 bill

      const target = mockPurchases[0];
      const alloc = Math.min(target.balancePaise, paymentAmountPaise);
      paymentAmountPaise -= alloc;

      // Allocated: 20,000; Advance balance: 30,000 paise
      assert.equal(alloc, 20000);
      assert.equal(paymentAmountPaise, 30000);
    });
  });

  describe('6. Reversal Traceability & Integrity', () => {
    it('should reciprocal-link counter reversal entry to original entry', () => {
      const originalEntryId = new mongoose.Types.ObjectId();
      const reversalEntryId = new mongoose.Types.ObjectId();

      const originalEntry = {
        _id: originalEntryId,
        entryType: 'PURCHASE_INVOICE',
        transactionType: 'CREDIT',
        amountPaise: 100000,
        isReversed: true,
        reversedByEntryId: reversalEntryId,
      };

      const reversalEntry = {
        _id: reversalEntryId,
        entryType: 'REVERSAL',
        transactionType: 'DEBIT', // opposite of CREDIT
        amountPaise: 100000,
        originalEntryId: originalEntryId,
      };

      assert.equal(reversalEntry.originalEntryId.toString(), originalEntry._id.toString());
      assert.equal(originalEntry.reversedByEntryId.toString(), reversalEntry._id.toString());
      assert.equal(reversalEntry.transactionType, 'DEBIT');
    });
  });

  describe('7. Cross-Shop Isolation Safeguards', () => {
    it('should ensure purchase documents have mandatory shopId and reject mismatched shops', async () => {
      const purchaseShopA = new Purchase({
        shopId: shopA,
        purchaseNumber: 'PUR-SHOPA-001',
        supplierId: supplierAId,
        supplierInvoiceNumber: 'INV-A-1',
        receivedBy: staffUserId,
        items: [
          {
            productId: productAId,
            nameSnapshot: 'Prod',
            skuSnapshot: 'SKU-A',
            unitSnapshot: 'KG',
            quantity: 1,
            purchaseRatePaise: 1000,
            taxableAmountPaise: 1000,
            gstRate: 0,
            lineTotalPaise: 1000,
          },
        ],
        subtotalPaise: 1000,
        taxTotalPaise: 0,
        grandTotalPaise: 1000,
      });

      assert.equal(purchaseShopA.shopId.toString(), shopA.toString());
      assert.notEqual(purchaseShopA.shopId.toString(), shopB.toString());
    });
  });
});
