import mongoose from 'mongoose';
import { Payment } from '../models/Payment.js';
import { Expense } from '../models/Expense.js';
import { Invoice } from '../models/Invoice.js';
import { CashDrawerSession } from '../models/CashDrawerSession.js';

/**
 * Calculates authoritative cash, UPI, bank, and credit movements for a given date window.
 * Reuses existing Payment, Expense, and Invoice records with zero double counting.
 *
 * @param {string|mongoose.Types.ObjectId} shopId
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @returns {Promise<Object>} Aggregated cash and non-cash financial movements
 */
export async function calculateCashMovements(shopId, startDate, endDate) {
  const shopObjectId = new mongoose.Types.ObjectId(shopId);
  const start = new Date(startDate);
  const end = new Date(endDate);

  const dateMatch = {
    shopId: shopObjectId,
    createdAt: { $gte: start, $lte: end },
    status: 'VERIFIED',
  };

  // 1. Inward payments (POS Sales and Credit Collections)
  const inwardPayments = await Payment.find({
    ...dateMatch,
    direction: 'INFLOW',
  }).lean();

  let cashSalesPaise = 0;
  let cashCreditCollectionsPaise = 0;
  let upiSalesPaise = 0;
  let upiCollectionsPaise = 0;
  let bankSalesPaise = 0;
  let bankCollectionsPaise = 0;

  for (const p of inwardPayments) {
    const isCreditCollection =
      p.paymentType === 'ACCOUNT_PAYMENT' || p.paymentType === 'ADVANCE' || (!p.invoiceId && p.customerId);

    if (p.paymentMethod === 'CASH') {
      if (isCreditCollection) {
        cashCreditCollectionsPaise += p.amountPaise;
      } else {
        cashSalesPaise += p.amountPaise;
      }
    } else if (p.paymentMethod === 'UPI') {
      if (isCreditCollection) {
        upiCollectionsPaise += p.amountPaise;
      } else {
        upiSalesPaise += p.amountPaise;
      }
    } else if (p.paymentMethod === 'BANK_TRANSFER' || p.paymentMethod === 'CHEQUE') {
      if (isCreditCollection) {
        bankCollectionsPaise += p.amountPaise;
      } else {
        bankSalesPaise += p.amountPaise;
      }
    }
  }

  // 2. Outward payments (Supplier Payments)
  const outwardPayments = await Payment.find({
    ...dateMatch,
    direction: 'OUTFLOW',
  }).lean();

  let cashSupplierPaymentsPaise = 0;
  let upiSupplierPaymentsPaise = 0;
  let bankSupplierPaymentsPaise = 0;

  for (const p of outwardPayments) {
    if (p.paymentMethod === 'CASH') {
      cashSupplierPaymentsPaise += p.amountPaise;
    } else if (p.paymentMethod === 'UPI') {
      upiSupplierPaymentsPaise += p.amountPaise;
    } else if (p.paymentMethod === 'BANK_TRANSFER' || p.paymentMethod === 'CHEQUE') {
      bankSupplierPaymentsPaise += p.amountPaise;
    }
  }

  // 3. Operating Expenses
  const expenseDateMatch = {
    shopId: shopObjectId,
    expenseDate: { $gte: start, $lte: end },
    status: 'APPROVED',
    isReversed: false,
  };

  const approvedExpenses = await Expense.find(expenseDateMatch).lean();

  let cashExpensesPaise = 0;
  let upiExpensesPaise = 0;
  let bankExpensesPaise = 0;

  for (const exp of approvedExpenses) {
    if (exp.paymentMode === 'CASH') {
      cashExpensesPaise += exp.amountPaise;
    } else if (exp.paymentMode === 'UPI') {
      upiExpensesPaise += exp.amountPaise;
    } else if (exp.paymentMode === 'BANK_TRANSFER' || exp.paymentMode === 'CHEQUE') {
      bankExpensesPaise += exp.amountPaise;
    }
  }

  // 4. Invoices finalized in date range (for credit sales tracking)
  const invoiceDateMatch = {
    shopId: shopObjectId,
    invoiceDate: { $gte: start, $lte: end },
    status: 'FINALIZED',
  };

  const finalizedInvoices = await Invoice.find(invoiceDateMatch).lean();
  let creditSalesPaise = 0;
  let grossInvoiceSalesPaise = 0;

  for (const inv of finalizedInvoices) {
    grossInvoiceSalesPaise += inv.grandTotalPaise || 0;
    // Credit portion is the balance remaining payable
    if (inv.balancePaise > 0) {
      creditSalesPaise += inv.balancePaise;
    }
  }

  // Cash movement totals
  const totalCashInflowPaise = cashSalesPaise + cashCreditCollectionsPaise;
  const totalCashOutflowPaise = cashSupplierPaymentsPaise + cashExpensesPaise;
  const netCashMovementPaise = totalCashInflowPaise - totalCashOutflowPaise;

  // Non-cash digital totals (PHYSICALLY SEPARATED FROM CASH DRAWER)
  const totalUpiInflowPaise = upiSalesPaise + upiCollectionsPaise;
  const totalUpiOutflowPaise = upiSupplierPaymentsPaise + upiExpensesPaise;
  const totalBankInflowPaise = bankSalesPaise + bankCollectionsPaise;
  const totalBankOutflowPaise = bankSupplierPaymentsPaise + bankExpensesPaise;

  return {
    startDate: start,
    endDate: end,
    cash: {
      inflows: {
        salesPaise: cashSalesPaise,
        collectionsPaise: cashCreditCollectionsPaise,
        totalInflowPaise: totalCashInflowPaise,
      },
      outflows: {
        supplierPaymentsPaise: cashSupplierPaymentsPaise,
        expensesPaise: cashExpensesPaise,
        refundsPaise: 0,
        totalOutflowPaise: totalCashOutflowPaise,
      },
      netMovementPaise: netCashMovementPaise,
    },
    upi: {
      salesPaise: upiSalesPaise,
      collectionsPaise: upiCollectionsPaise,
      totalInflowPaise: totalUpiInflowPaise,
      supplierPaymentsPaise: upiSupplierPaymentsPaise,
      expensesPaise: upiExpensesPaise,
      totalOutflowPaise: totalUpiOutflowPaise,
    },
    bank: {
      salesPaise: bankSalesPaise,
      collectionsPaise: bankCollectionsPaise,
      totalInflowPaise: totalBankInflowPaise,
      supplierPaymentsPaise: bankSupplierPaymentsPaise,
      expensesPaise: bankExpensesPaise,
      totalOutflowPaise: totalBankOutflowPaise,
    },
    credit: {
      newCreditSalesPaise: creditSalesPaise,
      collectionsPaise: cashCreditCollectionsPaise + upiCollectionsPaise + bankCollectionsPaise,
    },
    counts: {
      inwardPaymentsCount: inwardPayments.length,
      outwardPaymentsCount: outwardPayments.length,
      expensesCount: approvedExpenses.length,
      invoicesCount: finalizedInvoices.length,
    },
  };
}

/**
 * Retrieves the active open CashDrawerSession for the shop, computing live expected cash.
 * @param {string|mongoose.Types.ObjectId} shopId
 * @returns {Promise<Object|null>} Active session with computed expected cash or null
 */
export async function getActiveCashDrawerSession(shopId) {
  const session = await CashDrawerSession.findOne({
    shopId,
    status: 'OPEN',
  })
    .populate('openedBy', 'name email role')
    .lean();

  if (!session) {
    return null;
  }

  // Calculate live movements from session openedAt to now
  const now = new Date();
  const movements = await calculateCashMovements(shopId, session.openedAt, now);

  const expectedCashPaise = session.openingCashPaise + movements.cash.netMovementPaise;

  return {
    ...session,
    liveExpectedCashPaise: expectedCashPaise,
    liveMovements: movements,
  };
}
