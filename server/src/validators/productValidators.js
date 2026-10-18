import { z } from 'zod';
import { PRODUCT_TYPES, BASE_UNITS } from '../models/Product.js';
import { BATCH_STATUSES } from '../models/Batch.js';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z
  .string({ required_error: 'Valid ID is required' })
  .regex(objectIdRegex, 'Invalid MongoDB ObjectId format');

export const createCategorySchema = z.object({
  nameEn: z
    .string({ required_error: 'English category name is required' })
    .trim()
    .min(1, 'English name cannot be empty')
    .max(100, 'English name cannot exceed 100 characters'),
  nameMr: z
    .string({ required_error: 'Marathi category name is required' })
    .trim()
    .min(1, 'Marathi name cannot be empty')
    .max(100, 'Marathi name cannot exceed 100 characters'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(120, 'Slug cannot exceed 120 characters')
    .optional(),
  parentId: z
    .string()
    .regex(objectIdRegex, 'Invalid parent category ID')
    .nullable()
    .optional(),
});

export const updateCategorySchema = z.object({
  nameEn: z
    .string()
    .trim()
    .min(1, 'English name cannot be empty')
    .max(100, 'English name cannot exceed 100 characters')
    .optional(),
  nameMr: z
    .string()
    .trim()
    .min(1, 'Marathi name cannot be empty')
    .max(100, 'Marathi name cannot exceed 100 characters')
    .optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(120, 'Slug cannot exceed 120 characters')
    .optional(),
  parentId: z
    .string()
    .regex(objectIdRegex, 'Invalid parent category ID')
    .nullable()
    .optional(),
  active: z.boolean().optional(),
});

export const createProductSchema = z.object({
  sku: z
    .string({ required_error: 'Product SKU is required' })
    .trim()
    .min(1, 'SKU cannot be empty')
    .max(50, 'SKU cannot exceed 50 characters')
    .toUpperCase(),
  barcode: z
    .string()
    .trim()
    .max(50, 'Barcode cannot exceed 50 characters')
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
  nameEn: z
    .string({ required_error: 'English product name is required' })
    .trim()
    .min(1, 'English name cannot be empty')
    .max(150, 'English name cannot exceed 150 characters'),
  nameMr: z
    .string({ required_error: 'Marathi product name is required' })
    .trim()
    .min(1, 'Marathi name cannot be empty')
    .max(150, 'Marathi name cannot exceed 150 characters'),
  categoryId: objectIdSchema,
  brand: z
    .string()
    .trim()
    .max(100, 'Brand cannot exceed 100 characters')
    .optional()
    .default(''),
  productType: z.enum(PRODUCT_TYPES, {
    errorMap: () => ({ message: `Product type must be one of: ${PRODUCT_TYPES.join(', ')}` }),
  }),
  baseUnit: z.enum(BASE_UNITS, {
    errorMap: () => ({ message: `Base unit must be one of: ${BASE_UNITS.join(', ')}` }),
  }),
  packSize: z
    .number({ required_error: 'Pack size is required' })
    .positive('Pack size must be greater than zero')
    .default(1),
  reorderLevelBase: z
    .number({ required_error: 'Reorder level is required' })
    .min(0, 'Reorder level cannot be negative')
    .default(0),
  defaultSellingPricePaise: z
    .number({ required_error: 'Default selling price in paise is required' })
    .int('Selling price must be an integer in paise')
    .min(0, 'Selling price cannot be negative'),
  taxClassification: z
    .object({
      hsnCode: z.string().trim().max(20, 'HSN code cannot exceed 20 characters').optional().default(''),
      gstRatePercent: z.number().min(0, 'GST cannot be negative').max(100, 'GST cannot exceed 100%').default(0),
      isExempt: z.boolean().default(false),
    })
    .optional()
    .default({}),
  active: z.boolean().optional().default(true),
});

export const updateProductSchema = createProductSchema.partial();

export const stockReceiptSchema = z.object({
  productId: objectIdSchema,
  batchNumber: z
    .string({ required_error: 'Batch number is required' })
    .trim()
    .min(1, 'Batch number cannot be empty')
    .max(50, 'Batch number cannot exceed 50 characters')
    .toUpperCase(),
  manufacturingDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  expiryDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  purchaseCostPaisePerBaseUnit: z
    .number({ required_error: 'Purchase cost per base unit in paise is required' })
    .int('Purchase cost must be a whole integer in paise')
    .min(0, 'Purchase cost cannot be negative'),
  quantityBase: z
    .number({ required_error: 'Inward quantity in base units is required' })
    .positive('Inward quantity must be greater than zero'),
  referenceType: z.enum(['PURCHASE', 'INITIAL_STOCK'], {
    errorMap: () => ({ message: 'Reference type must be PURCHASE or INITIAL_STOCK' }),
  }),
  referenceId: z.string().trim().max(100, 'Reference ID cannot exceed 100 characters').optional().default(''),
  reason: z
    .string({ required_error: 'Reason / audit note is required' })
    .trim()
    .min(3, 'Reason must be at least 3 characters')
    .max(255, 'Reason cannot exceed 255 characters'),
});

export const stockAdjustmentSchema = z.object({
  productId: objectIdSchema,
  batchId: z
    .string()
    .regex(objectIdRegex, 'Invalid Batch ObjectId format')
    .optional()
    .nullable(),
  movementType: z.enum(['ADJUSTMENT_ADD', 'ADJUSTMENT_SUBTRACT', 'SCRAP'], {
    errorMap: () => ({ message: 'Movement type must be ADJUSTMENT_ADD, ADJUSTMENT_SUBTRACT, or SCRAP' }),
  }),
  quantityBase: z
    .number({ required_error: 'Adjustment quantity in base unit is required' })
    .positive('Quantity must be a positive number'),
  reason: z
    .string({ required_error: 'Mandatory reason is required for stock adjustment' })
    .trim()
    .min(3, 'Adjustment reason must be at least 3 characters')
    .max(255, 'Adjustment reason cannot exceed 255 characters'),
  allowNegative: z.boolean().optional().default(false),
});

export const updateBatchStatusSchema = z.object({
  status: z.enum(BATCH_STATUSES, {
    errorMap: () => ({ message: `Batch status must be one of: ${BATCH_STATUSES.join(', ')}` }),
  }),
  reason: z
    .string({ required_error: 'Reason is required for batch status change' })
    .trim()
    .min(3, 'Reason must be at least 3 characters')
    .max(255, 'Reason cannot exceed 255 characters'),
});
