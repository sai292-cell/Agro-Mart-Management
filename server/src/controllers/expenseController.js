import mongoose from 'mongoose';
import { Expense } from '../models/Expense.js';
import { Counter } from '../models/Counter.js';
import { AuditLog } from '../models/AuditLog.js';
import { withTransaction } from '../utils/transactionUtils.js';
import {
  createExpenseSchema,
  rejectExpenseSchema,
  reverseExpenseSchema,
} from '../validators/expenseValidators.js';

export async function listExpenses(req, res) {
  try {
    const shopId = req.user.shopId;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = { shopId };

    if (req.query.category) {
      query.category = req.query.category;
    }
    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.paymentMode) {
      query.paymentMode = req.query.paymentMode;
    }
    if (req.query.startDate || req.query.endDate) {
      query.expenseDate = {};
      if (req.query.startDate) {
        query.expenseDate.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        query.expenseDate.$lte = new Date(req.query.endDate);
      }
    }
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      query.$or = [
        { expenseNumber: searchRegex },
        { description: searchRegex },
        { payee: searchRegex },
        { referenceNumber: searchRegex },
      ];
    }

    const [expenses, total] = await Promise.all([
      Expense.find(query)
        .populate('createdBy', 'name email role')
        .populate('approvedBy', 'name email role')
        .sort({ expenseDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Expense.countDocuments(query),
    ]);

    // Aggregate category totals for current query match (approved only)
    const approvedStats = await Expense.aggregate([
      { $match: { ...query, status: 'APPROVED', isReversed: false } },
      { $group: { _id: null, totalApprovedPaise: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      data: expenses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalApprovedPaise: approvedStats[0]?.totalApprovedPaise || 0,
        approvedCount: approvedStats[0]?.count || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function createExpense(req, res) {
  try {
    const shopId = req.user.shopId;
    const validatedData = createExpenseSchema.parse(req.body);

    // Idempotency check
    if (validatedData.idempotencyKey) {
      const existing = await Expense.findOne({
        shopId,
        idempotencyKey: validatedData.idempotencyKey,
      }).lean();
      if (existing) {
        return res.status(200).json({
          success: true,
          data: existing,
          isDuplicate: true,
          message: 'Expense already recorded with this idempotency key',
        });
      }
    }

    const userRole = req.user.role;
    // Owners and Managers have their expenses automatically approved
    const isAutoApproved = userRole === 'OWNER' || userRole === 'MANAGER';
    const status = isAutoApproved ? 'APPROVED' : 'PENDING_APPROVAL';

    const result = await withTransaction(async (session) => {
      const seq = await Counter.getNextSequence(shopId, 'EXPENSE', session);
      const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
      const expenseNumber = `EXP-${dateStr}-${String(seq).padStart(5, '0')}`;

      const expense = new Expense({
        ...validatedData,
        shopId,
        expenseNumber,
        status,
        createdBy: req.user._id,
        approvedBy: isAutoApproved ? req.user._id : null,
        approvedAt: isAutoApproved ? new Date() : null,
        expenseDate: validatedData.expenseDate ? new Date(validatedData.expenseDate) : new Date(),
      });

      await expense.save({ session });

      await AuditLog.create(
        [
          {
            shopId,
            userId: req.user._id,
            action: 'EXPENSE_CREATE',
            entityType: 'Expense',
            entityId: expense._id,
            details: {
              expenseNumber,
              amountPaise: expense.amountPaise,
              category: expense.category,
              paymentMode: expense.paymentMode,
              payee: expense.payee,
              status,
            },
          },
        ],
        { session }
      );

      return expense;
    });

    res.status(201).json({
      success: true,
      data: result,
      message:
        status === 'APPROVED'
          ? 'Operating expense recorded and approved successfully'
          : 'Expense submitted and awaiting manager/owner approval',
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getExpenseById(req, res) {
  try {
    const shopId = req.user.shopId;
    const expense = await Expense.findOne({ _id: req.params.id, shopId })
      .populate('createdBy', 'name email role')
      .populate('approvedBy', 'name email role')
      .populate('rejectedBy', 'name email role')
      .populate('reversedByExpenseId', 'expenseNumber amountPaise createdAt')
      .populate('originalExpenseId', 'expenseNumber amountPaise createdAt')
      .lean();

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense record not found' });
    }

    res.json({ success: true, data: expense });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function approveExpense(req, res) {
  try {
    const shopId = req.user.shopId;
    const expense = await Expense.findOne({ _id: req.params.id, shopId });

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    if (expense.status === 'APPROVED') {
      return res.status(400).json({ success: false, message: 'Expense is already approved' });
    }
    if (expense.status === 'REJECTED' || expense.status === 'REVERSED') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve an expense with status ${expense.status}`,
      });
    }

    expense.status = 'APPROVED';
    expense.approvedBy = req.user._id;
    expense.approvedAt = new Date();
    await expense.save();

    await AuditLog.create({
      shopId,
      userId: req.user._id,
      action: 'EXPENSE_APPROVE',
      entityType: 'Expense',
      entityId: expense._id,
      details: {
        expenseNumber: expense.expenseNumber,
        amountPaise: expense.amountPaise,
        approvedBy: req.user._id,
      },
    });

    res.json({ success: true, data: expense, message: 'Expense approved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function rejectExpense(req, res) {
  try {
    const shopId = req.user.shopId;
    const validated = rejectExpenseSchema.parse(req.body);

    const expense = await Expense.findOne({ _id: req.params.id, shopId });
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    if (expense.status !== 'PENDING_APPROVAL' && expense.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject an expense with status ${expense.status}`,
      });
    }

    expense.status = 'REJECTED';
    expense.rejectedBy = req.user._id;
    expense.rejectedAt = new Date();
    expense.rejectionReason = validated.reason;
    await expense.save();

    await AuditLog.create({
      shopId,
      userId: req.user._id,
      action: 'EXPENSE_REJECT',
      entityType: 'Expense',
      entityId: expense._id,
      details: {
        expenseNumber: expense.expenseNumber,
        reason: validated.reason,
      },
    });

    res.json({ success: true, data: expense, message: 'Expense rejected successfully' });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function reverseExpense(req, res) {
  try {
    const shopId = req.user.shopId;
    const validated = reverseExpenseSchema.parse(req.body);

    const targetExpense = await Expense.findOne({ _id: req.params.id, shopId });
    if (!targetExpense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    if (targetExpense.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Only approved expenses can be reversed.',
      });
    }

    if (targetExpense.isReversed) {
      return res.status(400).json({
        success: false,
        message: 'This expense has already been reversed.',
      });
    }

    const result = await withTransaction(async (session) => {
      const seq = await Counter.getNextSequence(shopId, 'EXPENSE', session);
      const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
      const reversalNumber = `EXP-REV-${dateStr}-${String(seq).padStart(5, '0')}`;

      // Create reversal counter-entry
      const reversalExpense = new Expense({
        shopId,
        expenseNumber: reversalNumber,
        amountPaise: targetExpense.amountPaise,
        category: targetExpense.category,
        paymentMode: targetExpense.paymentMode,
        payee: targetExpense.payee,
        description: `REVERSAL of ${targetExpense.expenseNumber}: ${validated.reason}`,
        status: 'REVERSED',
        createdBy: req.user._id,
        approvedBy: req.user._id,
        approvedAt: new Date(),
        originalExpenseId: targetExpense._id,
        reversalReason: validated.reason,
        expenseDate: new Date(),
      });

      await reversalExpense.save({ session });

      // Update original expense
      targetExpense.isReversed = true;
      targetExpense.reversedByExpenseId = reversalExpense._id;
      targetExpense.reversalReason = validated.reason;
      await targetExpense.save({ session });

      await AuditLog.create(
        [
          {
            shopId,
            userId: req.user._id,
            action: 'EXPENSE_REVERSE',
            entityType: 'Expense',
            entityId: targetExpense._id,
            details: {
              originalExpenseNumber: targetExpense.expenseNumber,
              reversalExpenseNumber: reversalNumber,
              amountPaise: targetExpense.amountPaise,
              reason: validated.reason,
            },
          },
        ],
        { session }
      );

      return { original: targetExpense, reversal: reversalExpense };
    });

    res.json({
      success: true,
      data: result,
      message: `Expense ${targetExpense.expenseNumber} neutralized via reversal entry ${result.reversal.expenseNumber}`,
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getExpenseCategoriesSummary(req, res) {
  try {
    const shopId = req.user.shopId;
    const match = { shopId, status: 'APPROVED', isReversed: false };

    if (req.query.startDate || req.query.endDate) {
      match.expenseDate = {};
      if (req.query.startDate) match.expenseDate.$gte = new Date(req.query.startDate);
      if (req.query.endDate) match.expenseDate.$lte = new Date(req.query.endDate);
    }

    const categories = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$category',
          totalAmountPaise: { $sum: '$amountPaise' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmountPaise: -1 } },
    ]);

    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
