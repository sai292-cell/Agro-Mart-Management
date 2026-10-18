import mongoose from 'mongoose';

const { Schema } = mongoose;

export const INVOICE_STATUSES = ['FINALIZED', 'CANCELLED'];
export const PAYMENT_STATUSES = ['PAID', 'PARTIALLY_PAID', 'UNPAID'];
export const SALE_TYPES = ['RETAIL', 'WHOLESALE'];

/**
 * Embedded Invoice Item Schema
 * Snapshot of product, batch, unit price, tax, and discount at the moment of sale.
 */
const invoiceItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
    },
    sku: {
      type: String,
      required: [true, 'Product SKU snapshot is required'],
      trim: true,
      uppercase: true,
    },
    nameEn: {
      type: String,
      required: [true, 'English product name snapshot is required'],
      trim: true,
    },
    nameMr: {
      type: String,
      required: [true, 'Marathi product name snapshot is required'],
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
      default: '',
    },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: 'Batch',
      default: null,
    },
    batchNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    baseUnit: {
      type: String,
      required: [true, 'Base unit snapshot is required'],
    },
    packSize: {
      type: Number,
      required: true,
      default: 1,
    },
    quantityBase: {
      type: Number,
      required: [true, 'Quantity in base unit is required'],
      min: [0.0001, 'Quantity must be positive'],
    },
    unitSellingPricePaise: {
      type: Number,
      required: [true, 'Unit selling price in paise is required'],
      min: [0, 'Selling price cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Unit selling price must be an integer in paise',
      },
    },
    lineDiscountPaise: {
      type: Number,
      default: 0,
      min: [0, 'Line discount cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Line discount must be an integer in paise',
      },
    },
    taxableAmountPaise: {
      type: Number,
      required: true,
      min: [0, 'Taxable amount cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Taxable amount must be an integer in paise',
      },
    },
    hsnCode: {
      type: String,
      trim: true,
      default: '',
    },
    gstRatePercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    cgstPaise: {
      type: Number,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger },
    },
    sgstPaise: {
      type: Number,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger },
    },
    igstPaise: {
      type: Number,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger },
    },
    taxTotalPaise: {
      type: Number,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger },
    },
    lineTotalPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Line total must be an integer in paise',
      },
    },
  },
  {
    _id: true,
    timestamps: false,
  }
);

/**
 * Invoice Model
 * Represents finalized POS sales, legal tax invoices, payment allocations, and cancellations.
 */
const invoiceSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID is required'],
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      trim: true,
      uppercase: true,
      maxlength: 50,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
      default: 'Walk-in Customer (रोख ग्राहक)',
      maxlength: 100,
    },
    customerPhone: {
      type: String,
      trim: true,
      default: '',
      maxlength: 20,
    },
    customerVillage: {
      type: String,
      trim: true,
      default: '',
      maxlength: 100,
    },
    saleType: {
      type: String,
      enum: SALE_TYPES,
      default: 'RETAIL',
      required: true,
    },
    status: {
      type: String,
      enum: INVOICE_STATUSES,
      default: 'FINALIZED',
      required: true,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      required: true,
      index: true,
    },
    items: {
      type: [invoiceItemSchema],
      required: [true, 'Invoice must contain at least one item'],
      validate: {
        validator: function (items) {
          return Array.isArray(items) && items.length > 0;
        },
        message: 'Invoice items list cannot be empty',
      },
    },
    // Financial calculation fields strictly in integer paise
    itemsSubtotalPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger },
    },
    discountPaise: {
      type: Number,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger },
    },
    discountAuthorizedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    taxableTotalPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger },
    },
    cgstTotalPaise: {
      type: Number,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger },
    },
    sgstTotalPaise: {
      type: Number,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger },
    },
    igstTotalPaise: {
      type: Number,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger },
    },
    taxTotalPaise: {
      type: Number,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger },
    },
    roundOffPaise: {
      type: Number,
      default: 0,
      validate: { validator: Number.isInteger },
    },
    grandTotalPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Grand total must be an integer in paise',
      },
    },
    paidAmountPaise: {
      type: Number,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger },
    },
    balanceDuePaise: {
      type: Number,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger },
    },
    paymentMethodsUsed: {
      type: [String],
      default: [],
    },
    paymentReferences: {
      type: [String],
      default: [],
    },
    // Cancellation tracking
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 255,
      default: '',
    },
    // Staff & Audit Reference
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by user is required'],
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 255,
      default: '',
    },
    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 100,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// Indexes
invoiceSchema.index({ shopId: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index(
  { shopId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);
invoiceSchema.index({ shopId: 1, createdAt: -1 });
invoiceSchema.index({ shopId: 1, customerId: 1, createdAt: -1 });
invoiceSchema.index({ shopId: 1, status: 1, paymentStatus: 1 });

export const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
