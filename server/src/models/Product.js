import mongoose from 'mongoose';

const { Schema } = mongoose;

export const PRODUCT_TYPES = [
  'SEED',
  'FERTILIZER',
  'PESTICIDE',
  'FUNGICIDE',
  'HERBICIDE',
  'EQUIPMENT',
  'OTHER',
];

export const BASE_UNITS = ['KG', 'G', 'LITER', 'ML', 'PIECE', 'BAG', 'PACK'];

/**
 * Product Model
 * Quantities are normalized to the product's documented baseUnit.
 * Packaged units (e.g. 50kg bag) store baseUnit='KG' with packSize=50.
 * Default selling price is strictly stored in integer Paise (e.g., ₹450 = 45000 paise).
 */
const productSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID is required'],
      index: true,
    },
    sku: {
      type: String,
      required: [true, 'Product SKU is required'],
      trim: true,
      uppercase: true,
      maxlength: [50, 'SKU cannot exceed 50 characters'],
    },
    barcode: {
      type: String,
      trim: true,
      maxlength: [50, 'Barcode cannot exceed 50 characters'],
    },
    nameEn: {
      type: String,
      required: [true, 'English product name is required'],
      trim: true,
      maxlength: [150, 'Name cannot exceed 150 characters'],
    },
    nameMr: {
      type: String,
      required: [true, 'Marathi product name is required'],
      trim: true,
      maxlength: [150, 'Name cannot exceed 150 characters'],
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Product category is required'],
      index: true,
    },
    brand: {
      type: String,
      trim: true,
      maxlength: [100, 'Brand cannot exceed 100 characters'],
      default: '',
    },
    productType: {
      type: String,
      enum: {
        values: PRODUCT_TYPES,
        message: '{VALUE} is not a valid agricultural product type',
      },
      required: [true, 'Product type is required'],
      index: true,
    },
    baseUnit: {
      type: String,
      enum: {
        values: BASE_UNITS,
        message: '{VALUE} is not a supported base unit. Allowed: KG, G, LITER, ML, PIECE, BAG, PACK',
      },
      required: [true, 'Base unit is required'],
    },
    packSize: {
      type: Number,
      required: [true, 'Pack size is required'],
      min: [0.0001, 'Pack size must be greater than zero'],
      default: 1,
    },
    reorderLevelBase: {
      type: Number,
      required: [true, 'Reorder level is required'],
      min: [0, 'Reorder level cannot be negative'],
      default: 0,
    },
    defaultSellingPricePaise: {
      type: Number,
      required: [true, 'Default selling price in paise is required'],
      min: [0, 'Selling price cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Selling price must be an integer in paise (e.g. ₹150.00 = 15000 paise)',
      },
    },
    taxClassification: {
      hsnCode: {
        type: String,
        trim: true,
        maxlength: [20, 'HSN code cannot exceed 20 characters'],
        default: '',
      },
      gstRatePercent: {
        type: Number,
        min: [0, 'GST rate cannot be negative'],
        max: [100, 'GST rate cannot exceed 100%'],
        default: 0,
      },
      isExempt: {
        type: Boolean,
        default: false,
      },
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// Unique SKU within a single shop
productSchema.index({ shopId: 1, sku: 1 }, { unique: true });

// Optional unique barcode within a single shop
productSchema.index(
  { shopId: 1, barcode: 1 },
  {
    unique: true,
    partialFilterExpression: { barcode: { $type: 'string' } },
  }
);

productSchema.index({ shopId: 1, categoryId: 1 });
productSchema.index({ shopId: 1, productType: 1 });

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
