import mongoose from 'mongoose';
import { Batch } from '../models/Batch.js';
import { getBatchesStockMap } from './stockUtils.js';

/**
 * Calculates line tax and totals for intrastate Maharashtra retail sales (CGST 50% + SGST 50%).
 * Selling prices at agro counters are tax-inclusive MRP.
 * 
 * @param {number} quantityBase
 * @param {number} unitSellingPricePaise
 * @param {number} lineDiscountPaise
 * @param {object} taxClassification
 */
export function calculateLineItemFinancials(
  quantityBase,
  unitSellingPricePaise,
  lineDiscountPaise = 0,
  taxClassification = {}
) {
  const itemGrossPaise = Math.round(quantityBase * unitSellingPricePaise);
  const discountedItemPaise = Math.max(0, itemGrossPaise - lineDiscountPaise);

  const isExempt = Boolean(taxClassification.isExempt);
  const gstRatePercent = isExempt ? 0 : Number(taxClassification.gstRatePercent) || 0;
  const hsnCode = taxClassification.hsnCode || '';

  if (isExempt || gstRatePercent === 0) {
    return {
      taxableAmountPaise: discountedItemPaise,
      hsnCode,
      gstRatePercent: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      taxTotalPaise: 0,
      lineTotalPaise: discountedItemPaise,
    };
  }

  // Tax-inclusive formula: Taxable = Total / (1 + Rate / 100)
  const taxableAmountPaise = Math.round(
    (discountedItemPaise * 100) / (100 + gstRatePercent)
  );
  const taxTotalPaise = discountedItemPaise - taxableAmountPaise;

  // Intrastate 50-50 split for Maharashtra
  const cgstPaise = Math.round(taxTotalPaise / 2);
  const sgstPaise = taxTotalPaise - cgstPaise;

  return {
    taxableAmountPaise,
    hsnCode,
    gstRatePercent,
    cgstPaise,
    sgstPaise,
    igstPaise: 0,
    taxTotalPaise,
    lineTotalPaise: discountedItemPaise,
  };
}

/**
 * Validates or automatically allocates active manufacturer batches via FEFO.
 * Strictly blocks expired or quarantined batches from sales.
 * 
 * @param {mongoose.Types.ObjectId|string} shopId
 * @param {object} product - Mongoose Product document
 * @param {number} requestedQuantityBase
 * @param {string|null} [explicitBatchId]
 * @param {mongoose.ClientSession|null} [session]
 * @returns {Promise<Array<{ batch: object, quantityBase: number }>>}
 */
export async function allocateBatchStock(
  shopId,
  product,
  requestedQuantityBase,
  explicitBatchId = null,
  session = null
) {
  const now = new Date();
  const queryOptions = session ? { session } : {};

  // Case 1: Specific batch explicitly selected by Cashier
  if (explicitBatchId) {
    const batch = await Batch.findOne(
      { _id: explicitBatchId, shopId, productId: product._id },
      null,
      queryOptions
    );

    if (!batch) {
      const err = new Error(`Batch not found for product ${product.nameEn}`);
      err.statusCode = 404;
      err.code = 'BATCH_NOT_FOUND';
      throw err;
    }

    if (batch.status === 'QUARANTINED') {
      const err = new Error(`Batch ${batch.batchNumber} is quarantined and strictly blocked from sale.`);
      err.statusCode = 400;
      err.code = 'BATCH_QUARANTINED';
      throw err;
    }

    if (batch.status === 'EXPIRED' || (batch.expiryDate && new Date(batch.expiryDate) < now)) {
      const err = new Error(`Batch ${batch.batchNumber} has expired and strictly cannot be sold.`);
      err.statusCode = 400;
      err.code = 'BATCH_EXPIRED';
      throw err;
    }

    // Verify stock availability for this batch
    const batchStockMap = await getBatchesStockMap(shopId, product._id);
    const availableBatchStock = batchStockMap.get(batch._id.toString()) || 0;

    if (availableBatchStock < requestedQuantityBase) {
      const err = new Error(
        `Insufficient stock for batch ${batch.batchNumber}. Available: ${availableBatchStock} ${product.baseUnit}, Requested: ${requestedQuantityBase} ${product.baseUnit}.`
      );
      err.statusCode = 400;
      err.code = 'INSUFFICIENT_BATCH_STOCK';
      throw err;
    }

    return [{ batch, quantityBase: requestedQuantityBase }];
  }

  // Case 2: Auto-FEFO Allocation (First-Expired-First-Out)
  // Fetch candidate active batches sorted by earliest expiryDate, then creation date
  const candidateBatches = await Batch.find(
    {
      shopId,
      productId: product._id,
      status: 'ACTIVE',
      $or: [{ expiryDate: { $gte: now } }, { expiryDate: null }],
    },
    null,
    queryOptions
  ).sort({ expiryDate: 1, createdAt: 1 });

  if (candidateBatches.length === 0) {
    // If no active batches exist in collection for this product
    const err = new Error(
      `No active, non-expired batches available for product ${product.nameEn} (${product.sku}).`
    );
    err.statusCode = 400;
    err.code = 'NO_ACTIVE_BATCHES';
    throw err;
  }

  const batchStockMap = await getBatchesStockMap(shopId, product._id);
  const allocations = [];
  let remainingQuantity = requestedQuantityBase;

  for (const batch of candidateBatches) {
    const currentStock = batchStockMap.get(batch._id.toString()) || 0;
    if (currentStock <= 0) continue;

    const allocQty = Math.min(remainingQuantity, currentStock);
    allocations.push({
      batch,
      quantityBase: allocQty,
    });

    remainingQuantity -= allocQty;
    if (remainingQuantity <= 0) break;
  }

  if (remainingQuantity > 0) {
    const totalAvailable = requestedQuantityBase - remainingQuantity;
    const err = new Error(
      `Insufficient active stock for ${product.nameEn}. Available active stock: ${totalAvailable} ${product.baseUnit}, Requested: ${requestedQuantityBase} ${product.baseUnit}.`
    );
    err.statusCode = 400;
    err.code = 'INSUFFICIENT_STOCK';
    throw err;
  }

  return allocations;
}
