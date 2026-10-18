import mongoose from 'mongoose';
import {
  SupplierLedgerEntry,
  Purchase,
  Payment,
  PaymentAllocation,
} from '../models/index.js';

/**
 * Returns current outstanding payable balance for a supplier derived from the ledger.
 * Net Payable = Sum(CREDIT) - Sum(DEBIT).
 * Balance > 0: Shop owes supplier.
 * Balance < 0: Shop has advance credit with supplier.
 *
 * @param {mongoose.Types.ObjectId|string} shopId
 * @param {mongoose.Types.ObjectId|string} supplierId
 * @param {mongoose.ClientSession|null} [session=null]
 * @returns {Promise<number>} Net balance in paise
 */
export async function getSupplierLedgerBalance(shopId, supplierId, session = null) {
  const match = {
    shopId: new mongoose.Types.ObjectId(shopId),
    supplierId: new mongoose.Types.ObjectId(supplierId),
    isReversed: false,
  };

  const aggregateQuery = SupplierLedgerEntry.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$supplierId',
        totalCredit: {
          $sum: {
            $cond: [{ $eq: ['$transactionType', 'CREDIT'] }, '$amountPaise', 0],
          },
        },
        totalDebit: {
          $sum: {
            $cond: [{ $eq: ['$transactionType', 'DEBIT'] }, '$amountPaise', 0],
          },
        },
      },
    },
  ]);

  if (session) {
    aggregateQuery.session(session);
  }

  const result = await aggregateQuery;
  if (!result || result.length === 0) {
    return 0;
  }

  return result[0].totalCredit - result[0].totalDebit;
}

/**
 * Records an immutable SupplierLedgerEntry.
 *
 * @param {Object} params
 * @param {mongoose.Types.ObjectId|string} params.shopId
 * @param {mongoose.Types.ObjectId|string} params.supplierId
 * @param {string} params.entryType
 * @param {string} params.transactionType - 'CREDIT' (increases payable) or 'DEBIT' (decreases payable)
 * @param {number} params.amountPaise
 * @param {string} params.referenceType
 * @param {string} [params.referenceId='']
 * @param {string} params.description
 * @param {string} [params.notes='']
 * @param {Object} [params.metadata={}]
 * @param {mongoose.Types.ObjectId|string} params.recordedBy
 * @param {string} [params.idempotencyKey]
 * @param {mongoose.ClientSession|null} [session=null]
 * @returns {Promise<SupplierLedgerEntry>}
 */
export async function recordSupplierLedgerEntry(params, session = null) {
  const {
    shopId,
    supplierId,
    entryType,
    transactionType,
    amountPaise,
    referenceType,
    referenceId = '',
    description,
    notes = '',
    metadata = {},
    recordedBy,
    idempotencyKey,
  } = params;

  if (amountPaise <= 0 || !Number.isInteger(amountPaise)) {
    throw new Error('Ledger entry amount must be a positive integer in paise');
  }

  // Idempotency check
  if (idempotencyKey) {
    const existing = await SupplierLedgerEntry.findOne({
      shopId,
      idempotencyKey,
    }).session(session);
    if (existing) {
      return existing;
    }
  }

  // Calculate new running balance
  const currentBalance = await getSupplierLedgerBalance(shopId, supplierId, session);
  let newBalance = currentBalance;
  if (transactionType === 'CREDIT') {
    newBalance += amountPaise;
  } else if (transactionType === 'DEBIT') {
    newBalance -= amountPaise;
  } else {
    throw new Error(`Invalid transaction type: ${transactionType}`);
  }

  const [entry] = await SupplierLedgerEntry.create(
    [
      {
        shopId,
        supplierId,
        entryType,
        transactionType,
        amountPaise,
        runningBalancePaise: newBalance,
        referenceType,
        referenceId,
        description,
        notes,
        metadata,
        recordedBy,
        idempotencyKey: idempotencyKey || undefined,
      },
    ],
    { session }
  );

  return entry;
}

