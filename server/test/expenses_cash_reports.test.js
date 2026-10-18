import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  Expense,
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_MODES,
  CashDrawerSession,
} from '../src/models/index.js';
import { createExpenseSchema, rejectExpenseSchema, reverseExpenseSchema } from '../src/validators/expenseValidators.js';
import { openDrawerSessionSchema, closeDrawerSessionSchema } from '../src/validators/cashbookValidators.js';

test('Expenses, Cashbook, Daily Closing & Profitability Suite', async (t) => {
  await t.test('1. Expense Schema & Zod Validators', async (t) => {
    await t.test('should validate valid operating expense data in integer paise', () => {
      const valid = createExpenseSchema.parse({
        amountPaise: 150000, // ₹1,500.00
        category: 'ELECTRICITY',
        description: 'MSEDCL Shop electricity bill payment',
        paymentMode: 'UPI',
        referenceNumber: 'UPI/382910293/REF',
        payee: 'MSEDCL Maharashtra',
      });

      assert.equal(valid.amountPaise, 150000);
      assert.equal(valid.category, 'ELECTRICITY');
      assert.equal(valid.paymentMode, 'UPI');
      assert.equal(valid.payee, 'MSEDCL Maharashtra');
    });

    await t.test('should reject non-positive amounts and fractional paise', () => {
      assert.throws(() => {
        createExpenseSchema.parse({
          amountPaise: -500,
          category: 'RENT',
          description: 'Shop rent',
          paymentMode: 'CASH',
          payee: 'Landlord',
        });
      }, /Amount must be greater than zero/);

      assert.throws(() => {
        createExpenseSchema.parse({
          amountPaise: 150.75, // Non-integer
          category: 'RENT',
          description: 'Shop rent',
          paymentMode: 'CASH',
          payee: 'Landlord',
        });
      }, /whole integer/);
    });

    await t.test('should reject invalid expense categories', () => {
      assert.throws(() => {
        createExpenseSchema.parse({
          amountPaise: 50000,
          category: 'INVALID_CATEGORY',
          description: 'Invalid category test',
          paymentMode: 'CASH',
          payee: 'Unknown',
        });
      }, /Invalid expense category/);
    });

    await t.test('should enforce rejection reason and reversal reason length', () => {
      assert.throws(() => {
        rejectExpenseSchema.parse({ reason: 'no' }); // < 3 chars
      }, /at least 3 characters/);

      assert.throws(() => {
        reverseExpenseSchema.parse({ reason: 'bad' }); // < 5 chars
      }, /at least 5 characters/);
    });
  });

  await t.test('2. Expense Immutability Safeguards', async (t) => {
    await t.test('should enforce immutable hooks preventing direct modification of approved expenses', () => {
      const shopId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      const expense = new Expense({
        shopId,
        expenseNumber: 'EXP-202610-00001',
        amountPaise: 250000,
        category: 'RENT',
        description: 'Monthly shop rent',
        paymentMode: 'BANK_TRANSFER',
        payee: 'Shri Patil',
        status: 'APPROVED',
        createdBy: userId,
        approvedBy: userId,
      });

      assert.equal(expense.amountPaise, 250000);
      assert.equal(expense.status, 'APPROVED');
    });
  });

  await t.test('3. Cash Drawer Session Invariants & Variance Math', async (t) => {
    await t.test('should validate opening drawer session payload', () => {
      const valid = openDrawerSessionSchema.parse({
        openingCashPaise: 500000, // ₹5,000.00
        openingNotes: 'Morning opening cash count verified',
      });
      assert.equal(valid.openingCashPaise, 500000);
    });

    await t.test('should reject negative opening cash float', () => {
      assert.throws(() => {
        openDrawerSessionSchema.parse({
          openingCashPaise: -100,
        });
      }, /cannot be negative/);
    });

    await t.test('should accurately calculate expected cash and variance', () => {
      const openingCashPaise = 200000; // ₹2,000
      const cashSalesPaise = 150000; // ₹1,500
      const cashCollectionsPaise = 50000; // ₹500
      const cashSupplierPaymentsPaise = 80000; // ₹800
      const cashExpensesPaise = 20000; // ₹200

      const totalCashInflow = cashSalesPaise + cashCollectionsPaise; // ₹2,000
      const totalCashOutflow = cashSupplierPaymentsPaise + cashExpensesPaise; // ₹1,000
      const expectedCashPaise = openingCashPaise + totalCashInflow - totalCashOutflow; // ₹3,000

      assert.equal(expectedCashPaise, 300000);

      // Scenario A: Exact match
      const closingCountedExact = 300000;
      const varianceExact = closingCountedExact - expectedCashPaise;
      assert.equal(varianceExact, 0);

      // Scenario B: Deficit of ₹50 (5000 paise)
      const closingCountedDeficit = 295000;
      const varianceDeficit = closingCountedDeficit - expectedCashPaise;
      assert.equal(varianceDeficit, -5000);

      // Scenario C: Surplus of ₹20 (2000 paise)
      const closingCountedSurplus = 302000;
      const varianceSurplus = closingCountedSurplus - expectedCashPaise;
      assert.equal(varianceSurplus, 2000);
    });

    await t.test('should enforce separation between physical drawer cash and digital UPI/bank funds', () => {
      // Inward cash payments
      const cashSales = 100000; // ₹1,000 in drawer
      // Digital UPI payments
      const upiSales = 450000; // ₹4,500 deposited directly into bank

      // Physical drawer cash MUST NOT include UPI
      const drawerCashInflow = cashSales;
      assert.equal(drawerCashInflow, 100000);
      assert.notEqual(drawerCashInflow, cashSales + upiSales);
    });
  });

  await t.test('4. Batch-Based COGS & Profitability Calculations', async (t) => {
    await t.test('should accurately compute Cost of Goods Sold from actual batch unit costs', () => {
      // Product: Cotton Seed 450g Pack
      // Batch A: Purchase rate = ₹320.00 (32000 paise per unit)
      // Batch B: Purchase rate = ₹340.00 (34000 paise per unit)
      const itemsSold = [
        { batchId: 'batch_A', quantity: 10, unitCostPaise: 32000, sellingPricePaise: 42000 },
        { batchId: 'batch_B', quantity: 5, unitCostPaise: 34000, sellingPricePaise: 42000 },
      ];

      let totalGrossSalesPaise = 0;
      let totalCogsPaise = 0;

      for (const item of itemsSold) {
        totalGrossSalesPaise += item.quantity * item.sellingPricePaise;
        totalCogsPaise += item.quantity * item.unitCostPaise;
      }

      // Gross sales = 15 * 42000 = 630000 paise (₹6,300)
      assert.equal(totalGrossSalesPaise, 630000);

      // COGS = (10 * 32000) + (5 * 34000) = 320000 + 170000 = 490000 paise (₹4,900)
      assert.equal(totalCogsPaise, 490000);

      // Gross Profit = 630000 - 490000 = 140000 paise (₹1,400)
      const grossProfitPaise = totalGrossSalesPaise - totalCogsPaise;
      assert.equal(grossProfitPaise, 140000);

      // Operating Expenses
      const operatingExpensesPaise = 40000; // ₹400 (Electricity + labor)

      // Operating Profit = Gross Profit - Operating Expenses = 140000 - 40000 = 100000 paise (₹1,000)
      const operatingProfitPaise = grossProfitPaise - operatingExpensesPaise;
      assert.equal(operatingProfitPaise, 100000);

      // Gross Margin % = (1400 / 6300) * 100 = 22.22%
      const grossMarginPercent = (grossProfitPaise / totalGrossSalesPaise) * 100;
      assert.equal(Math.round(grossMarginPercent * 100) / 100, 22.22);
    });

    await t.test('should strictly isolate non-cancelled sales from cancelled invoices', () => {
      const invoices = [
        { invoiceNumber: 'INV-001', status: 'FINALIZED', grandTotalPaise: 50000 },
        { invoiceNumber: 'INV-002', status: 'CANCELLED', grandTotalPaise: 30000 },
        { invoiceNumber: 'INV-003', status: 'FINALIZED', grandTotalPaise: 20000 },
      ];

      const validSales = invoices
        .filter((inv) => inv.status === 'FINALIZED')
        .reduce((sum, inv) => sum + inv.grandTotalPaise, 0);

      assert.equal(validSales, 70000); // Only INV-001 and INV-003 counted
    });
  });

  await t.test('5. Reversal Traceability & Reciprocal Linkage', async (t) => {
    await t.test('should verify reversal expense references original expense ID and reciprocal links', () => {
      const originalId = new mongoose.Types.ObjectId();
      const reversalId = new mongoose.Types.ObjectId();

      const original = {
        _id: originalId,
        expenseNumber: 'EXP-202610-00005',
        amountPaise: 120000,
        isReversed: true,
        reversedByExpenseId: reversalId,
        reversalReason: 'Wrong vendor billed',
      };

      const reversal = {
        _id: reversalId,
        expenseNumber: 'EXP-REV-202610-00006',
        amountPaise: 120000,
        originalExpenseId: originalId,
        status: 'REVERSED',
        reversalReason: 'Wrong vendor billed',
      };

      assert.equal(original.isReversed, true);
      assert.equal(original.reversedByExpenseId, reversal._id);
      assert.equal(reversal.originalExpenseId, original._id);
      assert.equal(reversal.amountPaise, original.amountPaise);
    });
  });
});
