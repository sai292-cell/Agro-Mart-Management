import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { Batch } from '../models/Batch.js';
import { StockMovement } from '../models/StockMovement.js';
import { AuditLog } from '../models/AuditLog.js';
import { withTransaction } from '../utils/transactionUtils.js';
import {
  getProductStock,
  getProductsStockMap,
  getBatchesStockMap,
  evaluateBatch,
} from '../utils/stockUtils.js';
import {
  stockReceiptSchema,
  stockAdjustmentSchema,
  updateBatchStatusSchema,
} from '../validators/productValidators.js';

/**
 * POST /api/v1/inventory/receipt
 * Records inward stock receipt and links/creates the manufacturer batch
 * Restricted to OWNER and MANAGER
 */
export async function recordStockReceipt(req, res, next) {
  try {
    const parseResult = stockReceiptSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
          details: parseResult.error.flatten(),
        },
      });
    }

    const {
      productId,
      batchNumber,
      manufacturingDate,
      expiryDate,
      purchaseCostPaisePerBaseUnit,
      quantityBase,
      referenceType,
      referenceId,
      reason,
    } = parseResult.data;

    const shopId = req.user.shopId;

    // Prevent accidental duplicate receipt if referenceId is provided
    if (referenceId && referenceId.trim().length > 0) {
      const duplicateMovement = await StockMovement.findOne({
        shopId,
        productId,
        referenceType,
        referenceId: referenceId.trim(),
        movementType: 'INWARD',
      });
      if (duplicateMovement) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_RECEIPT',
            message: `A stock receipt with reference ID '${referenceId}' has already been processed for this product.`,
          },
        });
      }
    }

    // Reject receiving already-expired batches
    if (expiryDate && new Date(expiryDate) < new Date()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BATCH_ALREADY_EXPIRED',
          message: 'Cannot accept stock receipt for an already-expired batch.',
        },
      });
    }

    // Execute with transaction (falls back cleanly if transactions are unsupported on MongoDB deployment)
    const result = await withTransaction(async (session) => {
      const queryOptions = session ? { session } : {};

      // 1. Validate Product
      const product = await Product.findOne({ _id: productId, shopId }, null, queryOptions);
      if (!product) {
        const error = new Error('Product not found in this shop');
        error.statusCode = 404;
        error.code = 'PRODUCT_NOT_FOUND';
        throw error;
      }

      // 2. Find or create batch
      let batch = await Batch.findOne(
        { shopId, productId, batchNumber: batchNumber.toUpperCase() },
        null,
        queryOptions
      );

      if (batch) {
        if (batch.status === 'QUARANTINED' || batch.status === 'EXPIRED') {
          const error = new Error(`Cannot receive stock into a ${batch.status.toLowerCase()} batch.`);
          error.statusCode = 400;
          error.code = 'BATCH_STATUS_BLOCKED';
          throw error;
        }

        // Update batch parameters if provided
        if (manufacturingDate) batch.manufacturingDate = manufacturingDate;
        if (expiryDate) batch.expiryDate = expiryDate;
        if (purchaseCostPaisePerBaseUnit !== undefined) {
          batch.purchaseCostPaisePerBaseUnit = purchaseCostPaisePerBaseUnit;
        }
        await batch.save(queryOptions);
      } else {
        const [newBatch] = await Batch.create(
          [
            {
              shopId,
              productId,
              batchNumber: batchNumber.toUpperCase(),
              manufacturingDate,
              expiryDate,
              purchaseCostPaisePerBaseUnit,
              status: 'ACTIVE',
            },
          ],
          queryOptions
        );
        batch = newBatch;
      }

      // 3. Create immutable StockMovement
      const [movement] = await StockMovement.create(
        [
          {
            shopId,
            productId,
            batchId: batch._id,
            movementType: 'INWARD',
            quantityBase: Math.abs(quantityBase),
            referenceType,
            referenceId: referenceId ? referenceId.trim() : undefined,
            createdBy: req.userId,
            reason: reason.trim(),
          },
        ],
        queryOptions
      );

      // 4. Create AuditLog entry
      await AuditLog.create(
        [
          {
            shopId,
            actorUserId: req.userId,
            action: 'STOCK_RECEIPT',
            entityType: 'STOCK_MOVEMENT',
            entityId: movement._id.toString(),
            reason: `Stock receipt inward of ${quantityBase} ${product.baseUnit} for batch ${batch.batchNumber}`,
            metadata: {
              productId: product._id.toString(),
              batchId: batch._id.toString(),
              batchNumber: batch.batchNumber,
              quantityBase: Math.abs(quantityBase),
              purchaseCostPaisePerBaseUnit,
              referenceType,
              referenceId,
            },
          },
        ],
        queryOptions
      );

      return { movement, batch, product };
    });

    const newProductStock = await getProductStock(shopId, productId);

    return res.status(201).json({
      success: true,
      data: {
        movement: result.movement,
        batch: result.batch,
        newProductStock,
      },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.code || 'INVENTORY_ERROR',
          message: err.message,
        },
      });
    }
    next(err);
  }
}

