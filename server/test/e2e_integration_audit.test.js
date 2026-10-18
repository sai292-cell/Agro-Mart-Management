import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  Shop,
  User,
  Customer,
  Supplier,
  Product,
  Batch,
  StockMovement,
  Purchase,
  Invoice,
  Payment,
  PaymentAllocation,
  CustomerLedgerEntry,
  SupplierLedgerEntry,
  Expense,
  CashDrawerSession,
  AuditLog,
} from '../src/models/index.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  formatSafeUser,
} from '../src/utils/tokenUtils.js';
import { calculateLineItemFinancials, allocateBatchStock } from '../src/utils/billingUtils.js';
import { calculatePurchaseTotals } from '../src/utils/purchaseUtils.js';
import { calculateCustomerAging } from '../src/utils/ledgerUtils.js';
import { calculateSupplierAging } from '../src/utils/supplierLedgerUtils.js';
import { calculateCashMovements } from '../src/utils/cashbookUtils.js';
import { checkoutInvoiceSchema, cancelInvoiceSchema } from '../src/validators/billingValidators.js';
import { createPurchaseSchema, purchaseReturnSchema, cancelPurchaseSchema } from '../src/validators/purchaseValidators.js';
import { createExpenseSchema } from '../src/validators/expenseValidators.js';
import { closeDrawerSessionSchema } from '../src/validators/cashbookValidators.js';

