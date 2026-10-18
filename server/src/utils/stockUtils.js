import mongoose from 'mongoose';
import { StockMovement } from '../models/StockMovement.js';

/**
 * Returns current stock for a specific product derived from the StockMovement ledger.
 * @param {mongoose.Types.ObjectId|string} shopId
 * @param {mongoose.Types.ObjectId|string} productId
 * @returns {Promise<number>} Total quantity in base unit
 */
export async function getProductStock(shopId, productId) {
  const match = {
    shopId: new mongoose.Types.ObjectId(shopId),
    productId: new mongoose.Types.ObjectId(productId),
  };

  const result = await StockMovement.aggregate([
    { $match: match },
    { $group: { _id: '$productId', totalStock: { $sum: '$quantityBase' } } },
  ]);

  return result.length > 0 ? result[0].totalStock : 0;
}

/**
 * Returns a map of current stocks for multiple products: { [productId]: totalStock }
 * @param {mongoose.Types.ObjectId|string} shopId
 * @param {Array<mongoose.Types.ObjectId|string>} [productIds]
 * @returns {Promise<Map<string, number>>}
 */
export async function getProductsStockMap(shopId, productIds = null) {
  const match = {
    shopId: new mongoose.Types.ObjectId(shopId),
  };

  if (productIds && productIds.length > 0) {
    match.productId = {
      $in: productIds.map((id) => new mongoose.Types.ObjectId(id)),
    };
  }

  const results = await StockMovement.aggregate([
    { $match: match },
    { $group: { _id: '$productId', totalStock: { $sum: '$quantityBase' } } },
  ]);

  const stockMap = new Map();
  for (const row of results) {
    stockMap.set(row._id.toString(), row.totalStock);
  }
  return stockMap;
}

/**
 * Returns a map of current stocks for batches: { [batchId]: totalStock }
 * @param {mongoose.Types.ObjectId|string} shopId
 * @param {mongoose.Types.ObjectId|string} [productId]
 * @returns {Promise<Map<string, number>>}
 */
export async function getBatchesStockMap(shopId, productId = null) {
  const match = {
    shopId: new mongoose.Types.ObjectId(shopId),
    batchId: { $ne: null },
  };

  if (productId) {
    match.productId = new mongoose.Types.ObjectId(productId);
  }

  const results = await StockMovement.aggregate([
    { $match: match },
    { $group: { _id: '$batchId', totalStock: { $sum: '$quantityBase' } } },
  ]);

  const stockMap = new Map();
  for (const row of results) {
    stockMap.set(row._id.toString(), row.totalStock);
  }
  return stockMap;
}

/**
 * Evaluates batch expiry details and effective sales eligibility
 * @param {object} batch
 * @param {number} batchStock
 */
export function evaluateBatch(batch, batchStock = 0) {
  const now = new Date();
  let isExpired = false;
  let daysUntilExpiry = null;

  if (batch.expiryDate) {
    const expiry = new Date(batch.expiryDate);
    daysUntilExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry <= 0) {
      isExpired = true;
    }
  }

  if (batch.status === 'EXPIRED') {
    isExpired = true;
  }

  let effectiveStatus = batch.status;
  if (batch.status === 'QUARANTINED') {
    effectiveStatus = 'QUARANTINED';
  } else if (isExpired) {
    effectiveStatus = 'EXPIRED';
  } else {
    effectiveStatus = 'ACTIVE';
  }

  // Strictly block expired or quarantined batches from sales
  const isAvailableForSale = effectiveStatus === 'ACTIVE' && batchStock > 0;

  return {
    ...batch.toObject ? batch.toObject() : batch,
    currentStockBase: batchStock,
    isExpired,
    daysUntilExpiry,
    effectiveStatus,
    isAvailableForSale,
  };
}
