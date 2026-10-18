import mongoose from 'mongoose';
import { Invoice } from '../models/Invoice.js';
import { Batch } from '../models/Batch.js';
import { Expense } from '../models/Expense.js';
import { Purchase } from '../models/Purchase.js';
import { Customer } from '../models/Customer.js';
import { Supplier } from '../models/Supplier.js';
import { CustomerLedgerEntry } from '../models/CustomerLedgerEntry.js';
import { SupplierLedgerEntry } from '../models/SupplierLedgerEntry.js';
import { getProductStock } from './stockUtils.js';

/**
 * Generates an auditable sales report for a specific shop and date window.
 * Excludes cancelled invoices and aggregates by category, product, and payment mode.
 *
 * @param {string|mongoose.Types.ObjectId} shopId
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @returns {Promise<Object>} Aggregated sales report
 */
export async function generateSalesReport(shopId, startDate, endDate) {
  const shopObjectId = new mongoose.Types.ObjectId(shopId);
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Non-cancelled finalized invoices
  const invoices = await Invoice.find({
    shopId: shopObjectId,
    invoiceDate: { $gte: start, $lte: end },
    status: 'FINALIZED',
  })
    .populate('customerId', 'name phone village')
    .lean();

  // Cancelled invoices for disclosure
  const cancelledCount = await Invoice.countDocuments({
    shopId: shopObjectId,
    invoiceDate: { $gte: start, $lte: end },
    status: 'CANCELLED',
  });

  let grossSalesPaise = 0;
  let totalDiscountsPaise = 0;
  let totalTaxableAmountPaise = 0;
  let totalCgstPaise = 0;
  let totalSgstPaise = 0;
  let totalPaidPaise = 0;
  let totalCreditBalancePaise = 0;

  const productMap = new Map();
  const paymentModeMap = {
    CASH: { count: 0, amountPaise: 0 },
    UPI: { count: 0, amountPaise: 0 },
    CREDIT: { count: 0, amountPaise: 0 },
    SPLIT: { count: 0, amountPaise: 0 },
  };

  for (const inv of invoices) {
    grossSalesPaise += inv.grandTotalPaise || 0;
    totalDiscountsPaise += inv.discountPaise || 0;
    totalTaxableAmountPaise += inv.taxableAmountPaise || 0;
    totalCgstPaise += inv.cgstPaise || 0;
    totalSgstPaise += inv.sgstPaise || 0;
    totalPaidPaise += inv.paidPaise || 0;
    totalCreditBalancePaise += inv.balancePaise || 0;

    // Payment mode breakdown
    const mode = inv.paymentMode || 'CASH';
    if (!paymentModeMap[mode]) {
      paymentModeMap[mode] = { count: 0, amountPaise: 0 };
    }
    paymentModeMap[mode].count += 1;
    paymentModeMap[mode].amountPaise += inv.grandTotalPaise || 0;

    // Items aggregation
    for (const item of inv.items || []) {
      const prodKey = String(item.productId);
      if (!productMap.has(prodKey)) {
        productMap.set(prodKey, {
          productId: item.productId,
          sku: item.sku,
          nameEn: item.nameEn,
          nameMr: item.nameMr,
          baseUnit: item.baseUnit,
          quantitySold: 0,
          grossRevenuePaise: 0,
          discountPaise: 0,
          netRevenuePaise: 0,
        });
      }
      const prodStat = productMap.get(prodKey);
      prodStat.quantitySold += item.quantityBase || 0;
      prodStat.grossRevenuePaise += item.lineTotalPaise || 0;
      prodStat.discountPaise += item.lineDiscountPaise || 0;
      prodStat.netRevenuePaise += item.lineTotalPaise || 0;
    }
  }

  const productsList = Array.from(productMap.values()).sort(
    (a, b) => b.netRevenuePaise - a.netRevenuePaise
  );

  return {
    startDate: start,
    endDate: end,
    invoiceCount: invoices.length,
    cancelledInvoiceCount: cancelledCount,
    totals: {
      grossSalesPaise,
      totalDiscountsPaise,
      totalTaxableAmountPaise,
      totalCgstPaise,
      totalSgstPaise,
      totalTaxPaise: totalCgstPaise + totalSgstPaise,
      netSalesPaise: grossSalesPaise,
      totalPaidPaise,
      totalCreditBalancePaise,
    },
    paymentModes: paymentModeMap,
    topProducts: productsList.slice(0, 20),
  };
}

/**
 * Generates an authoritative profitability report estimating Gross and Operating Profit.
 * COGS is computed strictly from batch purchase costs associated with the actual batches sold.
 * Operating expenses are retrieved from approved non-reversed expenses.
 *
 * @param {string|mongoose.Types.ObjectId} shopId
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @returns {Promise<Object>} Profitability breakdown with estimates and disclosures
 */
