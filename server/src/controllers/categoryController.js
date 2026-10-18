import { Category } from '../models/Category.js';
import { AuditLog } from '../models/AuditLog.js';
import {
  createCategorySchema,
  updateCategorySchema,
} from '../validators/productValidators.js';

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * GET /api/v1/categories
 * Lists categories for current shop
 */
export async function listCategories(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const { active } = req.query;

    const query = { shopId };
    if (active !== undefined) {
      query.active = active === 'true';
    } else if (req.user.role === 'CUSTOMER') {
      query.active = true;
    }

    const categories = await Category.find(query)
      .populate('parentId', 'nameEn nameMr slug')
      .sort({ nameEn: 1 });

    return res.status(200).json({
      success: true,
      data: {
        categories,
        total: categories.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/categories
 * Creates a new category (Restricted to OWNER and MANAGER)
 */
export async function createCategory(req, res, next) {
  try {
    const parseResult = createCategorySchema.safeParse(req.body);
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

    const { nameEn, nameMr, slug: customSlug, parentId } = parseResult.data;
    const shopId = req.user.shopId;
    const finalSlug = customSlug || slugify(nameEn);

    // Check slug uniqueness within shop
    const existing = await Category.findOne({ shopId, slug: finalSlug });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_SLUG',
          message: `Category with slug '${finalSlug}' already exists for this shop`,
        },
      });
    }

    if (parentId) {
      const parent = await Category.findOne({ _id: parentId, shopId });
      if (!parent) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PARENT_CATEGORY_NOT_FOUND',
            message: 'Parent category does not exist in this shop',
          },
        });
      }
    }

    const category = await Category.create({
      shopId,
      nameEn,
      nameMr,
      slug: finalSlug,
      parentId: parentId || null,
      active: true,
    });

    await AuditLog.create({
      shopId,
      actorUserId: req.userId,
      action: 'CATEGORY_CREATED',
      entityType: 'CATEGORY',
      entityId: category._id.toString(),
      reason: `Created category ${nameEn} (${nameMr})`,
      metadata: {
        slug: finalSlug,
        parentId: parentId || null,
      },
    });

    return res.status(201).json({
      success: true,
      data: { category },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/categories/:id
 * Updates category details (Restricted to OWNER and MANAGER)
 */
export async function updateCategory(req, res, next) {
  try {
    const { id } = req.params;
    const parseResult = updateCategorySchema.safeParse(req.body);
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

    const shopId = req.user.shopId;
    const category = await Category.findOne({ _id: id, shopId });
    if (!category) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CATEGORY_NOT_FOUND',
          message: 'Category not found in this shop',
        },
      });
    }

    const data = parseResult.data;

    if (data.slug && data.slug !== category.slug) {
      const duplicate = await Category.findOne({
        shopId,
        slug: data.slug,
        _id: { $ne: id },
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_SLUG',
            message: `Category with slug '${data.slug}' already exists`,
          },
        });
      }
      category.slug = data.slug;
    }

    if (data.nameEn !== undefined) category.nameEn = data.nameEn;
    if (data.nameMr !== undefined) category.nameMr = data.nameMr;
    if (data.parentId !== undefined) {
      if (data.parentId === id) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PARENT',
            message: 'A category cannot be its own parent',
          },
        });
      }
      category.parentId = data.parentId;
    }
    if (data.active !== undefined) category.active = data.active;

    await category.save();

    await AuditLog.create({
      shopId,
      actorUserId: req.userId,
      action: 'CATEGORY_UPDATED',
      entityType: 'CATEGORY',
      entityId: category._id.toString(),
      reason: `Updated category ${category.nameEn}`,
      metadata: data,
    });

    return res.status(200).json({
      success: true,
      data: { category },
    });
  } catch (err) {
    next(err);
  }
}
