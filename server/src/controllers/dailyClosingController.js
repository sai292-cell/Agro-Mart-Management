import mongoose from 'mongoose';
import { CashDrawerSession } from '../models/CashDrawerSession.js';
import { calculateCashMovements } from '../utils/cashbookUtils.js';

export async function getDailyClosingSummary(req, res) {
  try {
    const shopId = req.user.shopId;
    const targetDateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const startOfDay = new Date(`${targetDateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${targetDateStr}T23:59:59.999Z`);

    // Find any drawer sessions for this date
    const session = await CashDrawerSession.findOne({
      shopId,
      openedAt: { $gte: startOfDay, $lte: endOfDay },
    })
      .populate('openedBy', 'name email role')
      .populate('closedBy', 'name email role')
      .sort({ openedAt: -1 })
      .lean();

    const movements = await calculateCashMovements(shopId, startOfDay, endOfDay);

    const openingCashPaise = session ? session.openingCashPaise : 0;
    const totalCashInflowPaise = movements.cash.inflows.totalInflowPaise;
    const totalCashOutflowPaise = movements.cash.outflows.totalOutflowPaise;
    const expectedClosingCashPaise = openingCashPaise + totalCashInflowPaise - totalCashOutflowPaise;

    const actualCountedCashPaise = session?.status === 'CLOSED' ? session.closingCashCountedPaise : null;
    const cashVariancePaise =
      session?.status === 'CLOSED' ? session.variancePaise : null;

    res.json({
      success: true,
      data: {
        date: targetDateStr,
        session: session
          ? {
              id: session._id,
              sessionNumber: session.sessionNumber,
              status: session.status,
              openedAt: session.openedAt,
              openedBy: session.openedBy,
              closedAt: session.closedAt,
              closedBy: session.closedBy,
              closingNotes: session.closingNotes,
            }
          : null,
        reconciliation: {
          openingCashPaise,
          cashSalesPaise: movements.cash.inflows.salesPaise,
          cashCreditCollectionsPaise: movements.cash.inflows.collectionsPaise,
          totalCashInflowPaise,
          cashSupplierPaymentsPaise: movements.cash.outflows.supplierPaymentsPaise,
          cashExpensesPaise: movements.cash.outflows.expensesPaise,
          cashRefundsPaise: movements.cash.outflows.refundsPaise,
          totalCashOutflowPaise,
          expectedClosingCashPaise,
          actualCountedCashPaise,
          cashVariancePaise,
          isReconciled: session?.status === 'CLOSED' && cashVariancePaise === 0,
          hasVariance: session?.status === 'CLOSED' && cashVariancePaise !== 0,
        },
        digitalChannels: {
          upi: movements.upi,
          bank: movements.bank,
        },
        credit: movements.credit,
        counts: movements.counts,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getDailyClosingHistory(req, res) {
  try {
    const shopId = req.user.shopId;
    const limit = Math.min(60, Math.max(1, parseInt(req.query.limit, 10) || 30));

    const sessions = await CashDrawerSession.find({
      shopId,
      status: 'CLOSED',
    })
      .populate('openedBy', 'name email')
      .populate('closedBy', 'name email')
      .sort({ closedAt: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, data: sessions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