/**
 * POST /api/v1/inventory/adjustment
 * Records approved stock adjustment with mandatory reason and negative-stock prevention
 * Restricted to OWNER and MANAGER
 */
export async function recordStockAdjustment(req, res, next) {
  try {
    const parseResult = stockAdjustmentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
          details: parseResult.error.flatten(),
        },
      });
    }

    const { productId, batchId, movementType, quantityBase, reason, allowNegative } =
      parseResult.data;
    const shopId = req.user.shopId;

    const result = await withTransaction(async (session) => {
      const queryOptions = session ? { session } : {};

      // 1. Verify Product
      const product = await Product.findOne({ _id: productId, shopId }, null, queryOptions);
      if (!product) {
        const error = new Error('Product not found in this shop');
        error.statusCode = 404;
        error.code = 'PRODUCT_NOT_FOUND';
        throw error;
      }

      // 2. Verify Batch if supplied
      let batch = null;
      if (batchId) {
        batch = await Batch.findOne({ _id: batchId, shopId, productId }, null, queryOptions);
        if (!batch) {
          const error = new Error('Batch not found for this product');
          error.statusCode = 404;
          error.code = 'BATCH_NOT_FOUND';
          throw error;
        }
      }

      // 3. Determine signed quantity
      const isDeduction = movementType === 'ADJUSTMENT_SUBTRACT' || movementType === 'SCRAP';
      const signedQuantity = isDeduction ? -Math.abs(quantityBase) : Math.abs(quantityBase);

      // 4. Validate negative stock policy
      if (isDeduction) {
        const currentProductStock = await getProductStock(shopId, productId);
        if (currentProductStock - Math.abs(quantityBase) < 0 && !allowNegative) {
          const error = new Error(
            `Insufficient stock. Current product balance is ${currentProductStock} ${product.baseUnit}. Adjustment requires explicit negative stock approval.`
          );
          error.statusCode = 400;
          error.code = 'INSUFFICIENT_STOCK';
          throw error;
        }

        if (batchId) {
          const batchStockMap = await getBatchesStockMap(shopId, productId);
          const currentBatchStock = batchStockMap.get(batchId.toString()) || 0;
          if (currentBatchStock - Math.abs(quantityBase) < 0 && !allowNegative) {
            const error = new Error(
              `Insufficient batch stock. Current batch balance is ${currentBatchStock} ${product.baseUnit}. Adjustment requires explicit negative stock approval.`
            );
            error.statusCode = 400;
            error.code = 'INSUFFICIENT_BATCH_STOCK';
            throw error;
          }
        }
      }

      // 5. Create immutable StockMovement
      const referenceType = movementType === 'SCRAP' ? 'SCRAP_LOG' : 'ADJUSTMENT';
      const [movement] = await StockMovement.create(
        [
          {
            shopId,
            productId,
            batchId: batch ? batch._id : null,
            movementType,
            quantityBase: signedQuantity,
            referenceType,
            referenceId: `ADJ-${Date.now()}`,
            createdBy: req.userId,
            reason: reason.trim(),
          },
        ],
        queryOptions
      );

      // 6. Create AuditLog
      await AuditLog.create(
        [
          {
            shopId,
            actorUserId: req.userId,
            action: 'STOCK_ADJUSTMENT',
            entityType: 'STOCK_MOVEMENT',
            entityId: movement._id.toString(),
            reason: reason.trim(),
            metadata: {
              productId: product._id.toString(),
              batchId: batch ? batch._id.toString() : null,
              movementType,
              signedQuantity,
              allowNegative,
              actorRole: req.user.role,
            },
          },
        ],
        queryOptions
      );

      return { movement, product };
    });

    const newStock = await getProductStock(shopId, productId);

    return res.status(201).json({
      success: true,
      data: {
        movement: result.movement,
        newStock,
      },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.code || 'ADJUSTMENT_ERROR',
          message: err.message,
        },
      });
    }
    next(err);
  }
}

/**
 * GET /api/v1/inventory/stock
 * View current stock summary across all products
 */