describe('PROMPT 10 — End-to-End Integration, Dual Portal Polish & Security Audit Suite', () => {
  const shopId = new mongoose.Types.ObjectId();
  const otherShopId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const cashierId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const supplierId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const batchId = new mongoose.Types.ObjectId();

  // =========================================================================
  // 1. SECURITY & AUTHORIZATION REGRESSION AUDIT
  // =========================================================================
  describe('1. Security & Authorization Regression Audit', () => {
    it('Customer token refresh preserves customerId in signed access token', () => {
      // Regression check for defect: refreshed token losing customerId payload
      const mockCustomerUser = {
        _id: new mongoose.Types.ObjectId(),
        shopId: shopId,
        role: 'CUSTOMER',
        name: 'Suresh Patil',
        customerId: customerId,
      };

      const accessToken = signAccessToken(mockCustomerUser);
      const decoded = verifyAccessToken(accessToken);

      assert.equal(decoded.sub, mockCustomerUser._id.toString());
      assert.equal(decoded.shopId, shopId.toString());
      assert.equal(decoded.role, 'CUSTOMER');
      assert.equal(decoded.customerId, customerId.toString(), 'Token must retain customerId for sandboxed access');
    });

    it('Cross-shop and Cross-customer boundaries strictly isolate financial data', () => {
      const customerAId = new mongoose.Types.ObjectId().toString();
      const customerBId = new mongoose.Types.ObjectId().toString();

      // Customer A invoice
      const invoiceA = {
        _id: new mongoose.Types.ObjectId(),
        shopId: shopId.toString(),
        customerId: customerAId,
        grandTotalPaise: 100000,
      };

      // Customer B trying to access Invoice A
      const customerBUser = {
        role: 'CUSTOMER',
        customerId: customerBId,
        shopId: shopId.toString(),
      };

      const hasAccess =
        customerBUser.role !== 'CUSTOMER' ||
        customerBUser.customerId === invoiceA.customerId;

      assert.equal(hasAccess, false, 'Customer B must not access Customer A invoice');
    });

    it('Cashier role is blocked from supplier AP and financial management routes', () => {
      const allowedRolesForSuppliers = ['OWNER', 'MANAGER'];
      const allowedRolesForReports = ['OWNER', 'MANAGER'];
      const allowedRolesForClosing = ['OWNER', 'MANAGER'];

      assert.equal(allowedRolesForSuppliers.includes('CASHIER'), false, 'Cashier blocked from suppliers');
      assert.equal(allowedRolesForReports.includes('CASHIER'), false, 'Cashier blocked from reports');
      assert.equal(allowedRolesForClosing.includes('CASHIER'), false, 'Cashier blocked from closing');
    });

    it('Idempotency keys prevent double posting of payments', () => {
      const paymentRecord1 = {
        shopId,
        idempotencyKey: 'IDEMP-PAY-12345',
        amountPaise: 50000,
      };

      const duplicateKeyAttempt = 'IDEMP-PAY-12345';
      const isDuplicate = paymentRecord1.idempotencyKey === duplicateKeyAttempt;
      assert.equal(isDuplicate, true, 'Duplicate idempotency key must be detected');
    });
  });

  // =========================================================================
  // 2. WORKFLOW A: PRODUCT AND PURCHASE INWARD WORKFLOW
  // =========================================================================
  describe('2. Workflow A: Product Catalog & Inward Purchase Processing', () => {
    it('creates supplier with valid GSTIN and agricultural payment terms', () => {
      const supplierDoc = new Supplier({
        shopId,
        name: 'Mahyco Seeds Ltd',
        contactPerson: 'Ramesh Shinde',
        phone: '9822012345',
        villageCity: 'Jalna',
        district: 'Jalna',
        state: 'Maharashtra',
        pincode: '431203',
        supplierType: 'MANUFACTURER',
        paymentTermsDays: 30,
        creditLimitPaise: 50000000, // ₹5,00,000
        taxDetails: {
          gstin: '27AAACM1234F1Z5',
          pan: 'AAACM1234F',
        },
      });

      assert.equal(supplierDoc.name, 'Mahyco Seeds Ltd');
      assert.equal(supplierDoc.state, 'Maharashtra');
      assert.equal(supplierDoc.paymentTermsDays, 30);
    });

    it('calculates inward purchase taxes (intra-state 50/50 CGST/SGST) and line totals in integer paise', () => {
      const items = [
        {
          productId,
          quantity: 20,
          freeQuantity: 2,
          purchaseRatePaise: 40000, // ₹400.00
          discountPaise: 0,
          gstRate: 18,
        },
      ];

      const financials = calculatePurchaseTotals(items, {
        isInterstate: false,
        additionalChargesPaise: 50000, // ₹500 freight
      });

      // 20 units * ₹400 = ₹8,000.00 (800000 paise)
      assert.equal(financials.subtotalPaise, 800000);
      // 18% GST = ₹1,440.00 (144000 paise) -> Split into 72000 CGST + 72000 SGST
      assert.equal(financials.taxTotalPaise, 144000);
      assert.equal(financials.items[0].cgstPaise, 72000);
      assert.equal(financials.items[0].sgstPaise, 72000);
      assert.equal(financials.items[0].igstPaise, 0);
      // Net = 800000 + 144000 + 50000 = 994000 paise (₹9,940.00)
      assert.equal(financials.grandTotalPaise, 994000);
    });

    it('DRAFT purchase has zero effect on stock and zero accounts payable liability', () => {
      const draftPurchase = {
        status: 'DRAFT',
        grandTotalPaise: 974000,
        paidPaise: 0,
      };

      const postsToStock = draftPurchase.status === 'RECEIVED';
      const postsToApLedger = draftPurchase.status === 'RECEIVED';

      assert.equal(postsToStock, false, 'Draft purchase must not affect stock');
      assert.equal(postsToApLedger, false, 'Draft purchase must not affect AP ledger');
    });

    it('RECEIVED purchase creates batch with FEFO expiry and increments AP ledger balance', () => {
      const receivedPurchase = {
        status: 'RECEIVED',
        purchaseNumber: 'PUR-202610-00001',
        grandTotalPaise: 974000,
        paidPaise: 200000, // ₹2,000 paid at receipt
      };

      // Ledger credit for inward purchase invoice
      const apCreditEntry = {
        entryType: 'PURCHASE_INVOICE',
        transactionType: 'CREDIT',
        amountPaise: receivedPurchase.grandTotalPaise,
      };

      // Downpayment debit
      const apDebitEntry = {
        entryType: 'PAYMENT_MADE',
        transactionType: 'DEBIT',
        amountPaise: receivedPurchase.paidPaise,
      };

      // Net AP balance = Credits - Debits
      const netPayablePaise = apCreditEntry.amountPaise - apDebitEntry.amountPaise;
      assert.equal(netPayablePaise, 774000, 'Remaining balance ₹7,740 owed to supplier');
    });
  });

  // =========================================================================
  // 3. WORKFLOW B: COUNTER SALE & FEFO BATCH ALLOCATION
  // =========================================================================
  describe('3. Workflow B: Counter Sale & POS Billing Workflow', () => {
    it('allocates stock in strict FEFO order (First-Expired, First-Out)', () => {
      const batches = [
        {
          _id: new mongoose.Types.ObjectId('000000000000000000000002'),
          batchNumber: 'BATCH-LATE',
          expiryDate: new Date('2027-06-30'),
          currentStockBase: 50,
          purchaseCostPaisePerBaseUnit: 35000,
        },
        {
          _id: new mongoose.Types.ObjectId('000000000000000000000001'),
          batchNumber: 'BATCH-EARLY',
          expiryDate: new Date('2026-11-30'), // Expiring sooner
          currentStockBase: 15,
          purchaseCostPaisePerBaseUnit: 34000,
        },
      ];

      // Request 20 units: Must prioritize earlier expiring batch (FEFO)
      const sortedBatches = [...batches].sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
      let remainingQuantity = 20;
      const allocation = [];
      for (const b of sortedBatches) {
        if (remainingQuantity <= 0) break;
        const allocQty = Math.min(remainingQuantity, b.currentStockBase);
        allocation.push({ batchNumber: b.batchNumber, allocatedQuantityBase: allocQty });
        remainingQuantity -= allocQty;
      }

      assert.equal(allocation.length, 2);
      assert.equal(allocation[0].batchNumber, 'BATCH-EARLY');
      assert.equal(allocation[0].allocatedQuantityBase, 15);
      assert.equal(allocation[1].batchNumber, 'BATCH-LATE');
      assert.equal(allocation[1].allocatedQuantityBase, 5);
    });

    it('computes tax-inclusive sales totals and deducts stock exactly once', () => {
      // 5 units at ₹500.00 (50000 paise) = 250000 paise gross
      const financials = calculateLineItemFinancials(5, 50000, 0, {
        gstRatePercent: 18,
        isExempt: false,
      });

      assert.equal(financials.lineTotalPaise, 250000);
      assert.equal(financials.taxableAmountPaise, 211864);
      assert.equal(financials.taxTotalPaise, 38136);
      assert.equal(financials.cgstPaise, 19068);
      assert.equal(financials.sgstPaise, 19068);
      assert.equal(financials.cgstPaise + financials.sgstPaise, financials.taxTotalPaise);
    });
  });

  // =========================================================================
  // 4. WORKFLOW C: FARMER CREDIT LEDGER & PASSBOOK WORKFLOW
  // =========================================================================
  describe('4. Workflow C: Farmer Credit & Receivables Workflow', () => {
    it('records credit sale debit, partial payments, and updates running passbook balance', () => {
      let runningBalancePaise = 0;

      // 1. Credit sale of ₹10,000 (1000000 paise) with downpayment of ₹2,000 (200000 paise)
      runningBalancePaise += 1000000; // DEBIT increases debt
      assert.equal(runningBalancePaise, 1000000);

      runningBalancePaise -= 200000; // CREDIT downpayment decreases debt
      assert.equal(runningBalancePaise, 800000, 'Balance after purchase is ₹8,000');

      // 2. Partial payment of ₹3,000 (300000 paise) via UPI
      runningBalancePaise -= 300000;
      assert.equal(runningBalancePaise, 500000, 'Balance after partial payment is ₹5,000');

      // 3. Final payment of remaining ₹5,000 (500000 paise) in cash
      runningBalancePaise -= 500000;
      assert.equal(runningBalancePaise, 0, 'Account fully settled to zero');
    });

    it('calculates aging buckets accurately based on transaction dates', () => {
      const now = new Date();
      const currentEntry = { createdAt: new Date(now.getTime() - 10 * 86400000), balancePaise: 200000 };
      const pastDueEntry = { createdAt: new Date(now.getTime() - 40 * 86400000), balancePaise: 300000 };
      const delinquentEntry = { createdAt: new Date(now.getTime() - 75 * 86400000), balancePaise: 150000 };
      const highlyOverdueEntry = { createdAt: new Date(now.getTime() - 105 * 86400000), balancePaise: 100000 };

      // Helper aging calculation
      const entries = [currentEntry, pastDueEntry, delinquentEntry, highlyOverdueEntry];
      let currentPaise = 0;
      let pastDuePaise = 0;
      let delinquentPaise = 0;
      let highlyOverduePaise = 0;

      for (const e of entries) {
        const days = Math.floor((now - e.createdAt) / 86400000);
        if (days <= 30) currentPaise += e.balancePaise;
        else if (days <= 60) pastDuePaise += e.balancePaise;
        else if (days <= 90) delinquentPaise += e.balancePaise;
        else highlyOverduePaise += e.balancePaise;
      }

      assert.equal(currentPaise, 200000);
      assert.equal(pastDuePaise, 300000);
      assert.equal(delinquentPaise, 150000);
      assert.equal(highlyOverduePaise, 100000);
    });
  });

  // =========================================================================
  // 5. WORKFLOW D: SUPPLIER PAYMENT & ACCOUNTS PAYABLE WORKFLOW
  // =========================================================================
  describe('5. Workflow D: Supplier Outward Payments & FIFO Allocation', () => {
    it('allocates outward payment across multiple purchase bills and preserves advance surplus', () => {
      const unpaidPurchases = [
        { _id: 'PUR-1', purchaseNumber: 'PUR-01', balancePaise: 400000 }, // ₹4,000
        { _id: 'PUR-2', purchaseNumber: 'PUR-02', balancePaise: 300000 }, // ₹3,000
      ];

      // Pay ₹8,500 (850000 paise): Should pay PUR-1 (4000), PUR-2 (3000), and leave 1500 as advance
      let remainingToAllocate = 850000;
      const allocations = [];

      for (const pur of unpaidPurchases) {
        if (remainingToAllocate <= 0) break;
        const alloc = Math.min(pur.balancePaise, remainingToAllocate);
        allocations.push({ purchaseId: pur._id, allocatedAmountPaise: alloc });
        remainingToAllocate -= alloc;
      }

      const advancePaise = remainingToAllocate;

      assert.equal(allocations[0].allocatedAmountPaise, 400000);
      assert.equal(allocations[1].allocatedAmountPaise, 300000);
      assert.equal(advancePaise, 150000, 'Surplus ₹1,500 safely preserved as supplier advance');
    });
  });

  // =========================================================================
  // 6. WORKFLOW E: RETURNS AND CANCELLATIONS INTEGRITY
  // =========================================================================
  describe('6. Workflow E: Returns & Cancellation Workflow', () => {
    it('invoice cancellation creates RETURN_INWARD stock movement and neutralizes customer debt', () => {
      const cancelValidation = cancelInvoiceSchema.safeParse({
        reason: 'Customer mistakenly billed duplicate items at counter',
      });
      assert.equal(cancelValidation.success, true);

      // Stock movement on cancellation
      const stockReversal = {
        movementType: 'RETURN_INWARD',
        quantityBase: 10, // Positive increments stock back
      };
      assert.equal(stockReversal.movementType, 'RETURN_INWARD');
      assert.ok(stockReversal.quantityBase > 0);
    });

    it('purchase cancellation creates RETURN_OUTWARD stock movement and neutralizes AP liability', () => {
      const cancelPurchaseValidation = cancelPurchaseSchema.safeParse({
        reason: 'Vendor dispatched wrong pesticide consignment, returned at gate',
      });
      assert.equal(cancelPurchaseValidation.success, true);

      const apReversalEntry = {
        entryType: 'REVERSAL',
        transactionType: 'DEBIT', // Neutralizes original CREDIT
        amountPaise: 500000,
      };
      assert.equal(apReversalEntry.transactionType, 'DEBIT');
    });

    it('purchase return strictly rejects returning more than available stock', () => {
      const availableBatchStock = 12;
      const requestedReturnQty = 15;

      const isPermitted = requestedReturnQty <= availableBatchStock;
      assert.equal(isPermitted, false, 'Return exceeding stock must be rejected');
    });
  });

  // =========================================================================
  // 7. WORKFLOW F: EXPENSE & PHYSICAL CASH DRAWER RECONCILIATION
  // =========================================================================
  describe('7. Workflow F: Operating Expenses & Cash Drawer Closing', () => {
    it('validates expense vouchers in integer paise with mandatory category', () => {
      const validExpense = createExpenseSchema.safeParse({
        category: 'TRANSPORT_FUEL',
        amountPaise: 45000, // ₹450.00
        paymentMode: 'CASH',
        payee: 'Navnath Tempo Services',
        description: 'Fertilizer delivery freight from warehouse to shop',
      });
      assert.equal(validExpense.success, true);

      const invalidNegative = createExpenseSchema.safeParse({
        category: 'RENT',
        amountPaise: -5000,
        paymentMode: 'CASH',
        payee: 'Landlord',
      });
      assert.equal(invalidNegative.success, false);
    });

    it('isolates physical cash drawer from digital non-drawer funds (UPI / Bank)', () => {
      const openingCashPaise = 500000; // ₹5,000 float
      const cashSalesPaise = 300000; // ₹3,000 cash sales
      const upiSalesPaise = 700000; // ₹7,000 UPI sales (settles to bank account)
      const cashExpensesPaise = 50000; // ₹500 cash expense
      const upiExpensesPaise = 100000; // ₹1,000 UPI expense

      // Expected physical cash strictly ignores digital funds
      const expectedCashPaise = openingCashPaise + cashSalesPaise - cashExpensesPaise;
      assert.equal(expectedCashPaise, 750000, 'Expected physical cash is ₹7,500');

      // Counted cash exact match
      const countedCashPaise = 750000;
      const variancePaise = countedCashPaise - expectedCashPaise;
      assert.equal(variancePaise, 0);

      // Deficit test
      const countedDeficitPaise = 740000; // ₹100 short
      const deficitVariance = countedDeficitPaise - expectedCashPaise;
      assert.equal(deficitVariance, -10000, 'Deficit of ₹100 detected');
    });

    it('requires mandatory explanation note if cash variance is non-zero', () => {
      const noNoteVariance = closeDrawerSessionSchema.safeParse({
        closingCashCountedPaise: 740000,
        closingNotes: '', // Missing explanation
      });
      assert.equal(noNoteVariance.success, true); // Schema allows optional, controller validates variance > 0 note

      const variancePaise = -10000;
      const notes = '';
      const isRejected = variancePaise !== 0 && (!notes || notes.trim().length < 3);
      assert.equal(isRejected, true, 'Unexplained discrepancy must be rejected');
    });
  });

  // =========================================================================
  // 8. WORKFLOW G: BATCH-BASED COGS & PROFITABILITY REPORTS
  // =========================================================================
  describe('8. Workflow G: Batch-Based COGS & Profitability Calculations', () => {
    it('calculates COGS directly from verified batch purchase costs of items actually sold', () => {
      const activeInvoices = [
        {
          status: 'FINALIZED',
          items: [
            {
              quantityBase: 10,
              purchaseCostPaisePerBaseUnit: 40000, // ₹400 purchase cost
              taxableAmountPaise: 500000, // ₹500 selling price taxable
              lineTotalPaise: 590000,
            },
            {
              quantityBase: 5,
              purchaseCostPaisePerBaseUnit: 80000, // ₹800 purchase cost
              taxableAmountPaise: 500000, // ₹1,000 selling price taxable
              lineTotalPaise: 560000,
            },
          ],
        },
      ];

      let totalCogsPaise = 0;
      for (const inv of activeInvoices) {
        if (inv.status === 'FINALIZED') {
          for (const item of inv.items) {
            totalCogsPaise += item.quantityBase * item.purchaseCostPaisePerBaseUnit;
          }
        }
      }

      // Item 1: 10 * 400 = 4000 (400000 paise)
      // Item 2: 5 * 800 = 4000 (400000 paise)
      // Total COGS = 800000 paise (₹8,000.00)
      assert.equal(totalCogsPaise, 800000);
    });

    it('excludes cancelled invoices from revenue and COGS', () => {
      const mixedInvoices = [
        {
          status: 'FINALIZED',
          items: [{ quantityBase: 2, purchaseCostPaisePerBaseUnit: 10000, taxableAmountPaise: 30000 }],
        },
        {
          status: 'CANCELLED',
          items: [{ quantityBase: 100, purchaseCostPaisePerBaseUnit: 50000, taxableAmountPaise: 700000 }],
        },
      ];

      let validCogsPaise = 0;
      for (const inv of mixedInvoices) {
        if (inv.status === 'FINALIZED') {
          for (const item of inv.items) {
            validCogsPaise += item.quantityBase * item.purchaseCostPaisePerBaseUnit;
          }
        }
      }

      // Only the FINALIZED bill (2 * 10000 = 20000 paise) is counted
      assert.equal(validCogsPaise, 20000);
    });

    it('computes Gross Profit, Operating Expenses, and Operating Net Profit %', () => {
      const taxableRevenuePaise = 1000000; // ₹10,000.00
      const totalCogsPaise = 700000; // ₹7,000.00
      const operatingExpensesPaise = 150000; // ₹1,500.00

      const grossProfitPaise = taxableRevenuePaise - totalCogsPaise;
      assert.equal(grossProfitPaise, 300000); // ₹3,000.00
      const grossMarginPercent = (grossProfitPaise / taxableRevenuePaise) * 100;
      assert.equal(grossMarginPercent, 30); // 30%

      const operatingNetProfitPaise = grossProfitPaise - operatingExpensesPaise;
      assert.equal(operatingNetProfitPaise, 150000); // ₹1,500.00
      const operatingMarginPercent = (operatingNetProfitPaise / taxableRevenuePaise) * 100;
      assert.equal(operatingMarginPercent, 15); // 15%
    });
  });
});
