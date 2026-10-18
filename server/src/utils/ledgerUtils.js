import mongoose from 'mongoose';
import { CustomerLedgerEntry } from '../models/CustomerLedgerEntry.js';
import { Customer } from '../models/Customer.js';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';
import { PaymentAllocation } from '../models/PaymentAllocation.js';

/**
 * Records an immutable CustomerLedgerEntry within an optional Mongoose transaction session.
 * Automatically computes the new running balance:
 * - DEBIT: Increases balance owed (balance += amountPaise)
 * - CREDIT: Decreases balance owed (balance -= amountPaise)
 *
 * @param {Object} params Ledger entry attributes
 * @param {Object} [options] Query options, e.g. { session }
 * @returns {Promise<CustomerLedgerEntry>} Created ledger entry
 */
export async function recordCustomerLedgerEntry(params, options = {}) {
  const {
    shopId,
    customerId,
    entryType,
    transactionType,
    amountPaise,
    referenceType = 'OTHER',
    referenceId = '',
    invoiceId = null,
    paymentId = null,
    originalEntryId = null,
    dueDate = null,
    description,
    recordedBy,
    approvedBy = null,
    idempotencyKey = null,
    notes = '',
  } = params;

  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new Error('Ledger transaction amount must be a positive integer in paise.');
  }

  const queryOptions = options.session ? { session: options.session } : {};

  // Check idempotency if key provided
  if (idempotencyKey) {
    const existing = await CustomerLedgerEntry.findOne(
      { shopId, idempotencyKey },
      null,
      queryOptions
    );
    if (existing) {
      return existing;
    }
  }

  // Find the latest ledger entry for this customer to determine current balance
  const lastEntry = await CustomerLedgerEntry.findOne(
    { shopId, customerId },
    null,
    queryOptions
  ).sort({ createdAt: -1, _id: -1 });

  const currentBalancePaise = lastEntry ? lastEntry.runningBalancePaise : 0;

  let newRunningBalancePaise = currentBalancePaise;
  if (transactionType === 'DEBIT') {
    newRunningBalancePaise = currentBalancePaise + amountPaise;
  } else if (transactionType === 'CREDIT') {
    newRunningBalancePaise = currentBalancePaise - amountPaise;
  } else {
    throw new Error(`Invalid transactionType: ${transactionType}. Must be DEBIT or CREDIT.`);
  }

  const [entry] = await CustomerLedgerEntry.create(
    [
      {
        shopId,
        customerId,
        entryType,
        transactionType,
        amountPaise,
        runningBalancePaise: newRunningBalancePaise,
        referenceType,
        referenceId,
        invoiceId,
        paymentId,
        originalEntryId,
        dueDate,
        description,
        recordedBy,
        approvedBy,
        idempotencyKey: idempotencyKey || undefined,
        notes,
      },
    ],
    queryOptions
  );

  // Update customer's lastPaymentDate and credit status if this is a payment
  if (entryType === 'PAYMENT_RECEIVED') {
    await Customer.updateOne(
      { _id: customerId, shopId },
      { $set: { lastPaymentDate: new Date() } },
      queryOptions
    );
  }

  return entry;
}

/**
 * Gets the authoritative outstanding balance for a customer.
 * Defaults to the latest entry runningBalancePaise, or 0 if no entries exist.
 */
export async function getCustomerLedgerBalance(shopId, customerId, options = {}) {
  const queryOptions = options.session ? { session: options.session } : {};
  const lastEntry = await CustomerLedgerEntry.findOne(
    { shopId, customerId },
    null,
    queryOptions
  ).sort({ createdAt: -1, _id: -1 });

  return lastEntry ? lastEntry.runningBalancePaise : 0;
}

/**
 * Allocates a payment amount across unpaid invoices for a customer (FIFO or explicit list).
 * Updates invoice paidAmountPaise, balanceDuePaise, and paymentStatus.
 * Creates PaymentAllocation records.
 */