export async function getStockOverview(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const { categoryId, search, lowStockOnly } = req.query;

    const query = { shopId, active: true };
    if (categoryId) query.categoryId = categoryId;
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      query.$or = [{ nameEn: searchRegex }, { nameMr: searchRegex }, { sku: searchRegex }];
    }

    const products = await Product.find(query)
      .populate('categoryId', 'nameEn nameMr slug')
      .sort({ nameEn: 1 });

    const productIds = products.map((p) => p._id);
    const stockMap = await getProductsStockMap(shopId, productIds);

    let stockItems = products.map((p) => {
      const stock = stockMap.get(p._id.toString()) || 0;
      const reorderLevel = p.reorderLevelBase || 0;
      let status = 'IN_STOCK';
      if (stock <= 0) {
        status = 'OUT_OF_STOCK';
      } else if (stock <= reorderLevel) {
        status = 'LOW_STOCK';
      }

      return {
        _id: p._id,
        sku: p.sku,
        nameEn: p.nameEn,
        nameMr: p.nameMr,
        category: p.categoryId,
        productType: p.productType,
        baseUnit: p.baseUnit,
        packSize: p.packSize,
        defaultSellingPricePaise: p.defaultSellingPricePaise,
        reorderLevelBase: reorderLevel,
        currentStockBase: stock,
        stockStatus: status,
      };
    });

    if (lowStockOnly === 'true') {
      stockItems = stockItems.filter(
        (item) => item.stockStatus === 'LOW_STOCK' || item.stockStatus === 'OUT_OF_STOCK'
      );
    }

    return res.status(200).json({
      success: true,
      data: {
        stock: stockItems,
        totalProducts: stockItems.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/inventory/batches
 * Lists batches with FEFO sorting and expiry tracking
 */
export async function listBatches(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userRole = req.user.role;
    const { productId, status, expiringDays } = req.query;

    const query = { shopId };
    if (productId) query.productId = productId;
    if (status) query.status = status;

    if (expiringDays) {
      const days = parseInt(expiringDays, 10);
      if (!isNaN(days)) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + days);
        query.expiryDate = { $lte: targetDate, $gte: new Date() };
      }
    }

    const rawBatches = await Batch.find(query)
      .populate('productId', 'nameEn nameMr sku baseUnit productType')
      .sort({ expiryDate: 1, createdAt: 1 });

    const batchStockMap = await getBatchesStockMap(shopId);

    const evaluated = rawBatches.map((b) => {
      const stock = batchStockMap.get(b._id.toString()) || 0;
      const evaluatedBatch = evaluateBatch(b, stock);
      if (userRole === 'CASHIER' || userRole === 'CUSTOMER') {
        delete evaluatedBatch.purchaseCostPaisePerBaseUnit;
      }
      return evaluatedBatch;
    });

    return res.status(200).json({
      success: true,
      data: {
        batches: evaluated,
        total: evaluated.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/inventory/batches/:id/status
 * Updates batch status (ACTIVE, QUARANTINED, EXPIRED) with mandatory reason
 * Restricted to OWNER and MANAGER
 */
export async function updateBatchStatus(req, res, next) {
  try {
    const { id } = req.params;
    const shopId = req.user.shopId;

    const parseResult = updateBatchStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
          details: parseResult.error.flatten(),
        },
      });
    }

    const { status, reason } = parseResult.data;

    const batch = await Batch.findOne({ _id: id, shopId });
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'BATCH_NOT_FOUND',
          message: 'Batch not found in this shop',
        },
      });
    }

    const previousStatus = batch.status;
    batch.status = status;
    await batch.save();

    await AuditLog.create({
      shopId,
      actorUserId: req.userId,
      action: 'BATCH_STATUS_UPDATED',
      entityType: 'BATCH',
      entityId: batch._id.toString(),
      reason: reason.trim(),
      metadata: {
        batchNumber: batch.batchNumber,
        previousStatus,
        newStatus: status,
      },
    });

    const batchStockMap = await getBatchesStockMap(shopId);
    const stock = batchStockMap.get(batch._id.toString()) || 0;

    return res.status(200).json({
      success: true,
      data: {
        batch: evaluateBatch(batch, stock),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/inventory/movements
 * Authoritative ledger of stock movements
 * Restricted to OWNER and MANAGER
 */
export async function listStockMovements(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const {
      productId,
      batchId,
      movementType,
      referenceType,
      startDate,
      endDate,
      page = 1,
      limit = 25,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const query = { shopId };
    if (productId) query.productId = productId;
    if (batchId) query.batchId = batchId;
    if (movementType) query.movementType = movementType;
    if (referenceType) query.referenceType = referenceType;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const [totalMovements, movements] = await Promise.all([
      StockMovement.countDocuments(query),
      StockMovement.find(query)
        .populate('productId', 'nameEn nameMr sku baseUnit productType')
        .populate('batchId', 'batchNumber expiryDate status')
        .populate('createdBy', 'name role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        movements,
        pagination: {
          total: totalMovements,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalMovements / limitNum) || 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}
