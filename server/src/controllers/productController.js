import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Batch } from '../models/Batch.js';
import { AuditLog } from '../models/AuditLog.js';
import {
  createProductSchema,
  updateProductSchema,
} from '../validators/productValidators.js';
import {
  getProductStock,
  getProductsStockMap,
  getBatchesStockMap,
  evaluateBatch,
} from '../utils/stockUtils.js';

/**
 * Strips sensitive financial fields (like supplier purchase costs) for Cashiers & Customers
 */
function sanitizeProductResponse(product, userRole, currentStockBase = 0, batches = []) {
  const p = product.toObject ? product.toObject() : { ...product };

  // Common derived stock stats
  p.currentStockBase = currentStockBase;
  p.isLowStock = currentStockBase <= (p.reorderLevelBase || 0);

  if (userRole === 'CUSTOMER') {
    // Return only customer-safe catalog representation
    return {
      _id: p._id,
      sku: p.sku,
      barcode: p.barcode,
      nameEn: p.nameEn,
      nameMr: p.nameMr,
      brand: p.brand,
      productType: p.productType,
      baseUnit: p.baseUnit,
      packSize: p.packSize,
      defaultSellingPricePaise: p.defaultSellingPricePaise,
      taxClassification: p.taxClassification,
      category: p.categoryId,
      inStock: currentStockBase > 0,
      active: p.active,
    };
  }

  // For CASHIER, sanitize batch purchase costs
  if (userRole === 'CASHIER' && batches.length > 0) {
    p.batches = batches.map((b) => {
      const sanitized = { ...b };
      delete sanitized.purchaseCostPaisePerBaseUnit;
      return sanitized;
    });
  } else if (batches.length > 0) {
    p.batches = batches;
  }

  return p;
}

/**
 * GET /api/v1/products
 * Lists products with pagination, search, category & stock filters
 */
