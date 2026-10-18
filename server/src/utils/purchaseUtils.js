/**
 * Purchase Calculation Utilities
 * Handles line-item calculations, intra/inter-state GST breakdowns, rounding,
 * and grand total aggregations strictly in whole integer paise.
 */

/**
 * Calculates a single purchase line item.
 * Wholesale purchases in India typically quote base rates plus applicable GST.
 *
 * @param {Object} item
 * @param {boolean} [isInterstate=false]
 * @returns {Object} Computed line item values in integer paise
 */
export function calculatePurchaseItem(item, isInterstate = false) {
  const quantity = Number(item.quantity);
  const freeQuantity = Number(item.freeQuantity || 0);
  const purchaseRatePaise = Math.round(Number(item.purchaseRatePaise));
  const discountPaise = Math.round(Number(item.discountPaise || 0));
  const gstRate = Number(item.gstRate || 0);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Line quantity must be a finite positive number');
  }
  if (!Number.isInteger(purchaseRatePaise) || purchaseRatePaise < 0) {
    throw new Error('Purchase rate must be a non-negative integer in paise');
  }
  if (!Number.isInteger(discountPaise) || discountPaise < 0) {
    throw new Error('Discount must be a non-negative integer in paise');
  }

  // Base purchase value
  const baseValuePaise = Math.round(quantity * purchaseRatePaise);
  const taxableAmountPaise = Math.max(0, baseValuePaise - discountPaise);

  // GST Calculation
  const totalTaxPaise = Math.round((taxableAmountPaise * gstRate) / 100);

  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;

  if (isInterstate) {
    igstPaise = totalTaxPaise;
  } else {
    cgstPaise = Math.floor(totalTaxPaise / 2);
    sgstPaise = totalTaxPaise - cgstPaise;
  }

  const lineTotalPaise = taxableAmountPaise + totalTaxPaise;

  const sellingPricePaise =
    item.sellingPricePaise !== undefined && item.sellingPricePaise !== null
      ? Math.round(Number(item.sellingPricePaise))
      : null;

  return {
    productId: item.productId,
    nameSnapshot: item.nameSnapshot,
    skuSnapshot: item.skuSnapshot,
    unitSnapshot: item.unitSnapshot,
    batchNumber: (item.batchNumber || '').trim().toUpperCase(),
    manufacturingDate: item.manufacturingDate ? new Date(item.manufacturingDate) : null,
    expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
    quantity,
    freeQuantity,
    purchaseRatePaise,
    discountPaise,
    taxableAmountPaise,
    gstRate,
    cgstPaise,
    sgstPaise,
    igstPaise,
    lineTotalPaise,
    sellingPricePaise,
  };
}

/**
 * Calculates complete purchase bill totals.
 *
 * @param {Array<Object>} rawItems
 * @param {Object} [options={}]
 * @param {number} [options.additionalChargesPaise=0]
 * @param {number} [options.paidPaise=0]
 * @param {boolean} [options.isInterstate=false]
 * @param {boolean} [options.autoRoundOff=true]
 * @returns {Object} Full purchase financial totals
 */
export function calculatePurchaseTotals(rawItems, options = {}) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error('Purchase must contain at least one line item');
  }

  const isInterstate = Boolean(options.isInterstate);
  const additionalChargesPaise = Math.max(0, Math.round(Number(options.additionalChargesPaise || 0)));
  const requestedPaidPaise = Math.max(0, Math.round(Number(options.paidPaise || 0)));

  const computedItems = rawItems.map((item) => calculatePurchaseItem(item, isInterstate));

  let subtotalPaise = 0;
  let taxTotalPaise = 0;

  for (const item of computedItems) {
    subtotalPaise += item.taxableAmountPaise;
    taxTotalPaise += item.cgstPaise + item.sgstPaise + item.igstPaise;
  }

  const unroundedTotalPaise = subtotalPaise + taxTotalPaise + additionalChargesPaise;

  // Round-off to nearest rupee (100 paise)
  let roundOffPaise = 0;
  if (options.autoRoundOff !== false) {
    const remainder = unroundedTotalPaise % 100;
    if (remainder >= 50) {
      roundOffPaise = 100 - remainder;
    } else if (remainder > 0) {
      roundOffPaise = -remainder;
    }
  }

  const grandTotalPaise = Math.max(0, unroundedTotalPaise + roundOffPaise);
  const paidPaise = Math.min(grandTotalPaise, requestedPaidPaise);
  const balancePaise = grandTotalPaise - paidPaise;

  let paymentStatus = 'UNPAID';
  if (balancePaise === 0 && grandTotalPaise > 0) {
    paymentStatus = 'PAID';
  } else if (paidPaise > 0) {
    paymentStatus = 'PARTIALLY_PAID';
  }

  return {
    items: computedItems,
    additionalChargesPaise,
    subtotalPaise,
    taxTotalPaise,
    roundOffPaise,
    grandTotalPaise,
    paidPaise,
    balancePaise,
    paymentStatus,
    isInterstate,
  };
}
