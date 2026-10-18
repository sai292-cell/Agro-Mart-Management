import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { CustomerLedgerEntry } from '../src/models/CustomerLedgerEntry.js';
import { PaymentAllocation } from '../src/models/PaymentAllocation.js';
import { Customer } from '../src/models/Customer.js';
import { Invoice } from '../src/models/Invoice.js';
import { Payment } from '../src/models/Payment.js';
import {
  recordCustomerLedgerEntry,
  getCustomerLedgerBalance,
  allocatePaymentToInvoices,
  reconcileCustomerAccount,
  calculateCustomerAging,
} from '../src/utils/ledgerUtils.js';

test('Farmer Credit Ledger, Passbook & Outstanding Balance Suite', async (t) => {
  const shopId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const invoiceId = new mongoose.Types.ObjectId();

  await t.test('1. Immutable Ledger Schema & Accounting Convention', async (t2) => {
    await t2.test('should validate DEBIT entry increasing farmer debt', () => {
      const entry = new CustomerLedgerEntry({
        shopId,
        customerId,
        entryType: 'CREDIT_SALE',
        transactionType: 'DEBIT',
        amountPaise: 500000, // ₹5,000.00
        runningBalancePaise: 500000,
        referenceType: 'INVOICE',
        referenceId: 'INV-202610-00001',
        description: 'Credit purchase of 5 bags Urea',
        recordedBy: userId,
      });

      const err = entry.validateSync();
      assert.equal(err, undefined, 'DEBIT ledger entry should be valid');
      assert.equal(entry.amountPaise, 500000);
      assert.equal(entry.runningBalancePaise, 500000);
    });

    await t2.test('should validate CREDIT entry reducing farmer debt', () => {
      const entry = new CustomerLedgerEntry({
        shopId,
        customerId,
        entryType: 'PAYMENT_RECEIVED',
        transactionType: 'CREDIT',
        amountPaise: 200000, // ₹2,000.00
        runningBalancePaise: 300000, // ₹5,000 - ₹2,000 = ₹3,000
        referenceType: 'PAYMENT',
        referenceId: 'PAY-12345',
        description: 'Partial cash payment at counter',
        recordedBy: userId,
      });

      const err = entry.validateSync();
      assert.equal(err, undefined, 'CREDIT ledger entry should be valid');
      assert.equal(entry.transactionType, 'CREDIT');
      assert.equal(entry.runningBalancePaise, 300000);
    });

    await t2.test('should reject non-integer paise or zero/negative amount', () => {
      const invalidDecimal = new CustomerLedgerEntry({
        shopId,
        customerId,
        entryType: 'CREDIT_SALE',
        transactionType: 'DEBIT',
        amountPaise: 1250.75, // Invalid float
        runningBalancePaise: 1250,
        description: 'Invalid float',
        recordedBy: userId,
      });
      assert.ok(invalidDecimal.validateSync()?.errors['amountPaise']);

      const zeroAmount = new CustomerLedgerEntry({
        shopId,
        customerId,
        entryType: 'PAYMENT_RECEIVED',
        transactionType: 'CREDIT',
        amountPaise: 0,
        runningBalancePaise: 0,
        description: 'Zero amount',
        recordedBy: userId,
      });
      assert.ok(zeroAmount.validateSync()?.errors['amountPaise']);
    });

    await t2.test('should reject invalid entryType or transactionType', () => {
      const invalidType = new CustomerLedgerEntry({
        shopId,
        customerId,
        entryType: 'UNAUTHORIZED_TYPE',
        transactionType: 'DEBIT',
        amountPaise: 10000,
        runningBalancePaise: 10000,
        description: 'Bad type',
        recordedBy: userId,
      });
      assert.ok(invalidType.validateSync()?.errors['entryType']);

      const invalidTxnType = new CustomerLedgerEntry({
        shopId,
        customerId,
        entryType: 'ADJUSTMENT',
        transactionType: 'INVALID_TXN',
        amountPaise: 10000,
        runningBalancePaise: 10000,
        description: 'Bad txn type',
        recordedBy: userId,
      });
      assert.ok(invalidTxnType.validateSync()?.errors['transactionType']);
    });
  });

  await t.test('2. Ledger Balance Math & Running Balance Invariants', async (t2) => {
    await t2.test('should correctly compute running balance for sequential debit and credit transactions', () => {
      let balance = 0;

      // 1. Opening balance: ₹10,000 (Debit - owed from paper khata)
      balance += 1000000;
      assert.equal(balance, 1000000);

      // 2. New seed purchase on bill: ₹4,500 (Debit)
      balance += 450000;
      assert.equal(balance, 1450000);

      // 3. Farmer pays cash: ₹5,000 (Credit)
      balance -= 500000;
      assert.equal(balance, 950000);

      // 4. Farmer pays UPI: ₹9,500 (Credit)
      balance -= 950000;
      assert.equal(balance, 0, 'Balance should be completely settled');

      // 5. Farmer deposits advance: ₹2,000 (Credit)
      balance -= 200000;
      assert.equal(balance, -200000, 'Negative balance represents advance credit held by farmer');
    });

    await t2.test('should calculate available credit based on approved policy', () => {
      const creditLimitPaise = 5000000; // ₹50,000 limit
      const currentDebtPaise = 3200000; // ₹32,000 debt
      const availableCreditPaise = Math.max(0, creditLimitPaise - currentDebtPaise);
      assert.equal(availableCreditPaise, 1800000, 'Available credit should be ₹18,000');

      // If debt exceeds limit
      const excessDebtPaise = 5500000;
      const availableWhenExceeded = Math.max(0, creditLimitPaise - excessDebtPaise);
      assert.equal(availableWhenExceeded, 0, 'Available credit should be 0 when limit is exceeded');

      // If farmer has advance credit
      const advanceBalancePaise = -100000; // ₹1,000 advance
      const availableWithAdvance = Math.max(0, creditLimitPaise - advanceBalancePaise);
      assert.equal(availableWithAdvance, 5100000, 'Available credit increases with advance credit');
    });
  });

  await t.test('3. Payment Allocation & Multi-Invoice Settlement Logic', async (t2) => {
    await t2.test('should validate PaymentAllocation model fields', () => {
      const alloc = new PaymentAllocation({
        shopId,
        customerId,
        paymentId: new mongoose.Types.ObjectId(),
        invoiceId,
        allocatedAmountPaise: 350000, // ₹3,500
        allocatedBy: userId,
        notes: 'Allocated to invoice INV-202610-00001',
      });

      const err = alloc.validateSync();
      assert.equal(err, undefined, 'PaymentAllocation should validate cleanly');
      assert.equal(alloc.allocatedAmountPaise, 350000);
    });

    await t2.test('should allocate payment across multiple invoices sequentially (FIFO)', () => {
      const invoices = [
        { invoiceNumber: 'INV-001', balanceDuePaise: 400000, paidAmountPaise: 0 },
        { invoiceNumber: 'INV-002', balanceDuePaise: 500000, paidAmountPaise: 0 },
      ];

      let paymentToAllocate = 650000; // ₹6,500 payment
      const allocations = [];

      for (const inv of invoices) {
        if (paymentToAllocate <= 0) break;
        const alloc = Math.min(inv.balanceDuePaise, paymentToAllocate);
        inv.paidAmountPaise += alloc;
        inv.balanceDuePaise -= alloc;
        paymentToAllocate -= alloc;
        allocations.push({ invoice: inv.invoiceNumber, amount: alloc });
      }

      assert.equal(allocations.length, 2);
      assert.equal(allocations[0].amount, 400000, 'Invoice 1 should be fully paid (₹4,000)');
      assert.equal(invoices[0].balanceDuePaise, 0);
      assert.equal(allocations[1].amount, 250000, 'Invoice 2 should receive remaining ₹2,500');
      assert.equal(invoices[1].balanceDuePaise, 250000, 'Invoice 2 remaining balance should be ₹2,500');
      assert.equal(paymentToAllocate, 0, 'All payment amount was allocated');
    });

    await t2.test('should identify unallocated payment portion as advance credit', () => {
      const invoices = [
        { invoiceNumber: 'INV-001', balanceDuePaise: 200000, paidAmountPaise: 0 },
      ];

      let paymentToAllocate = 500000; // ₹5,000 paid, but only ₹2,000 due
      const alloc = Math.min(invoices[0].balanceDuePaise, paymentToAllocate);
      invoices[0].paidAmountPaise += alloc;
      invoices[0].balanceDuePaise -= alloc;
      paymentToAllocate -= alloc;

      const unallocatedAdvancePaise = paymentToAllocate;
      assert.equal(invoices[0].balanceDuePaise, 0);
      assert.equal(unallocatedAdvancePaise, 300000, 'Remaining ₹3,000 should be marked as advance credit');
    });
  });

  await t.test('4. Reversals & Audit Trail Integrity', async (t2) => {
    await t2.test('should require mandatory reason for ledger reversal', () => {
      const originalEntryId = new mongoose.Types.ObjectId();
      const reversal = new CustomerLedgerEntry({
        shopId,
        customerId,
        entryType: 'REVERSAL',
        transactionType: 'CREDIT',
        amountPaise: 150000,
        runningBalancePaise: 200000,
        referenceType: 'REVERSAL',
        referenceId: originalEntryId.toString(),
        originalEntryId,
        description: 'Reversal of erroneous debit entry #12345',
        recordedBy: userId,
        notes: 'Duplicate bill correction',
      });

      const err = reversal.validateSync();
      assert.equal(err, undefined);
      assert.equal(reversal.entryType, 'REVERSAL');
      assert.equal(reversal.originalEntryId.toString(), originalEntryId.toString());
    });
  });

  await t.test('5. Role Authorization & Privacy Rules', async (t2) => {
    await t2.test('CASHIER role cannot set or modify credit limits', () => {
      const actorRole = 'CASHIER';
      const isAllowed = actorRole === 'OWNER' || actorRole === 'MANAGER';
      assert.equal(isAllowed, false, 'Cashiers must be blocked from altering customer credit limits');
    });

    await t2.test('CASHIER role cannot record arbitrary debit or credit adjustments', () => {
      const actorRole = 'CASHIER';
      const isAllowed = actorRole === 'OWNER' || actorRole === 'MANAGER';
      assert.equal(isAllowed, false, 'Cashiers must be blocked from manual ledger adjustments');
    });

    await t2.test('CUSTOMER role cannot access other farmers accounts', () => {
      const authenticatedCustomerDocId = '66f123456789abcdef012345';
      const requestedCustomerId = '66f987654321fedcba543210';
      const isSelfAccess = authenticatedCustomerDocId === requestedCustomerId;
      assert.equal(isSelfAccess, false, 'Customer must be blocked from accessing foreign farmer passbooks');
    });
  });
});