export async function generateProfitabilityReport(shopId, startDate, endDate) {
  const shopObjectId = new mongoose.Types.ObjectId(shopId);
  const start = new Date(startDate);
  const end = new Date(endDate);

  // 1. Fetch non-cancelled finalized invoices
  const invoices = await Invoice.find({
    shopId: shopObjectId,
    invoiceDate: { $gte: start, $lte: end },
    status: 'FINALIZED',
  }).lean();

  // Collect all unique batch IDs referenced
  const batchIdSet = new Set();
  for (const inv of invoices) {
    for (const item of inv.items || []) {
      if (item.batchId) {
        batchIdSet.add(String(item.batchId));
      }
    }
  }

  // Pre-load batches in a single bulk query
  const batches = await Batch.find({
    _id: { $in: Array.from(batchIdSet).map((id) => new mongoose.Types.ObjectId(id)) },
    shopId: shopObjectId,
  }).lean();

  const batchCostMap = new Map();
  for (const b of batches) {
    batchCostMap.set(String(b._id), b.purchaseCostPaisePerBaseUnit || 0);
  }

  let totalRevenuePaise = 0;
  let totalDiscountsPaise = 0;
  let totalCogsPaise = 0;
  let estimatedItemsCount = 0;
  let reliableItemsCount = 0;

  for (const inv of invoices) {
    totalRevenuePaise += inv.grandTotalPaise || 0;
    totalDiscountsPaise += inv.discountPaise || 0;

    for (const item of inv.items || []) {
      const qty = item.quantityBase || 0;
      let unitCostPaise = 0;

      if (item.batchId && batchCostMap.has(String(item.batchId))) {
        unitCostPaise = batchCostMap.get(String(item.batchId));
        reliableItemsCount += 1;
      } else {
        // Missing batch cost data — mark as estimate
        estimatedItemsCount += 1;
      }

      const itemCogs = Math.round(qty * unitCostPaise);
      totalCogsPaise += itemCogs;
    }
  }

  const netSalesPaise = totalRevenuePaise;
  const grossProfitPaise = netSalesPaise - totalCogsPaise;
  const grossMarginPercent = netSalesPaise > 0 ? (grossProfitPaise / netSalesPaise) * 100 : 0;

  // 2. Fetch approved operating expenses
  const expenses = await Expense.find({
    shopId: shopObjectId,
    expenseDate: { $gte: start, $lte: end },
    status: 'APPROVED',
    isReversed: false,
  }).lean();

  let totalOperatingExpensesPaise = 0;
  const expenseCategoryBreakdown = {};

  for (const exp of expenses) {
    totalOperatingExpensesPaise += exp.amountPaise;
    const cat = exp.category || 'MISCELLANEOUS';
    if (!expenseCategoryBreakdown[cat]) {
      expenseCategoryBreakdown[cat] = { count: 0, amountPaise: 0 };
    }
    expenseCategoryBreakdown[cat].count += 1;
    expenseCategoryBreakdown[cat].amountPaise += exp.amountPaise;
  }

  const operatingProfitPaise = grossProfitPaise - totalOperatingExpensesPaise;
  const operatingMarginPercent = netSalesPaise > 0 ? (operatingProfitPaise / netSalesPaise) * 100 : 0;

  return {
    startDate: start,
    endDate: end,
    revenue: {
      grossSalesPaise: totalRevenuePaise,
      discountsPaise: totalDiscountsPaise,
      netSalesPaise,
    },
    cogs: {
      totalCogsPaise,
      reliableItemsCount,
      estimatedItemsCount,
      hasEstimates: estimatedItemsCount > 0,
    },
    grossProfit: {
      amountPaise: grossProfitPaise,
      marginPercent: Math.round(grossMarginPercent * 100) / 100,
    },
    operatingExpenses: {
      totalAmountPaise: totalOperatingExpensesPaise,
      categories: expenseCategoryBreakdown,
      count: expenses.length,
    },
    operatingProfit: {
      amountPaise: operatingProfitPaise,
      marginPercent: Math.round(operatingMarginPercent * 100) / 100,
    },
    disclosures: [
      'COGS calculated from verified batch purchase costs recorded at stock inward.',
      estimatedItemsCount > 0
        ? `Notice: ${estimatedItemsCount} items sold did not have linked batch purchase costs and were treated as ₹0 cost estimates.`
        : 'All items sold had complete batch purchase cost traceability.',
      'This report represents managerial estimates for shop operations and is NOT a statutory audit, legal balance sheet, or GST filing.',
    ],
  };
}

