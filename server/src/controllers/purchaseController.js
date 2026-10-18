import mongoose from 'mongoose';
import {
  Purchase,
  Supplier,
  Product,
  Batch,
  StockMovement,
  Payment,
  PaymentAllocation,
  Counter,
  AuditLog,
} from '../models/index.js';
import {
  createPurchaseSchema,
  receivePurchaseSchema,
  cancelPurchaseSchema,
  purchaseReturnSchema,
} from '../validators/purchaseValidators.js';
import { calculatePurchaseTotals } from '../utils/purchaseUtils.js';
import {
  recordSupplierLedgerEntry,
  allocateSupplierPayment,
} from '../utils/supplierLedgerUtils.js';
import { getProductStock } from '../utils/stockUtils.js';
import { withTransaction } from '../utils/transactionUtils.js';

/**
 * Lists purchase bills with filters and pagination.
 */
export async function listPurchases(req, res, next) {
  try {
    const shopId = req.shopId;
    const {
      search,
      supplierId,
      status,
      paymentStatus,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const query = { shopId };

    if (supplierId) {
      query.supplierId = supplierId;
    }
    if (status) {
      query.status = status;
    }
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { purchaseNumber: { $regex: term, $options: 'i' } },
        { supplierInvoiceNumber: { $regex: term, $options: 'i' } },
        { 'items.nameSnapshot': { $regex: term, $options: 'i' } },
        { 'items.batchNumber': { $regex: term, $options: 'i' } },
      ];
    }

    if (startDate || endDate) {
      query.purchaseDate = {};
      if (startDate) {
        query.purchaseDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.purchaseDate.$lte = end;
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [purchases, total] = await Promise.all([
      Purchase.find(query)
        .populate('supplierId', 'name phone contactPerson taxDetails.gstin')
        .populate('receivedBy', 'name role')
        .sort({ purchaseDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Purchase.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: purchases,
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
 * Creates a new purchase bill (either DRAFT or directly RECEIVED).
 */
export async function createPurchase(req, res, next) {
  try {
    const shopId = req.shopId;
    const validated = createPurchaseSchema.parse(req.body);

    // Verify supplier
    const supplier = await Supplier.findOne({ _id: validated.supplierId, shopId });
    if (!supplier) {
      const err = new Error('Supplier not found');
      err.statusCode = 404;
      throw err;
    }

    // Check duplicate supplier invoice number within shop
    const duplicateInvoice = await Purchase.findOne({
      shopId,
      supplierId: validated.supplierId,
      supplierInvoiceNumber: validated.supplierInvoiceNumber,
      status: { $ne: 'CANCELLED' },
    });
    if (duplicateInvoice) {
      const err = new Error(
        `A purchase with supplier invoice number '${validated.supplierInvoiceNumber}' already exists for this supplier`
      );
      err.statusCode = 409;
      throw err;
    }

    // Validate products and enrich snapshots
    const productIds = validated.items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds }, shopId });
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    for (const item of validated.items) {
      const p = productMap.get(item.productId);
      if (!p) {
        const err = new Error(`Product ${item.productId} not found`);
        err.statusCode = 400;
        throw err;
      }
      item.nameSnapshot = p.name;
      item.skuSnapshot = p.sku;
      item.unitSnapshot = p.baseUnit;
    }

    // Compute bill totals
    const computedTotals = calculatePurchaseTotals(validated.items, {
      additionalChargesPaise: validated.additionalChargesPaise,
      paidPaise: validated.paidPaise,
      isInterstate: validated.isInterstate,
    });

    const isDirectReceipt = validated.status === 'RECEIVED';

    const result = await withTransaction(
      async (session) => {
        // Generate atomic purchase sequential number: PUR-YYYYMM-XXXXX
        const datePrefix = new Date().toISOString().slice(0, 7).replace('-', '');
        const seq = await Counter.getNextSequence(shopId, 'PURCHASE', session);
        const purchaseNumber = `PUR-${datePrefix}-${String(seq).padStart(5, '0')}`;

        const purchaseData = {
          shopId,
          purchaseNumber,
          supplierId: validated.supplierId,
          supplierInvoiceNumber: validated.supplierInvoiceNumber,
          supplierInvoiceDate: validated.supplierInvoiceDate
            ? new Date(validated.supplierInvoiceDate)
            : new Date(),
          purchaseDate: validated.purchaseDate ? new Date(validated.purchaseDate) : new Date(),
          entryDate: new Date(),
          receivedBy: req.user._id,
          status: isDirectReceipt ? 'RECEIVED' : 'DRAFT',
          items: computedTotals.items,
          additionalChargesPaise: computedTotals.additionalChargesPaise,
          subtotalPaise: computedTotals.subtotalPaise,
          taxTotalPaise: computedTotals.taxTotalPaise,
          roundOffPaise: computedTotals.roundOffPaise,
          grandTotalPaise: computedTotals.grandTotalPaise,
          paidPaise: isDirectReceipt ? computedTotals.paidPaise : 0,
          balancePaise: isDirectReceipt ? computedTotals.balancePaise : computedTotals.grandTotalPaise,
          paymentStatus: isDirectReceipt ? computedTotals.paymentStatus : 'UNPAID',
          paymentMode: validated.paymentMode,
          isInterstate: validated.isInterstate,
          notes: validated.notes,
          idempotencyKey: validated.idempotencyKey || undefined,
          receivedAt: isDirectReceipt ? new Date() : null,
        };

        const [purchase] = await Purchase.create([purchaseData], { session });

        // If RECEIVED, process stock inward, batches, and supplier accounts payable ledger
        if (isDirectReceipt) {
          for (const item of purchase.items) {
            const batchNum = item.batchNumber || `BATCH-${Date.now()}`;
            const unitCost = Math.round(item.taxableAmountPaise / (item.quantity || 1));

            // Find or create batch
            let batch = await Batch.findOne({
              shopId,
              productId: item.productId,
              batchNumber: batchNum,
            }).session(session);

            if (!batch) {
              const [newBatch] = await Batch.create(
                [
                  {
                    shopId,
                    productId: item.productId,
                    batchNumber: batchNum,
                    manufacturingDate: item.manufacturingDate,
                    expiryDate: item.expiryDate,
                    purchaseCostPaisePerBaseUnit: unitCost,
                    status: 'ACTIVE',
                  },
                ],
                { session }
              );
              batch = newBatch;
            } else {
              // Update purchase cost if newer
              batch.purchaseCostPaisePerBaseUnit = unitCost;
              if (item.expiryDate && !batch.expiryDate) {
                batch.expiryDate = item.expiryDate;
              }
              await batch.save({ session });
            }

            item.batchId = batch._id;

            // Optional: Update product selling price if entered
            if (item.sellingPricePaise && item.sellingPricePaise > 0) {
              await Product.updateOne(
                { _id: item.productId, shopId },
                { $set: { sellingPricePaise: item.sellingPricePaise } },
                { session }
              );
            }

            // Create immutable StockMovement (INWARD)
            const totalQty = item.quantity + (item.freeQuantity || 0);
            await StockMovement.create(
              [
                {
                  shopId,
                  productId: item.productId,
                  batchId: batch._id,
                  movementType: 'INWARD',
                  quantityBase: totalQty,
                  referenceType: 'PURCHASE',
                  referenceId: purchase._id.toString(),
                  createdBy: req.user._id,
                  reason: `Stock receipt from purchase ${purchase.purchaseNumber} (Inv #${purchase.supplierInvoiceNumber})`,
                },
              ],
              { session }
            );
          }

          // Save updated batchIds on purchase items
          await purchase.save({ session });

          // Post PURCHASE_INVOICE credit to Supplier Ledger
          await recordSupplierLedgerEntry(
            {
              shopId,
              supplierId: validated.supplierId,
              entryType: 'PURCHASE_INVOICE',
              transactionType: 'CREDIT',
              amountPaise: purchase.grandTotalPaise,
              referenceType: 'PURCHASE',
              referenceId: purchase._id.toString(),
              description: `Purchase Inward Bill ${purchase.purchaseNumber} (Inv #${purchase.supplierInvoiceNumber})`,
              notes: validated.notes,
              metadata: {
                purchaseNumber: purchase.purchaseNumber,
                supplierInvoiceNumber: purchase.supplierInvoiceNumber,
                itemCount: purchase.items.length,
              },
              recordedBy: req.user._id,
            },
            session
          );

          // Handle immediate payment if paidPaise > 0
          if (computedTotals.paidPaise > 0) {
            const [payment] = await Payment.create(
              [
                {
                  shopId,
                  supplierId: validated.supplierId,
                  purchaseId: purchase._id,
                  direction: 'OUTFLOW',
                  paymentType: 'PURCHASE_PAYMENT',
                  amountPaise: computedTotals.paidPaise,
                  paymentMethod: validated.paymentMode === 'SPLIT' ? 'CASH' : validated.paymentMode,
                  referenceId: validated.paymentReferenceId || `PUR-PAY-${purchase.purchaseNumber}`,
                  receivedBy: req.user._id,
                  status: 'VERIFIED',
                  notes: `Immediate payment on purchase ${purchase.purchaseNumber}`,
                },
              ],
              { session }
            );

            await PaymentAllocation.create(
              [
                {
                  shopId,
                  supplierId: validated.supplierId,
                  targetType: 'PURCHASE',
                  paymentId: payment._id,
                  purchaseId: purchase._id,
                  allocatedAmountPaise: computedTotals.paidPaise,
                  allocatedBy: req.user._id,
                },
              ],
              { session }
            );

            await recordSupplierLedgerEntry(
              {
                shopId,
                supplierId: validated.supplierId,
                entryType: 'PAYMENT_MADE',
                transactionType: 'DEBIT',
                amountPaise: computedTotals.paidPaise,
                referenceType: 'PAYMENT',
                referenceId: payment._id.toString(),
                description: `Immediate payment against purchase ${purchase.purchaseNumber}`,
                notes: validated.notes,
                recordedBy: req.user._id,
              },
              session
            );
          }
        }

        // Audit Log
        await AuditLog.create(
          [
            {
              shopId,
              actorUserId: req.user._id,
              action: isDirectReceipt ? 'PURCHASE_RECEIPT' : 'PURCHASE_DRAFT',
              entityType: 'PURCHASE',
              entityId: purchase._id.toString(),
              reason: isDirectReceipt
                ? `Purchase inward received: ${purchase.purchaseNumber}`
                : `Purchase draft created: ${purchase.purchaseNumber}`,
              metadata: {
                grandTotalPaise: purchase.grandTotalPaise,
                paidPaise: purchase.paidPaise,
                supplierId: validated.supplierId,
              },
            },
          ],
          { session }
        );

        return purchase;
      },
      { requireTransaction: isDirectReceipt }
    );

    res.status(201).json({
      success: true,
      message: isDirectReceipt
        ? 'Purchase inward received and stock updated successfully'
        : 'Purchase draft saved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Returns full purchase details including item snapshots, taxes, and payment history.
 */
export async function getPurchaseDetails(req, res, next) {
  try {
    const shopId = req.shopId;
    const { id } = req.params;

    const purchase = await Purchase.findOne({ _id: id, shopId })
      .populate('supplierId')
      .populate('receivedBy', 'name role email')
      .populate('cancelledBy', 'name role')
      .lean();

    if (!purchase) {
      const err = new Error('Purchase not found');
      err.statusCode = 404;
      throw err;
    }

    const [payments, allocations] = await Promise.all([
      Payment.find({ shopId, purchaseId: id, status: 'VERIFIED' }).lean(),
      PaymentAllocation.find({ shopId, purchaseId: id }).populate('paymentId').lean(),
    ]);

    res.json({
      success: true,
      data: {
        ...purchase,
        payments,
        allocations,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Explicitly transitions a DRAFT purchase into RECEIVED, updating inventory and ledger.
 */
export async function receivePurchase(req, res, next) {
  try {
    const shopId = req.shopId;
    const { id } = req.params;
    const validated = receivePurchaseSchema.parse(req.body);

    const purchase = await Purchase.findOne({ _id: id, shopId });
    if (!purchase) {
      const err = new Error('Purchase not found');
      err.statusCode = 404;
      throw err;
    }

    if (purchase.status !== 'DRAFT') {
      const err = new Error(`Purchase is in ${purchase.status} status and cannot be received`);
      err.statusCode = 400;
      throw err;
    }

    const requestedPaid =
      validated.paidPaise !== undefined
        ? Math.min(purchase.grandTotalPaise, Math.max(0, validated.paidPaise))
        : 0;

    const updatedPurchase = await withTransaction(
      async (session) => {
        // 1. Process batches & stock inward
        for (const item of purchase.items) {
          const batchNum = item.batchNumber || `BATCH-${Date.now()}`;
          const unitCost = Math.round(item.taxableAmountPaise / (item.quantity || 1));

          let batch = await Batch.findOne({
            shopId,
            productId: item.productId,
            batchNumber: batchNum,
          }).session(session);

          if (!batch) {
            const [newBatch] = await Batch.create(
              [
                {
                  shopId,
                  productId: item.productId,
                  batchNumber: batchNum,
                  manufacturingDate: item.manufacturingDate,
                  expiryDate: item.expiryDate,
                  purchaseCostPaisePerBaseUnit: unitCost,
                  status: 'ACTIVE',
                },
              ],
              { session }
            );
            batch = newBatch;
          } else {
            batch.purchaseCostPaisePerBaseUnit = unitCost;
            await batch.save({ session });
          }

          item.batchId = batch._id;

          const totalQty = item.quantity + (item.freeQuantity || 0);
          await StockMovement.create(
            [
              {
                shopId,
                productId: item.productId,
                batchId: batch._id,
                movementType: 'INWARD',
                quantityBase: totalQty,
                referenceType: 'PURCHASE',
                referenceId: purchase._id.toString(),
                createdBy: req.user._id,
                reason: `Stock receipt from purchase ${purchase.purchaseNumber}`,
              },
            ],
            { session }
          );
        }

        // 2. Post PURCHASE_INVOICE credit to supplier ledger
        await recordSupplierLedgerEntry(
          {
            shopId,
            supplierId: purchase.supplierId,
            entryType: 'PURCHASE_INVOICE',
            transactionType: 'CREDIT',
            amountPaise: purchase.grandTotalPaise,
            referenceType: 'PURCHASE',
            referenceId: purchase._id.toString(),
            description: `Purchase Inward Bill ${purchase.purchaseNumber} (Inv #${purchase.supplierInvoiceNumber})`,
            recordedBy: req.user._id,
          },
          session
        );

        // 3. Handle immediate payment if paidPaise > 0
        if (requestedPaid > 0) {
          const mode = validated.paymentMode || purchase.paymentMode || 'CASH';
          const [payment] = await Payment.create(
            [
              {
                shopId,
                supplierId: purchase.supplierId,
                purchaseId: purchase._id,
                direction: 'OUTFLOW',
                paymentType: 'PURCHASE_PAYMENT',
                amountPaise: requestedPaid,
                paymentMethod: mode === 'SPLIT' ? 'CASH' : mode,
                referenceId: validated.paymentReferenceId || `PUR-PAY-${purchase.purchaseNumber}`,
                receivedBy: req.user._id,
                status: 'VERIFIED',
                notes: `Payment upon receipt of purchase ${purchase.purchaseNumber}`,
              },
            ],
            { session }
          );

          await PaymentAllocation.create(
            [
              {
                shopId,
                supplierId: purchase.supplierId,
                targetType: 'PURCHASE',
                paymentId: payment._id,
                purchaseId: purchase._id,
                allocatedAmountPaise: requestedPaid,
                allocatedBy: req.user._id,
              },
            ],
            { session }
          );

          await recordSupplierLedgerEntry(
            {
              shopId,
              supplierId: purchase.supplierId,
              entryType: 'PAYMENT_MADE',
              transactionType: 'DEBIT',
              amountPaise: requestedPaid,
              referenceType: 'PAYMENT',
              referenceId: payment._id.toString(),
              description: `Payment against received purchase ${purchase.purchaseNumber}`,
              recordedBy: req.user._id,
            },
            session
          );

          purchase.paidPaise = requestedPaid;
        }

        purchase.balancePaise = Math.max(0, purchase.grandTotalPaise - purchase.paidPaise);
        purchase.paymentStatus =
          purchase.balancePaise === 0 ? 'PAID' : (purchase.paidPaise > 0 ? 'PARTIALLY_PAID' : 'UNPAID');
        purchase.status = 'RECEIVED';
        purchase.receivedAt = new Date();
        purchase.receivedBy = req.user._id;
        await purchase.save({ session });

        await AuditLog.create(
          [
            {
              shopId,
              actorUserId: req.user._id,
              action: 'PURCHASE_RECEIPT',
              entityType: 'PURCHASE',
              entityId: purchase._id.toString(),
              reason: `Draft purchase received and stock added: ${purchase.purchaseNumber}`,
            },
          ],
          { session }
        );

        return purchase;
      },
      { requireTransaction: true }
    );

    res.json({
      success: true,
      message: 'Purchase received successfully. Stock and supplier ledger updated.',
      data: updatedPurchase,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controlled cancellation of a purchase bill, reversing stock and accounting effects.
 */
export async function cancelPurchase(req, res, next) {
  try {
    const shopId = req.shopId;
    const { id } = req.params;
    const validated = cancelPurchaseSchema.parse(req.body);

    const purchase = await Purchase.findOne({ _id: id, shopId });
    if (!purchase) {
      const err = new Error('Purchase not found');
      err.statusCode = 404;
      throw err;
    }

    if (purchase.status === 'CANCELLED') {
      const err = new Error('Purchase is already cancelled');
      err.statusCode = 400;
      throw err;
    }

    const cancelledPurchase = await withTransaction(
      async (session) => {
        if (purchase.status === 'RECEIVED') {
          // Reverse stock for all line items
          for (const item of purchase.items) {
            const totalQty = item.quantity + (item.freeQuantity || 0);

            await StockMovement.create(
              [
                {
                  shopId,
                  productId: item.productId,
                  batchId: item.batchId || null,
                  movementType: 'RETURN_OUTWARD',
                  quantityBase: -totalQty, // negative to decrement stock
                  referenceType: 'PURCHASE',
                  referenceId: purchase._id.toString(),
                  createdBy: req.user._id,
                  reason: `Cancellation reversal for purchase ${purchase.purchaseNumber}: ${validated.reason}`,
                },
              ],
              { session }
            );
          }

          // Neutralize purchase credit in Supplier Ledger
          await recordSupplierLedgerEntry(
            {
              shopId,
              supplierId: purchase.supplierId,
              entryType: 'REVERSAL',
              transactionType: 'DEBIT',
              amountPaise: purchase.grandTotalPaise,
              referenceType: 'PURCHASE',
              referenceId: purchase._id.toString(),
              description: `Cancellation Reversal for purchase ${purchase.purchaseNumber}: ${validated.reason}`,
              notes: validated.reason,
              recordedBy: req.user._id,
            },
            session
          );
        }

        purchase.status = 'CANCELLED';
        purchase.cancelledAt = new Date();
        purchase.cancelledBy = req.user._id;
        purchase.cancellationReason = validated.reason;
        await purchase.save({ session });

        await AuditLog.create(
          [
            {
              shopId,
              actorUserId: req.user._id,
              action: 'PURCHASE_CANCEL',
              entityType: 'PURCHASE',
              entityId: purchase._id.toString(),
              reason: validated.reason,
              metadata: {
                purchaseNumber: purchase.purchaseNumber,
                previousStatus: purchase.status,
              },
            },
          ],
          { session }
        );

        return purchase;
      },
      { requireTransaction: purchase.status === 'RECEIVED' }
    );

    res.json({
      success: true,
      message: 'Purchase cancelled and effects reversed successfully',
      data: cancelledPurchase,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Records a return of purchased goods to the supplier.
 * Validates available stock for the affected batch before permitting return.
 */
export async function recordPurchaseReturn(req, res, next) {
  try {
    const shopId = req.shopId;
    const { id } = req.params;
    const validated = purchaseReturnSchema.parse(req.body);

    const purchase = await Purchase.findOne({ _id: id, shopId });
    if (!purchase) {
      const err = new Error('Purchase not found');
      err.statusCode = 404;
      throw err;
    }

    if (purchase.status !== 'RECEIVED') {
      const err = new Error('Returns can only be recorded on RECEIVED purchases');
      err.statusCode = 400;
      throw err;
    }

    const result = await withTransaction(
      async (session) => {
        let totalReturnAmountPaise = 0;

        for (const item of validated.items) {
          // Check available stock for the product & batch
          const currentStock = await getProductStock(shopId, item.productId);
          if (currentStock < item.quantity) {
            const err = new Error(
              `Insufficient stock to return ${item.quantity} units for product. Available: ${currentStock}`
            );
            err.statusCode = 400;
            throw err;
          }

          const lineAmountPaise = Math.round(item.quantity * item.ratePaise);
          totalReturnAmountPaise += lineAmountPaise;

          // Record RETURN_OUTWARD movement
          await StockMovement.create(
            [
              {
                shopId,
                productId: item.productId,
                batchId: item.batchId,
                movementType: 'RETURN_OUTWARD',
                quantityBase: -item.quantity,
                referenceType: 'PURCHASE',
                referenceId: purchase._id.toString(),
                createdBy: req.user._id,
                reason: `Purchase return to supplier: ${validated.reason}`,
              },
            ],
            { session }
          );
        }

        // Post PURCHASE_RETURN (DEBIT) entry to supplier ledger
        const ledgerEntry = await recordSupplierLedgerEntry(
          {
            shopId,
            supplierId: purchase.supplierId,
            entryType: 'PURCHASE_RETURN',
            transactionType: 'DEBIT',
            amountPaise: totalReturnAmountPaise,
            referenceType: 'PURCHASE',
            referenceId: purchase._id.toString(),
            description: `Purchase return against ${purchase.purchaseNumber}: ${validated.reason}`,
            notes: validated.notes,
            metadata: {
              purchaseId: purchase._id,
              purchaseNumber: purchase.purchaseNumber,
              itemCount: validated.items.length,
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
              action: 'PURCHASE_RETURN',
              entityType: 'PURCHASE',
              entityId: purchase._id.toString(),
              reason: validated.reason,
              metadata: {
                totalReturnAmountPaise,
                itemsCount: validated.items.length,
              },
            },
          ],
          { session }
        );

        return {
          totalReturnAmountPaise,
          ledgerEntry,
        };
      },
      { requireTransaction: true }
    );

    res.status(201).json({
      success: true,
      message: 'Purchase return recorded and stock deducted successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