export async function listProducts(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userRole = req.user.role;
    const {
      page = 1,
      limit = 20,
      search,
      categoryId,
      productType,
      active,
      lowStock,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query = { shopId };

    // Role-based active filter
    if (userRole === 'CUSTOMER') {
      query.active = true;
    } else if (active !== undefined && active !== 'all') {
      query.active = active === 'true';
    }

    if (categoryId) {
      query.categoryId = categoryId;
    }

    if (productType) {
      query.productType = productType;
    }

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      query.$or = [
        { nameEn: searchRegex },
        { nameMr: searchRegex },
        { sku: searchRegex },
        { barcode: searchRegex },
        { brand: searchRegex },
      ];
    }

    // Find products matching query
    const [totalProducts, rawProducts] = await Promise.all([
      Product.countDocuments(query),
      Product.find(query)
        .populate('categoryId', 'nameEn nameMr slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    // Attach derived stock ledger values
    const productIds = rawProducts.map((p) => p._id);
    const stockMap = await getProductsStockMap(shopId, productIds);

    let items = rawProducts.map((p) => {
      const stock = stockMap.get(p._id.toString()) || 0;
      return sanitizeProductResponse(p, userRole, stock);
    });

    // If client requested lowStock filter, filter items
    if (lowStock === 'true') {
      items = items.filter((p) => p.isLowStock);
    }

    return res.status(200).json({
      success: true,
      data: {
        products: items,
        pagination: {
          total: totalProducts,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalProducts / limitNum) || 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/products/:id
 * Fetches product details along with batch FEFO breakdown
 */
export async function getProductDetails(req, res, next) {
  try {
    const { id } = req.params;
    const shopId = req.user.shopId;
    const userRole = req.user.role;

    const query = { _id: id, shopId };
    if (userRole === 'CUSTOMER') {
      query.active = true;
    }

    const product = await Product.findOne(query).populate('categoryId', 'nameEn nameMr slug');
    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: 'Product not found in this shop',
        },
      });
    }

    // Fetch batches and stock
    const [currentStock, rawBatches, batchStockMap] = await Promise.all([
      getProductStock(shopId, product._id),
      Batch.find({ shopId, productId: product._id }).sort({ expiryDate: 1, createdAt: 1 }),
      getBatchesStockMap(shopId, product._id),
    ]);

    const evaluatedBatches = rawBatches.map((b) => {
      const bStock = batchStockMap.get(b._id.toString()) || 0;
      return evaluateBatch(b, bStock);
    });

    const sanitized = sanitizeProductResponse(product, userRole, currentStock, evaluatedBatches);

    return res.status(200).json({
      success: true,
      data: {
        product: sanitized,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/products
 * Creates a new product (Restricted to OWNER and MANAGER)
 */
export async function createProduct(req, res, next) {
  try {
    const parseResult = createProductSchema.safeParse(req.body);
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

    const data = parseResult.data;
    const shopId = req.user.shopId;

    // Check SKU uniqueness in shop
    const duplicateSku = await Product.findOne({ shopId, sku: data.sku });
    if (duplicateSku) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_SKU',
          message: `Product with SKU '${data.sku}' already exists in your shop`,
        },
      });
    }

    // Check Barcode uniqueness in shop if provided
    if (data.barcode) {
      const duplicateBarcode = await Product.findOne({ shopId, barcode: data.barcode });
      if (duplicateBarcode) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_BARCODE',
            message: `Product with Barcode '${data.barcode}' already exists in your shop`,
          },
        });
      }
    }

    // Verify category exists in shop
    const category = await Category.findOne({ _id: data.categoryId, shopId });
    if (!category) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CATEGORY_NOT_FOUND',
          message: 'Selected category does not exist in this shop',
        },
      });
    }

    const product = await Product.create({
      shopId,
      ...data,
    });

    await AuditLog.create({
      shopId,
      actorUserId: req.userId,
      action: 'PRODUCT_CREATED',
      entityType: 'PRODUCT',
      entityId: product._id.toString(),
      reason: `Created product ${product.nameEn} (${product.sku})`,
      metadata: {
        sku: product.sku,
        sellingPricePaise: product.defaultSellingPricePaise,
        baseUnit: product.baseUnit,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        product: sanitizeProductResponse(product, req.user.role, 0),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/products/:id
 * Updates product details (Restricted to OWNER and MANAGER)
 */
export async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const shopId = req.user.shopId;

    const parseResult = updateProductSchema.safeParse(req.body);
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

    const product = await Product.findOne({ _id: id, shopId });
    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: 'Product not found in this shop',
        },
      });
    }

    const data = parseResult.data;

    // Check SKU uniqueness if changed
    if (data.sku && data.sku !== product.sku) {
      const duplicateSku = await Product.findOne({
        shopId,
        sku: data.sku,
        _id: { $ne: id },
      });
      if (duplicateSku) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_SKU',
            message: `Product with SKU '${data.sku}' already exists`,
          },
        });
      }
    }

    // Check barcode uniqueness if changed
    if (data.barcode && data.barcode !== product.barcode) {
      const duplicateBarcode = await Product.findOne({
        shopId,
        barcode: data.barcode,
        _id: { $ne: id },
      });
      if (duplicateBarcode) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_BARCODE',
            message: `Product with barcode '${data.barcode}' already exists`,
          },
        });
      }
    }

    // Verify category if changed
    if (data.categoryId && data.categoryId !== product.categoryId.toString()) {
      const category = await Category.findOne({ _id: data.categoryId, shopId });
      if (!category) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CATEGORY_NOT_FOUND',
            message: 'Selected category does not exist in this shop',
          },
        });
      }
    }

    // Apply updates
    Object.assign(product, data);
    await product.save();

    await AuditLog.create({
      shopId,
      actorUserId: req.userId,
      action: 'PRODUCT_UPDATED',
      entityType: 'PRODUCT',
      entityId: product._id.toString(),
      reason: `Updated product ${product.nameEn} (${product.sku})`,
      metadata: data,
    });

    const currentStock = await getProductStock(shopId, product._id);

    return res.status(200).json({
      success: true,
      data: {
        product: sanitizeProductResponse(product, req.user.role, currentStock),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/products/:id/status
 * Activates or deactivates a product (Restricted to OWNER and MANAGER)
 */
export async function toggleProductStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const shopId = req.user.shopId;

    if (typeof active !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Active status (boolean) is required',
        },
      });
    }

    const product = await Product.findOne({ _id: id, shopId });
    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: 'Product not found in this shop',
        },
      });
    }

    product.active = active;
    await product.save();

    await AuditLog.create({
      shopId,
      actorUserId: req.userId,
      action: 'PRODUCT_STATUS_TOGGLED',
      entityType: 'PRODUCT',
      entityId: product._id.toString(),
      reason: `${active ? 'Activated' : 'Deactivated'} product ${product.nameEn}`,
      metadata: { active },
    });

    const currentStock = await getProductStock(shopId, product._id);

    return res.status(200).json({
      success: true,
      data: {
        product: sanitizeProductResponse(product, req.user.role, currentStock),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/products/reorder/low-stock
 * Lists all active products whose current stock is at or below reorder level
 */
export async function listLowStockProducts(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userRole = req.user.role;

    const products = await Product.find({ shopId, active: true })
      .populate('categoryId', 'nameEn nameMr slug')
      .sort({ nameEn: 1 });

    const productIds = products.map((p) => p._id);
    const stockMap = await getProductsStockMap(shopId, productIds);

    const lowStockItems = [];
    for (const p of products) {
      const stock = stockMap.get(p._id.toString()) || 0;
      if (stock <= (p.reorderLevelBase || 0)) {
        const item = sanitizeProductResponse(p, userRole, stock);
        item.deficitBase = Math.max(0, (p.reorderLevelBase || 0) - stock);
        lowStockItems.push(item);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        lowStockProducts: lowStockItems,
        total: lowStockItems.length,
      },
    });
  } catch (err) {
    next(err);
  }
}