export async function allocatePaymentToInvoices({
  shopId,
  customerId,
  paymentId,
  amountPaise,
  allocatedBy,
  invoiceAllocations = null, // optional: [{ invoiceId, amountPaise }]
  options = {},
}) {
  const queryOptions = options.session ? { session: options.session } : {};
  let remainingToAllocate = amountPaise;
  const allocationsCreated = [];

  let targetInvoices = [];

  if (invoiceAllocations && invoiceAllocations.length > 0) {
    // Explicit allocations specified
    for (const alloc of invoiceAllocations) {
      const inv = await Invoice.findOne({ _id: alloc.invoiceId, shopId, customerId }, null, queryOptions);
      if (inv && inv.status !== 'CANCELLED' && inv.balanceDuePaise > 0) {
        targetInvoices.push({ invoice: inv, specifiedAmount: alloc.amountPaise });
      }
    }
  } else {
    // Automatic FIFO allocation (oldest unpaid invoice first)
    const unpaidInvoices = await Invoice.find(
      {
        shopId,
        customerId,
        status: 'FINALIZED',
        balanceDuePaise: { $gt: 0 },
      },
      null,
      queryOptions
    ).sort({ invoiceDate: 1, _id: 1 });

    targetInvoices = unpaidInvoices.map((inv) => ({ invoice: inv, specifiedAmount: null }));
  }

  for (const item of targetInvoices) {
    if (remainingToAllocate <= 0) break;

    const inv = item.invoice;
    const maxAllocatable = inv.balanceDuePaise;
    const allocAmount = item.specifiedAmount
      ? Math.min(item.specifiedAmount, maxAllocatable, remainingToAllocate)
      : Math.min(maxAllocatable, remainingToAllocate);

    if (allocAmount <= 0) continue;

    inv.paidAmountPaise += allocAmount;
    inv.balanceDuePaise -= allocAmount;
    inv.paymentStatus = inv.balanceDuePaise === 0 ? 'PAID' : 'PARTIALLY_PAID';
    await inv.save(queryOptions);

    const [allocationDoc] = await PaymentAllocation.create(
      [
        {
          shopId,
          customerId,
          paymentId,
          invoiceId: inv._id,
          allocatedAmountPaise: allocAmount,
          allocatedBy,
          notes: `Allocated to invoice ${inv.invoiceNumber}`,
        },
      ],
      queryOptions
    );

    allocationsCreated.push(allocationDoc);
    remainingToAllocate -= allocAmount;
  }

  return {
    allocatedPaise: amountPaise - remainingToAllocate,
    unallocatedAdvancePaise: remainingToAllocate,
    allocations: allocationsCreated,
  };
}

/**
 * Reconciles customer ledger against actual finalized invoices and payments.
 * Detects any mathematical or synchronization discrepancies without silently mutating data.
 */