/**
 * Allocates a payment across one or more unpaid/partially-paid purchases for a supplier.
 *
 * @param {Object} params
 * @param {mongoose.Types.ObjectId|string} params.shopId
 * @param {mongoose.Types.ObjectId|string} params.supplierId
 * @param {mongoose.Types.ObjectId|string} params.paymentId
 * @param {number} params.amountPaise
 * @param {Array<{ purchaseId: string, amountPaise: number }>} [params.allocations]
 * @param {boolean} [params.autoFifo=true]
 * @param {mongoose.Types.ObjectId|string} params.allocatedBy
 * @param {mongoose.ClientSession|null} [session=null]
 * @returns {Promise<{ allocatedTotalPaise: number, unallocatedPaise: number, allocations: Array<PaymentAllocation> }>}
 */
export async function allocateSupplierPayment(params, session = null) {
  const {
    shopId,
    supplierId,
    paymentId,
    amountPaise,
    allocations = [],
    autoFifo = true,
    allocatedBy,
  } = params;

  let remainingToAllocate = amountPaise;
  const createdAllocations = [];

  if (Array.isArray(allocations) && allocations.length > 0) {
    // Custom allocation mode
    for (const alloc of allocations) {
      if (remainingToAllocate <= 0) break;
      const targetPaise = Math.min(Number(alloc.amountPaise), remainingToAllocate);
      if (targetPaise <= 0) continue;

      const purchase = await Purchase.findOne({
        _id: alloc.purchaseId,
        shopId,
        supplierId,
        status: 'RECEIVED',
      }).session(session);

      if (!purchase) {
        throw new Error(`Purchase ${alloc.purchaseId} not found or not in RECEIVED status`);
      }

      if (targetPaise > purchase.balancePaise) {
        throw new Error(
          `Allocated amount (${targetPaise} paise) exceeds outstanding balance (${purchase.balancePaise} paise) on purchase ${purchase.purchaseNumber}`
        );
      }

      const [pa] = await PaymentAllocation.create(
        [
          {
            shopId,
            supplierId,
            targetType: 'PURCHASE',
            paymentId,
            purchaseId: purchase._id,
            allocatedAmountPaise: targetPaise,
            allocatedBy,
          },
        ],
        { session }
      );

      purchase.paidPaise += targetPaise;
      purchase.balancePaise = Math.max(0, purchase.grandTotalPaise - purchase.paidPaise);
      purchase.paymentStatus =
        purchase.balancePaise === 0 ? 'PAID' : (purchase.paidPaise > 0 ? 'PARTIALLY_PAID' : 'UNPAID');
      await purchase.save({ session });

      createdAllocations.push(pa);
      remainingToAllocate -= targetPaise;
    }
  } else if (autoFifo) {
    // FIFO allocation mode
    const unpaidPurchases = await Purchase.find({
      shopId,
      supplierId,
      status: 'RECEIVED',
      balancePaise: { $gt: 0 },
    })
      .sort({ purchaseDate: 1, createdAt: 1 })
      .session(session);

    for (const purchase of unpaidPurchases) {
      if (remainingToAllocate <= 0) break;

      const targetPaise = Math.min(purchase.balancePaise, remainingToAllocate);

      const [pa] = await PaymentAllocation.create(
        [
          {
            shopId,
            supplierId,
            targetType: 'PURCHASE',
            paymentId,
            purchaseId: purchase._id,
            allocatedAmountPaise: targetPaise,
            allocatedBy,
          },
        ],
        { session }
      );

      purchase.paidPaise += targetPaise;
      purchase.balancePaise = Math.max(0, purchase.grandTotalPaise - purchase.paidPaise);
      purchase.paymentStatus =
        purchase.balancePaise === 0 ? 'PAID' : (purchase.paidPaise > 0 ? 'PARTIALLY_PAID' : 'UNPAID');
      await purchase.save({ session });

      createdAllocations.push(pa);
      remainingToAllocate -= targetPaise;
    }
  }

  const allocatedTotalPaise = amountPaise - remainingToAllocate;
  return {
    allocatedTotalPaise,
    unallocatedPaise: remainingToAllocate,
    allocations: createdAllocations,
  };
}

/**
 * Calculates aging buckets for unpaid supplier purchases.
 *
 * @param {mongoose.Types.ObjectId|string} shopId
 * @param {mongoose.Types.ObjectId|string} supplierId
 * @returns {Promise<Object>} Aging breakdown in integer paise
 */
