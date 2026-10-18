import mongoose from 'mongoose';
import {
  Supplier,
  SupplierLedgerEntry,
  Payment,
  Purchase,
  AuditLog,
} from '../models/index.js';
import {
  createSupplierSchema,
  updateSupplierSchema,
  supplierPaymentSchema,
  supplierAdjustmentSchema,
  supplierOpeningBalanceSchema,
  reverseSupplierEntrySchema,
} from '../validators/supplierValidators.js';
import {
  recordSupplierLedgerEntry,
  getSupplierLedgerBalance,
  allocateSupplierPayment,
  calculateSupplierAging,
  reconcileSupplierAccount,
} from '../utils/supplierLedgerUtils.js';
import { withTransaction } from '../utils/transactionUtils.js';

/**
 * Lists suppliers for the shop with live balances and aging indicators.
 */
export async function listSuppliers(req, res, next) {
  try {
    const shopId = req.shopId;
    const { search, active, page = 1, limit = 50 } = req.query;

    const query = { shopId };
    if (active !== undefined && active !== '') {
      query.active = active === 'true';
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { phone: { $regex: term, $options: 'i' } },
        { contactPerson: { $regex: term, $options: 'i' } },
        { 'taxDetails.gstin': { $regex: term, $options: 'i' } },
        { villageCity: { $regex: term, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [suppliers, total] = await Promise.all([
      Supplier.find(query).sort({ name: 1 }).skip(skip).limit(limitNum).lean(),
      Supplier.countDocuments(query),
    ]);

    // Attach live ledger balances
    const supplierIds = suppliers.map((s) => s._id);
    const balanceMap = new Map();

    if (supplierIds.length > 0) {
      const balances = await SupplierLedgerEntry.aggregate([
        {
          $match: {
            shopId: new mongoose.Types.ObjectId(shopId),
            supplierId: { $in: supplierIds },
            isReversed: false,
          },
        },
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

      for (const b of balances) {
        balanceMap.set(b._id.toString(), b.totalCredit - b.totalDebit);
      }
    }

    const enriched = suppliers.map((s) => {
      const balancePaise = balanceMap.get(s._id.toString()) || 0;
      return {
        ...s,
        outstandingBalancePaise: balancePaise,
        hasAdvanceCredit: balancePaise < 0,
      };
    });

    res.json({
      success: true,
      data: enriched,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Creates a new supplier.
 */
export async function createSupplier(req, res, next) {
  try {
    const shopId = req.shopId;
    const validated = createSupplierSchema.parse(req.body);

    // Duplicate check for identical supplier name in same shop
    const existing = await Supplier.findOne({
      shopId,
      name: { $regex: new RegExp(`^${validated.name.trim()}$`, 'i') },
      active: true,
    });
    if (existing) {
      const err = new Error(`An active supplier named '${validated.name}' already exists`);
      err.statusCode = 409;
      throw err;
    }

    const supplierData = {
      shopId,
      name: validated.name,
      contactPerson: validated.contactPerson,
      phone: validated.phone || undefined,
      email: validated.email || undefined,
      address: validated.address,
      villageCity: validated.villageCity,
      district: validated.district,
      state: validated.state,
      pincode: validated.pincode,
      supplierType: validated.supplierType,
      taxDetails: {
        gstin: validated.gstin || '',
        pan: validated.pan || '',
      },
      paymentTermsDays: validated.paymentTermsDays,
      creditLimitPaise: validated.creditLimitPaise,
      bankDetails: validated.bankDetails || {},
      notes: validated.notes,
      active: true,
    };

    const supplier = await Supplier.create(supplierData);

    await AuditLog.create({
      shopId,
      actorUserId: req.user._id,
      action: 'SUPPLIER_CREATE',
      entityType: 'SUPPLIER',
      entityId: supplier._id.toString(),
      reason: 'New supplier registered',
      metadata: { name: supplier.name, gstin: validated.gstin },
    });

    res.status(201).json({
      success: true,
      message: 'Supplier registered successfully',
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Returns detailed supplier profile with balance, aging breakdown, and recent history.
 */
export async function getSupplierDetails(req, res, next) {
  try {
    const shopId = req.shopId;
    const { id } = req.params;

    const supplier = await Supplier.findOne({ _id: id, shopId }).lean();
    if (!supplier) {
      const err = new Error('Supplier not found');
      err.statusCode = 404;
      throw err;
    }

    const [balancePaise, aging, recentPurchases, recentLedgerEntries] = await Promise.all([
      getSupplierLedgerBalance(shopId, id),
      calculateSupplierAging(shopId, id),
      Purchase.find({ shopId, supplierId: id })
        .sort({ purchaseDate: -1 })
        .limit(5)
        .lean(),
      SupplierLedgerEntry.find({ shopId, supplierId: id })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        ...supplier,
        outstandingBalancePaise: balancePaise,
        aging,
        recentPurchases,
        recentLedgerEntries,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Updates supplier details.
 */
export async function updateSupplier(req, res, next) {
  try {
    const shopId = req.shopId;
    const { id } = req.params;
    const validated = updateSupplierSchema.parse(req.body);

    const supplier = await Supplier.findOne({ _id: id, shopId });
    if (!supplier) {
      const err = new Error('Supplier not found');
      err.statusCode = 404;
      throw err;
    }

    if (validated.name && validated.name.trim().toLowerCase() !== supplier.name.toLowerCase()) {
      const existing = await Supplier.findOne({
        _id: { $ne: id },
        shopId,
        name: { $regex: new RegExp(`^${validated.name.trim()}$`, 'i') },
        active: true,
      });
      if (existing) {
        const err = new Error(`An active supplier named '${validated.name}' already exists`);
        err.statusCode = 409;
        throw err;
      }
      supplier.name = validated.name;
    }

    if (validated.contactPerson !== undefined) supplier.contactPerson = validated.contactPerson;
    if (validated.phone !== undefined) supplier.phone = validated.phone || undefined;
    if (validated.email !== undefined) supplier.email = validated.email || undefined;
    if (validated.address !== undefined) supplier.address = validated.address;
    if (validated.villageCity !== undefined) supplier.villageCity = validated.villageCity;
    if (validated.district !== undefined) supplier.district = validated.district;
    if (validated.state !== undefined) supplier.state = validated.state;
    if (validated.pincode !== undefined) supplier.pincode = validated.pincode;
    if (validated.supplierType !== undefined) supplier.supplierType = validated.supplierType;
    if (validated.gstin !== undefined) supplier.taxDetails.gstin = validated.gstin;
    if (validated.pan !== undefined) supplier.taxDetails.pan = validated.pan;
    if (validated.paymentTermsDays !== undefined) supplier.paymentTermsDays = validated.paymentTermsDays;
    if (validated.creditLimitPaise !== undefined) supplier.creditLimitPaise = validated.creditLimitPaise;
    if (validated.bankDetails !== undefined) supplier.bankDetails = validated.bankDetails;
    if (validated.notes !== undefined) supplier.notes = validated.notes;
    if (validated.active !== undefined) supplier.active = validated.active;

    await supplier.save();

    await AuditLog.create({
      shopId,
      actorUserId: req.user._id,
      action: 'SUPPLIER_UPDATE',
      entityType: 'SUPPLIER',
      entityId: supplier._id.toString(),
      reason: 'Supplier details updated',
    });

    res.json({
      success: true,
      message: 'Supplier updated successfully',
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves supplier passbook ledger statement with date filtering.
 */
export async function getSupplierStatement(req, res, next) {
  try {
    const shopId = req.shopId;
    const { id } = req.params;
    const { startDate, endDate, page = 1, limit = 50 } = req.query;

    const supplier = await Supplier.findOne({ _id: id, shopId }).lean();
    if (!supplier) {
      const err = new Error('Supplier not found');
      err.statusCode = 404;
      throw err;
    }

    const query = {
      shopId,
      supplierId: id,
    };

    let start = null;
    let end = null;
    if (startDate) {
      start = new Date(startDate);
      query.createdAt = { $gte: start };
    }
    if (endDate) {
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt = { ...(query.createdAt || {}), $lte: end };
    }

    // Opening balance before start date
    let openingBalancePaise = 0;
    if (start) {
      const priorEntries = await SupplierLedgerEntry.aggregate([
        {
          $match: {
            shopId: new mongoose.Types.ObjectId(shopId),
            supplierId: new mongoose.Types.ObjectId(id),
            createdAt: { $lt: start },
            isReversed: false,
          },
        },
        {
          $group: {
            _id: null,
            totalCredit: {
              $sum: { $cond: [{ $eq: ['$transactionType', 'CREDIT'] }, '$amountPaise', 0] },
            },
            totalDebit: {
              $sum: { $cond: [{ $eq: ['$transactionType', 'DEBIT'] }, '$amountPaise', 0] },
            },
          },
        },
      ]);
      if (priorEntries.length > 0) {
        openingBalancePaise = priorEntries[0].totalCredit - priorEntries[0].totalDebit;
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [entries, total] = await Promise.all([
      SupplierLedgerEntry.find(query).sort({ createdAt: 1 }).skip(skip).limit(limitNum).lean(),
      SupplierLedgerEntry.countDocuments(query),
    ]);

    const currentBalancePaise = await getSupplierLedgerBalance(shopId, id);

    res.json({
      success: true,
      data: {
        supplier,
        openingBalancePaise,
        currentBalancePaise,
        entries,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Records an outward payment to a supplier, allocating it to purchases.
 */
export async function recordSupplierPayment(req, res, next) {
  try {
    const shopId = req.shopId;
    const { id } = req.params;
    const validated = supplierPaymentSchema.parse(req.body);

    const supplier = await Supplier.findOne({ _id: id, shopId });
    if (!supplier) {
      const err = new Error('Supplier not found');
      err.statusCode = 404;
      throw err;
    }

    // Idempotency check: Return existing payment if duplicate
    if (validated.idempotencyKey) {
      const existingPayment = await Payment.findOne({ shopId, idempotencyKey: validated.idempotencyKey });
      if (existingPayment) {
        const existingAllocations = await PaymentAllocation.find({ shopId, paymentId: existingPayment._id });
        return res.status(200).json({
          success: true,
          message: 'Payment already recorded with this idempotency key',
          data: {
            payment: existingPayment,
            allocations: existingAllocations,
            isDuplicate: true,
          },
        });
      }
    }

    const result = await withTransaction(
      async (session) => {
        // 1. Record Outward Payment
        const [payment] = await Payment.create(
          [
            {
              shopId,
              supplierId: id,
              direction: 'OUTFLOW',
              paymentType: 'SUPPLIER_PAYMENT',
              amountPaise: validated.amountPaise,
              paymentMethod: validated.paymentMethod,
              referenceId: validated.referenceId,
              receivedBy: req.user._id, // staff recorded
              status: 'VERIFIED',
              notes: validated.notes,
              idempotencyKey: validated.idempotencyKey || undefined,
            },
          ],
          { session }
        );

        // 2. Allocate payment to purchases
        const allocationResult = await allocateSupplierPayment(
          {
            shopId,
            supplierId: id,
            paymentId: payment._id,
            amountPaise: validated.amountPaise,
            allocations: validated.allocations,
            autoFifo: validated.autoFifo,
            allocatedBy: req.user._id,
          },
          session
        );

        // 3. Post DEBIT entry to supplier ledger
        const ledgerEntry = await recordSupplierLedgerEntry(
          {
            shopId,
            supplierId: id,
            entryType: 'PAYMENT_MADE',
            transactionType: 'DEBIT',
            amountPaise: validated.amountPaise,
            referenceType: 'PAYMENT',
            referenceId: payment._id.toString(),
            description: `Payment to ${supplier.name} via ${validated.paymentMethod}${
              validated.referenceId ? ` (${validated.referenceId})` : ''
            }`,
            notes: validated.notes,
            metadata: {
              allocatedTotalPaise: allocationResult.allocatedTotalPaise,
              unallocatedPaise: allocationResult.unallocatedPaise,
              paymentMethod: validated.paymentMethod,
            },
            recordedBy: req.user._id,
          },
          session
        );

        // 4. Record Audit Log
        await AuditLog.create(
          [
            {
              shopId,
              actorUserId: req.user._id,
              action: 'SUPPLIER_PAYMENT',
              entityType: 'PAYMENT',
              entityId: payment._id.toString(),
              reason: `Payment of ₹${(validated.amountPaise / 100).toFixed(2)} to ${supplier.name}`,
              metadata: {
                amountPaise: validated.amountPaise,
                paymentMethod: validated.paymentMethod,
                supplierId: id,
              },
            },
          ],
          { session }
        );

        return {
          payment,
          ledgerEntry,
          allocationResult,
        };
      },
      { requireTransaction: true }
    );

    res.status(201).json({
      success: true,
      message: 'Payment recorded and allocated successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Records an authorized manual DEBIT or CREDIT adjustment on a supplier account.
 */
export async function recordSupplierAdjustment(req, res, next) {
  try {
    const shopId = req.shopId;
    const { id } = req.params;
    const validated = supplierAdjustmentSchema.parse(req.body);

    const supplier = await Supplier.findOne({ _id: id, shopId });
    if (!supplier) {
      const err = new Error('Supplier not found');
      err.statusCode = 404;
      throw err;
    }

    const result = await withTransaction(
      async (session) => {
        const ledgerEntry = await recordSupplierLedgerEntry(
          {
            shopId,
            supplierId: id,
            entryType: 'ADJUSTMENT',
            transactionType: validated.adjustmentType,
            amountPaise: validated.amountPaise,
            referenceType: 'ADJUSTMENT',
            referenceId: `ADJ-${Date.now()}`,
            description: `Authorized adjustment: ${validated.reason}`,
            notes: validated.notes,
            metadata: {
              reason: validated.reason,
              adjustedBy: req.user.name,
            },
            recordedBy: req.user._id,
          },
          session
        );

        await AuditLog.create(
          [
            {
              shopId,
              actorUserId: req.user._id,
              action: 'SUPPLIER_ADJUSTMENT',
              entityType: 'SUPPLIER',
              entityId: id,
              reason: validated.reason,
              metadata: {
                adjustmentType: validated.adjustmentType,
                amountPaise: validated.amountPaise,
              },
            },
          ],
          { session }
        );

        return ledgerEntry;
      },
      { requireTransaction: true }
    );

    res.status(201).json({
      success: true,
      message: 'Supplier adjustment recorded successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Records an approved opening balance migration for a supplier.
 */
export async function recordOpeningBalance(req, res, next) {
  try {
    const shopId = req.shopId;
    const { id } = req.params;
    const validated = supplierOpeningBalanceSchema.parse(req.body);

    const supplier = await Supplier.findOne({ _id: id, shopId });
    if (!supplier) {
      const err = new Error('Supplier not found');
      err.statusCode = 404;
      throw err;
    }

    // Check if an opening balance has already been recorded
    const existingOB = await SupplierLedgerEntry.findOne({
      shopId,
      supplierId: id,
      entryType: 'OPENING_BALANCE',
      isReversed: false,
    });
    if (existingOB) {
      const err = new Error('An active opening balance entry already exists for this supplier');
      err.statusCode = 409;
      throw err;
    }

    const transactionType =
      validated.balanceType === 'PAYABLE_CREDIT' ? 'CREDIT' : 'DEBIT';

    const result = await withTransaction(
      async (session) => {
        const ledgerEntry = await recordSupplierLedgerEntry(
          {
            shopId,
            supplierId: id,
            entryType: 'OPENING_BALANCE',
            transactionType,
            amountPaise: validated.amountPaise,
            referenceType: 'OPENING_BALANCE',
            referenceId: validated.referenceId,
            description: `Historical Opening Balance: ${validated.reason}`,
            notes: validated.notes,
            metadata: {
              balanceType: validated.balanceType,
              asOfDate: validated.asOfDate || new Date().toISOString(),
            },
            recordedBy: req.user._id,
          },
          session
        );

        await AuditLog.create(
          [
            {
              shopId,
              actorUserId: req.user._id,
              action: 'SUPPLIER_OPENING_BALANCE',
              entityType: 'SUPPLIER',
              entityId: id,
              reason: validated.reason,
              metadata: {
                balanceType: validated.balanceType,
                amountPaise: validated.amountPaise,
              },
            },
          ],
          { session }
        );

        return ledgerEntry;
      },
      { requireTransaction: true }
    );

    res.status(201).json({
      success: true,
      message: 'Opening balance recorded successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reverses an erroneous ledger entry via an authorized counter-entry.
 */
export async function reverseLedgerEntry(req, res, next) {
  try {
    const shopId = req.shopId;
    const { id, entryId } = req.params;
    const validated = reverseSupplierEntrySchema.parse(req.body);

    const originalEntry = await SupplierLedgerEntry.findOne({
      _id: entryId,
      shopId,
      supplierId: id,
    });

    if (!originalEntry) {
      const err = new Error('Ledger entry not found');
      err.statusCode = 404;
      throw err;
    }

    if (originalEntry.isReversed) {
      const err = new Error('This ledger entry has already been reversed');
      err.statusCode = 400;
      throw err;
    }

    // Counter transaction type: CREDIT reverses DEBIT, DEBIT reverses CREDIT
    const counterType = originalEntry.transactionType === 'CREDIT' ? 'DEBIT' : 'CREDIT';

    const reversalEntry = await withTransaction(
      async (session) => {
        const entry = await recordSupplierLedgerEntry(
          {
            shopId,
            supplierId: id,
            entryType: 'REVERSAL',
            transactionType: counterType,
            amountPaise: originalEntry.amountPaise,
            referenceType: 'REVERSAL',
            referenceId: originalEntry._id.toString(),
            description: `Reversal of ${originalEntry.description}: ${validated.reason}`,
            notes: `Original Entry ID: ${originalEntry._id}`,
            metadata: {
              originalEntryId: originalEntry._id,
              originalType: originalEntry.entryType,
              reason: validated.reason,
            },
            recordedBy: req.user._id,
          },
          session
        );

        // Mark original entry as reversed
        originalEntry.isReversed = true;
        originalEntry.reversedByEntryId = entry._id;
        await originalEntry.save({ session });

        await AuditLog.create(
          [
            {
              shopId,
              actorUserId: req.user._id,
              action: 'SUPPLIER_LEDGER_REVERSAL',
              entityType: 'SUPPLIER_LEDGER_ENTRY',
              entityId: originalEntry._id.toString(),
              reason: validated.reason,
              metadata: {
                reversalEntryId: entry._id.toString(),
                amountPaise: originalEntry.amountPaise,
              },
            },
          ],
          { session }
        );

        return entry;
      },
      { requireTransaction: true }
    );

    res.status(201).json({
      success: true,
      message: 'Ledger entry reversed successfully',
      data: reversalEntry,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Runs reconciliation audit on a supplier account.
 */
export async function getSupplierReconciliationReport(req, res, next) {
  try {
    const shopId = req.shopId;
    const { id } = req.params;

    const supplier = await Supplier.findOne({ _id: id, shopId }).lean();
    if (!supplier) {
      const err = new Error('Supplier not found');
      err.statusCode = 404;
      throw err;
    }

    const report = await reconcileSupplierAccount(shopId, id);

    res.json({
      success: true,
      data: {
        supplier,
        ...report,
      },
    });
  } catch (error) {
    next(error);
  }
}
