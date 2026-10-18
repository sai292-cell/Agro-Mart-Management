import mongoose from 'mongoose';
import { CashDrawerSession } from '../models/CashDrawerSession.js';
import { Counter } from '../models/Counter.js';
import { AuditLog } from '../models/AuditLog.js';
import { withTransaction } from '../utils/transactionUtils.js';
import { calculateCashMovements, getActiveCashDrawerSession } from '../utils/cashbookUtils.js';
import { openDrawerSessionSchema, closeDrawerSessionSchema } from '../validators/cashbookValidators.js';

export async function getActiveSession(req, res) {
  try {
    const shopId = req.user.shopId;
    const activeSession = await getActiveCashDrawerSession(shopId);

    res.json({
      success: true,
      data: activeSession,
      hasActiveSession: !!activeSession,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function openSession(req, res) {
  try {
    const shopId = req.user.shopId;
    const validated = openDrawerSessionSchema.parse(req.body);

    // Guard: Only one open session per shop allowed
    const existing = await CashDrawerSession.findOne({ shopId, status: 'OPEN' }).lean();
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `A cash drawer session (${existing.sessionNumber}) is already OPEN. You must close it before opening a new session.`,
        data: existing,
      });
    }

    const session = await withTransaction(async (dbSession) => {
      const seq = await Counter.getNextSequence(shopId, 'CASH_DRAWER_SESSION', dbSession);
      const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
      const sessionNumber = `CDS-${dateStr}-${String(seq).padStart(5, '0')}`;

      const newSession = new CashDrawerSession({
        shopId,
        sessionNumber,
        status: 'OPEN',
        openedBy: req.user._id,
        openedAt: new Date(),
        openingCashPaise: validated.openingCashPaise,
        openingNotes: validated.openingNotes || '',
      });

      await newSession.save({ session: dbSession });

      await AuditLog.create(
        [
          {
            shopId,
            userId: req.user._id,
            action: 'CASH_DRAWER_OPEN',
            entityType: 'CashDrawerSession',
            entityId: newSession._id,
            details: {
              sessionNumber,
              openingCashPaise: validated.openingCashPaise,
            },
          },
        ],
        { session: dbSession }
      );

      return newSession;
    });

    res.status(201).json({
      success: true,
      data: session,
      message: `Cash drawer session ${session.sessionNumber} opened successfully.`,
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function closeSession(req, res) {
  try {
    const shopId = req.user.shopId;
    const validated = closeDrawerSessionSchema.parse(req.body);

    const activeSession = await CashDrawerSession.findOne({ shopId, status: 'OPEN' });
    if (!activeSession) {
      return res.status(400).json({
        success: false,
        message: 'No open cash drawer session found for this shop.',
      });
    }

    const now = new Date();
    // Calculate authoritative movements during the session window
    const movements = await calculateCashMovements(shopId, activeSession.openedAt, now);

    const expectedCashPaise = activeSession.openingCashPaise + movements.cash.netMovementPaise;
    const variancePaise = validated.closingCashCountedPaise - expectedCashPaise;

    // If variance is non-zero, require an explanation
    if (variancePaise !== 0 && (!validated.closingNotes || validated.closingNotes.trim().length < 3)) {
      return res.status(400).json({
        success: false,
        message: `Cash discrepancy detected (${variancePaise > 0 ? 'Surplus' : 'Deficit'} of ₹${(Math.abs(variancePaise) / 100).toFixed(2)}). An explanatory closing note (min 3 characters) is required.`,
      });
    }

    const closedSession = await withTransaction(async (dbSession) => {
      activeSession.status = 'CLOSED';
      activeSession.closedBy = req.user._id;
      activeSession.closedAt = now;
      activeSession.closingCashCountedPaise = validated.closingCashCountedPaise;
      activeSession.expectedCashPaise = expectedCashPaise;
      activeSession.variancePaise = variancePaise;
      activeSession.closingNotes = validated.closingNotes || '';
      activeSession.breakdown = {
        cashSalesPaise: movements.cash.inflows.salesPaise,
        cashCreditCollectionsPaise: movements.cash.inflows.collectionsPaise,
        cashSupplierPaymentsPaise: movements.cash.outflows.supplierPaymentsPaise,
        cashExpensesPaise: movements.cash.outflows.expensesPaise,
        cashRefundsPaise: movements.cash.outflows.refundsPaise,
        upiSalesPaise: movements.upi.salesPaise,
        bankSalesPaise: movements.bank.salesPaise,
        upiCollectionsPaise: movements.upi.collectionsPaise,
        bankCollectionsPaise: movements.bank.collectionsPaise,
        upiSupplierPaymentsPaise: movements.upi.supplierPaymentsPaise,
        bankSupplierPaymentsPaise: movements.bank.supplierPaymentsPaise,
        upiExpensesPaise: movements.upi.expensesPaise,
        bankExpensesPaise: movements.bank.expensesPaise,
        creditSalesPaise: movements.credit.newCreditSalesPaise,
      };

      await activeSession.save({ session: dbSession });

      await AuditLog.create(
        [
          {
            shopId,
            userId: req.user._id,
            action: 'CASH_DRAWER_CLOSE',
            entityType: 'CashDrawerSession',
            entityId: activeSession._id,
            details: {
              sessionNumber: activeSession.sessionNumber,
              expectedCashPaise,
              closingCashCountedPaise: validated.closingCashCountedPaise,
              variancePaise,
              closingNotes: validated.closingNotes,
            },
          },
        ],
        { session: dbSession }
      );

      return activeSession;
    });

    res.json({
      success: true,
      data: closedSession,
      message: `Cash drawer session ${closedSession.sessionNumber} closed successfully.`,
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function listSessions(req, res) {
  try {
    const shopId = req.user.shopId;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = { shopId };
    if (req.query.status) {
      query.status = req.query.status;
    }

    const [sessions, total] = await Promise.all([
      CashDrawerSession.find(query)
        .populate('openedBy', 'name email role')
        .populate('closedBy', 'name email role')
        .sort({ openedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CashDrawerSession.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getCashMovements(req, res) {
  try {
    const shopId = req.user.shopId;
    const startDate = req.query.startDate
      ? new Date(req.query.startDate)
      : new Date(new Date().setHours(0, 0, 0, 0));
    const endDate = req.query.endDate
      ? new Date(req.query.endDate)
      : new Date(new Date().setHours(23, 59, 59, 999));

    const movements = await calculateCashMovements(shopId, startDate, endDate);

    res.json({
      success: true,
      data: movements,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