export async function calculateSupplierAging(shopId, supplierId) {
  const purchases = await Purchase.find({
    shopId,
    supplierId,
    status: 'RECEIVED',
    balancePaise: { $gt: 0 },
  }).select('purchaseDate balancePaise');

  const now = Date.now();
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  let current0_30Paise = 0;
  let overdue31_60Paise = 0;
  let delinquent61_90Paise = 0;
  let highlyDelinquent90PlusPaise = 0;
  let totalOutstandingPaise = 0;

  for (const p of purchases) {
    const ageDays = Math.floor((now - new Date(p.purchaseDate).getTime()) / MS_PER_DAY);
    const balance = p.balancePaise;
    totalOutstandingPaise += balance;

    if (ageDays <= 30) {
      current0_30Paise += balance;
    } else if (ageDays <= 60) {
      overdue31_60Paise += balance;
    } else if (ageDays <= 90) {
      delinquent61_90Paise += balance;
    } else {
      highlyDelinquent90PlusPaise += balance;
    }
  }

  return {
    current0_30Paise,
    overdue31_60Paise,
    delinquent61_90Paise,
    highlyDelinquent90PlusPaise,
    totalOutstandingPaise,
  };
}

/**
 * Audits supplier account consistency by reconciling ledger entries against
 * Purchase records and Payment documents.
 *
 * @param {mongoose.Types.ObjectId|string} shopId
 * @param {mongoose.Types.ObjectId|string} supplierId
 * @returns {Promise<Object>}
 */
export async function reconcileSupplierAccount(shopId, supplierId) {
  const [ledgerEntries, purchases, payments, allocations] = await Promise.all([
    SupplierLedgerEntry.find({ shopId, supplierId }),
    Purchase.find({ shopId, supplierId, status: { $ne: 'CANCELLED' } }),
    Payment.find({ shopId, supplierId, status: 'VERIFIED' }),
    PaymentAllocation.find({ shopId, supplierId, targetType: 'PURCHASE' }),
  ]);

  const anomalies = [];

  // 1. Ledger Balance Calculation
  let ledgerCreditPaise = 0;
  let ledgerDebitPaise = 0;
  for (const entry of ledgerEntries) {
    if (!entry.isReversed) {
      if (entry.transactionType === 'CREDIT') {
        ledgerCreditPaise += entry.amountPaise;
      } else {
        ledgerDebitPaise += entry.amountPaise;
      }
    }
  }
  const ledgerBalancePaise = ledgerCreditPaise - ledgerDebitPaise;

  // 2. Sum of Received Purchases
  let totalReceivedPurchasesPaise = 0;
  for (const p of purchases) {
    if (p.status === 'RECEIVED') {
      totalReceivedPurchasesPaise += p.grandTotalPaise;
    }
  }

  // 3. Sum of Payments
  let totalPaymentsPaise = 0;
  for (const pay of payments) {
    totalPaymentsPaise += pay.amountPaise;
  }

  // 4. Verify Purchase Paid vs Allocations
  for (const p of purchases) {
    if (p.status === 'RECEIVED') {
      const pAllocations = allocations.filter(
        (a) => a.purchaseId && a.purchaseId.toString() === p._id.toString()
      );
      const allocatedSum = pAllocations.reduce((sum, a) => sum + a.allocatedAmountPaise, 0);

      if (allocatedSum !== p.paidPaise) {
        anomalies.push({
          type: 'PURCHASE_ALLOCATION_MISMATCH',
          purchaseId: p._id,
          purchaseNumber: p.purchaseNumber,
          recordedPaidPaise: p.paidPaise,
          allocatedSumPaise: allocatedSum,
        });
      }
    }
  }

  // 5. Verify Reversals Linkage
  for (const entry of ledgerEntries) {
    if (entry.entryType === 'REVERSAL') {
      if (!entry.originalEntryId) {
        anomalies.push({
          type: 'ORPHAN_REVERSAL_ENTRY',
          entryId: entry._id,
          description: entry.description,
        });
      }
    }
  }

  return {
    isConsistent: anomalies.length === 0,
    anomalies,
    ledgerBalancePaise,
    ledgerCreditPaise,
    ledgerDebitPaise,
    totalReceivedPurchasesPaise,
    totalPaymentsPaise,
    totalAllocationsCount: allocations.length,
    activePurchasesCount: purchases.filter((p) => p.status === 'RECEIVED').length,
  };
}
