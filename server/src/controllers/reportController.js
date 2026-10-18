import {
  generateSalesReport,
  generateProfitabilityReport,
  getReceivablesAndPayablesSummary,
  getInventoryValuation,
} from '../utils/profitabilityUtils.js';
import { Expense } from '../models/Expense.js';

export async function getSalesReport(req, res) {
  try {
    const shopId = req.user.shopId;
    const startDate = req.query.startDate
      ? new Date(req.query.startDate)
      : new Date(new Date().setHours(0, 0, 0, 0));
    const endDate = req.query.endDate
      ? new Date(req.query.endDate)
      : new Date(new Date().setHours(23, 59, 59, 999));

    const report = await generateSalesReport(shopId, startDate, endDate);
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getProfitabilityReport(req, res) {
  try {
    const shopId = req.user.shopId;
    const startDate = req.query.startDate
      ? new Date(req.query.startDate)
      : new Date(new Date().setHours(0, 0, 0, 0));
    const endDate = req.query.endDate
      ? new Date(req.query.endDate)
      : new Date(new Date().setHours(23, 59, 59, 999));

    const report = await generateProfitabilityReport(shopId, startDate, endDate);
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getExpensesReport(req, res) {
  try {
    const shopId = req.user.shopId;
    const startDate = req.query.startDate
      ? new Date(req.query.startDate)
      : new Date(new Date().setHours(0, 0, 0, 0));
    const endDate = req.query.endDate
      ? new Date(req.query.endDate)
      : new Date(new Date().setHours(23, 59, 59, 999));

    const match = {
      shopId,
      expenseDate: { $gte: startDate, $lte: endDate },
      status: 'APPROVED',
      isReversed: false,
    };

    const [categoryBreakdown, paymentModeBreakdown, totalApproved] = await Promise.all([
      Expense.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$category',
            totalAmountPaise: { $sum: '$amountPaise' },
            count: { $sum: 1 },
          },
        },
        { $sort: { totalAmountPaise: -1 } },
      ]),
      Expense.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$paymentMode',
            totalAmountPaise: { $sum: '$amountPaise' },
            count: { $sum: 1 },
          },
        },
      ]),
      Expense.aggregate([
        { $match: match },
        { $group: { _id: null, total: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        startDate,
        endDate,
        totalExpensesPaise: totalApproved[0]?.total || 0,
        totalExpensesCount: totalApproved[0]?.count || 0,
        byCategory: categoryBreakdown,
        byPaymentMode: paymentModeBreakdown,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getReceivablesAndPayables(req, res) {
  try {
    const shopId = req.user.shopId;
    const summary = await getReceivablesAndPayablesSummary(shopId);
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getInventoryValuationReport(req, res) {
  try {
    const shopId = req.user.shopId;
    const valuation = await getInventoryValuation(shopId);
    res.json({ success: true, data: valuation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getFinancialSummary(req, res) {
  try {
    const shopId = req.user.shopId;
    const startDate = req.query.startDate
      ? new Date(req.query.startDate)
      : new Date(new Date().setHours(0, 0, 0, 0));
    const endDate = req.query.endDate
      ? new Date(req.query.endDate)
      : new Date(new Date().setHours(23, 59, 59, 999));

    const [profitability, debtSummary] = await Promise.all([
      generateProfitabilityReport(shopId, startDate, endDate),
      getReceivablesAndPayablesSummary(shopId),
    ]);

    res.json({
      success: true,
      data: {
        startDate,
        endDate,
        revenue: profitability.revenue,
        cogs: profitability.cogs,
        grossProfit: profitability.grossProfit,
        operatingExpenses: profitability.operatingExpenses,
        operatingProfit: profitability.operatingProfit,
        receivables: debtSummary.receivables,
        payables: debtSummary.payables,
        disclosures: profitability.disclosures,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