export async function reconcileCustomerAccount(shopId, customerId) {
  const customer = await Customer.findOne({ _id: customerId, shopId }).lean();
  if (!customer) throw new Error('Customer not found');

  // 1. All ledger entries
  const ledgerEntries = await CustomerLedgerEntry.find({ shopId, customerId })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  let sumDebits = 0;
  let sumCredits = 0;
  let runningCheck = 0;
  let runningBalanceDiscrepancy = false;

  for (const entry of ledgerEntries) {
    if (entry.transactionType === 'DEBIT') {
      sumDebits += entry.amountPaise;
      runningCheck += entry.amountPaise;
    } else {
      sumCredits += entry.amountPaise;
      runningCheck -= entry.amountPaise;
    }

    if (entry.runningBalancePaise !== runningCheck) {
      runningBalanceDiscrepancy = true;
    }
  }

  const calculatedLedgerBalancePaise = sumDebits - sumCredits;
  const latestEntryBalancePaise = ledgerEntries.length > 0
    ? ledgerEntries[ledgerEntries.length - 1].runningBalancePaise
    : 0;

  // 2. All finalized invoices for customer
  const invoices = await Invoice.find({ shopId, customerId, status: 'FINALIZED' }).lean();
  const totalInvoiceDebtPaise = invoices.reduce((acc, inv) => acc + (inv.balanceDuePaise || 0), 0);
  const totalInvoiceGrandTotalPaise = invoices.reduce((acc, inv) => acc + (inv.grandTotalPaise || 0), 0);
  const totalInvoicePaidPaise = invoices.reduce((acc, inv) => acc + (inv.paidAmountPaise || 0), 0);

  // 3. All payments for customer
  const payments = await Payment.find({ shopId, customerId, status: 'VERIFIED' }).lean();
  const totalPaymentsReceivedPaise = payments.reduce((acc, p) => acc + p.amountPaise, 0);

  // 4. All allocations
  const allocations = await PaymentAllocation.find({ shopId, customerId }).lean();
  const totalAllocatedPaise = allocations.reduce((acc, a) => acc + a.allocatedAmountPaise, 0);

  const discrepancies = [];

  if (calculatedLedgerBalancePaise !== latestEntryBalancePaise) {
    discrepancies.push({
      code: 'RUNNING_BALANCE_MISMATCH',
      message: `Calculated ledger balance (₹${(calculatedLedgerBalancePaise / 100).toFixed(2)}) differs from latest entry snapshot (₹${(latestEntryBalancePaise / 100).toFixed(2)}).`,
    });
  }

  if (runningBalanceDiscrepancy) {
    discrepancies.push({
      code: 'RUNNING_BALANCE_SEQUENCE_ERROR',
      message: 'One or more ledger entries have an internal running balance mismatch in historical sequence.',
    });
  }

  const creditLimitExceeded = customer.creditLimitPaise > 0 && latestEntryBalancePaise > customer.creditLimitPaise;
  if (creditLimitExceeded) {
    discrepancies.push({
      code: 'CREDIT_LIMIT_EXCEEDED',
      message: `Outstanding balance ₹${(latestEntryBalancePaise / 100).toFixed(2)} exceeds approved limit of ₹${(customer.creditLimitPaise / 100).toFixed(2)}.`,
    });
  }

  return {
    customerId: customer._id,
    customerName: customer.name,
    isConsistent: discrepancies.length === 0,
    creditLimitPaise: customer.creditLimitPaise,
    latestBalancePaise: latestEntryBalancePaise,
    calculatedLedgerBalancePaise,
    totalDebitsPaise: sumDebits,
    totalCreditsPaise: sumCredits,
    ledgerEntriesCount: ledgerEntries.length,
    activeInvoicesCount: invoices.length,
    totalInvoiceDebtPaise,
    totalPaymentsReceivedPaise,
    totalAllocatedPaise,
    discrepancies,
  };
}

/**
 * Calculates aging buckets for outstanding invoices of a customer:
 * - 0 to 30 days
 * - 31 to 60 days
 * - 61 to 90 days
 * - Over 90 days
 */
export async function calculateCustomerAging(shopId, customerId) {
  const invoices = await Invoice.find({
    shopId,
    customerId,
    status: 'FINALIZED',
    balanceDuePaise: { $gt: 0 },
  }).lean();

  const now = new Date();
  const buckets = {
    current0To30Paise: 0,
    days31To60Paise: 0,
    days61To90Paise: 0,
    over90DaysPaise: 0,
    totalOverduePaise: 0,
  };

  for (const inv of invoices) {
    const ageDays = Math.floor((now - new Date(inv.invoiceDate)) / (1000 * 60 * 60 * 24));
    const balance = inv.balanceDuePaise;

    if (ageDays <= 30) {
      buckets.current0To30Paise += balance;
    } else if (ageDays <= 60) {
      buckets.days31To60Paise += balance;
      buckets.totalOverduePaise += balance;
    } else if (ageDays <= 90) {
      buckets.days61To90Paise += balance;
      buckets.totalOverduePaise += balance;
    } else {
      buckets.over90DaysPaise += balance;
      buckets.totalOverduePaise += balance;
    }
  }

  return buckets;
}