/**
 * Retrieves aggregate outstanding accounts receivable and accounts payable.
 *
 * @param {string|mongoose.Types.ObjectId} shopId
 * @returns {Promise<Object>} Receivables from customers and payables to suppliers
 */
export async function getReceivablesAndPayablesSummary(shopId) {
  const shopObjectId = new mongoose.Types.ObjectId(shopId);

  // 1. Customer Receivables
  // Sum of customer ledger entries: Debits - Credits
  const customerLedgerDebits = await CustomerLedgerEntry.aggregate([
    { $match: { shopId: shopObjectId, transactionType: 'DEBIT', isReversed: { $ne: true } } },
    { $group: { _id: null, total: { $sum: '$amountPaise' } } },
  ]);
  const customerLedgerCredits = await CustomerLedgerEntry.aggregate([
    { $match: { shopId: shopObjectId, transactionType: 'CREDIT', isReversed: { $ne: true } } },
    { $group: { _id: null, total: { $sum: '$amountPaise' } } },
  ]);

  const totalDebits = customerLedgerDebits[0]?.total || 0;
  const totalCredits = customerLedgerCredits[0]?.total || 0;
  const customerReceivablesPaise = Math.max(0, totalDebits - totalCredits);
  const customerAdvancesPaise = Math.max(0, totalCredits - totalDebits);

  // 2. Supplier Payables
  // Sum of supplier ledger entries: Credits - Debits
  const supplierLedgerCredits = await SupplierLedgerEntry.aggregate([
    { $match: { shopId: shopObjectId, transactionType: 'CREDIT', isReversed: { $ne: true } } },
    { $group: { _id: null, total: { $sum: '$amountPaise' } } },
  ]);
  const supplierLedgerDebits = await SupplierLedgerEntry.aggregate([
    { $match: { shopId: shopObjectId, transactionType: 'DEBIT', isReversed: { $ne: true } } },
    { $group: { _id: null, total: { $sum: '$amountPaise' } } },
  ]);

  const totalSupplierCredits = supplierLedgerCredits[0]?.total || 0;
  const totalSupplierDebits = supplierLedgerDebits[0]?.total || 0;
  const supplierPayablesPaise = Math.max(0, totalSupplierCredits - totalSupplierDebits);
  const supplierAdvancesPaise = Math.max(0, totalSupplierDebits - totalSupplierCredits);

  const customerCount = await Customer.countDocuments({ shopId: shopObjectId, isActive: true });
  const supplierCount = await Supplier.countDocuments({ shopId: shopObjectId, isActive: true });

  return {
    receivables: {
      totalReceivablesPaise: customerReceivablesPaise,
      totalAdvancesPaise: customerAdvancesPaise,
      customerCount,
    },
    payables: {
      totalPayablesPaise: supplierPayablesPaise,
      totalAdvancesPaise: supplierAdvancesPaise,
      supplierCount,
    },
  };
}

/**
 * Calculates current physical inventory valuation using batch purchase costs.
 *
 * @param {string|mongoose.Types.ObjectId} shopId
 * @returns {Promise<Object>} Aggregated stock valuation and product-level breakdown
 */
export async function getInventoryValuation(shopId) {
  const shopObjectId = new mongoose.Types.ObjectId(shopId);

  // Fetch all active batches
  const batches = await Batch.find({
    shopId: shopObjectId,
    status: { $in: ['ACTIVE', 'QUARANTINED'] },
  })
    .populate('productId', 'nameEn nameMr sku baseUnit categoryId')
    .lean();

  let totalValuationPaise = 0;
  let totalBatchesCount = 0;
  const batchList = [];

  for (const b of batches) {
    if (!b.productId) continue;

    // Get current verified physical stock for this product and batch
    const stockInfo = await getProductStock(shopObjectId, b.productId._id, b._id);
    const availableQty = stockInfo.availableStock || 0;

    if (availableQty > 0) {
      const batchValuePaise = Math.round(availableQty * (b.purchaseCostPaisePerBaseUnit || 0));
      totalValuationPaise += batchValuePaise;
      totalBatchesCount += 1;

      batchList.push({
        batchId: b._id,
        batchNumber: b.batchNumber,
        productId: b.productId._id,
        productNameEn: b.productId.nameEn,
        productNameMr: b.productId.nameMr,
        sku: b.productId.sku,
        baseUnit: b.productId.baseUnit,
        availableStock: availableQty,
        purchaseCostPaisePerUnit: b.purchaseCostPaisePerBaseUnit || 0,
        totalValuePaise: batchValuePaise,
        expiryDate: b.expiryDate,
        status: b.status,
      });
    }
  }

  batchList.sort((a, b) => b.totalValuePaise - a.totalValuePaise);

  return {
    totalValuationPaise,
    batchesCount: totalBatchesCount,
    batches: batchList,
  };
}
