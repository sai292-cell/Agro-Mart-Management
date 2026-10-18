import mongoose from 'mongoose';

const { Schema } = mongoose;

export const PURCHASE_STATUSES = ['DRAFT', 'RECEIVED', 'CANCELLED'];
export const PURCHASE_PAYMENT_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'PAID'];
export const PURCHASE_PAYMENT_MODES = [
  'CREDIT',
  'CASH',
  'UPI',
  'BANK_TRANSFER',
  'CHEQUE',
  'SPLIT',
];

const purchaseItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
    },
    nameSnapshot: {
      type: String,
      required: [true, 'Product name snapshot is required'],
      trim: true,
    },
    skuSnapshot: {
      type: String,
      required: [true, 'Product SKU snapshot is required'],
      trim: true,
    },
    unitSnapshot: {
      type: String,
      required: [true, 'Unit snapshot is required'],
    },
    batchNumber: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 50,
      default: '',
    },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: 'Batch',
      default: null,
    },
    manufacturingDate: {
      type: Date,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0.0001, 'Quantity must be greater than zero'],
      validate: {
        validator: Number.isFinite,
        message: 'Quantity must be a finite number',
      },
    },
    freeQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Free quantity cannot be negative'],
      validate: {
        validator: Number.isFinite,
        message: 'Free quantity must be a finite number',
      },
    },
    purchaseRatePaise: {
      type: Number,
      required: [true, 'Purchase rate is required in paise'],
      min: [0, 'Purchase rate cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Purchase rate must be an integer in paise',
      },
    },
    discountPaise: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Discount must be an integer in paise',
      },
    },
    taxableAmountPaise: {
      type: Number,
      required: [true, 'Taxable amount is required in paise'],
      min: [0, 'Taxable amount cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Taxable amount must be an integer in paise',
      },
    },
    gstRate: {
      type: Number,
      required: [true, 'GST rate is required'],
      min: [0, 'GST rate cannot be negative'],
      max: [28, 'GST rate cannot exceed 28%'],
    },
    cgstPaise: {
      type: Number,
      default: 0,
      min: [0, 'CGST cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'CGST must be an integer in paise',
      },
    },
    sgstPaise: {
      type: Number,
      default: 0,
      min: [0, 'SGST cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'SGST must be an integer in paise',
      },
    },
    igstPaise: {
      type: Number,
      default: 0,
      min: [0, 'IGST cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'IGST must be an integer in paise',
      },
    },
    lineTotalPaise: {
      type: Number,
      required: [true, 'Line total is required in paise'],
      min: [0, 'Line total cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Line total must be an integer in paise',
      },
    },
    sellingPricePaise: {
      type: Number,
      default: null,
      validate: {
        validator: function (v) {
          return v === null || (Number.isInteger(v) && v >= 0);
        },
        message: 'Selling price must be a non-negative integer in paise',
      },
    },
  },
  { _id: true }
);

const purchaseSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID is required'],
      index: true,
    },
    purchaseNumber: {
      type: String,
      required: [true, 'Purchase number is required'],
      trim: true,
      uppercase: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: [true, 'Supplier ID is required'],
      index: true,
    },
    supplierInvoiceNumber: {
      type: String,
      required: [true, 'Supplier invoice number is required'],
      trim: true,
      maxlength: [100, 'Supplier invoice number cannot exceed 100 characters'],
      index: true,
    },
    supplierInvoiceDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    entryDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Staff member receiving purchase is required'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: PURCHASE_STATUSES,
        message: '{VALUE} is not a valid purchase status. Allowed: DRAFT, RECEIVED, CANCELLED',
      },
      default: 'DRAFT',
      required: true,
      index: true,
    },
    items: {
      type: [purchaseItemSchema],
      required: [true, 'At least one purchase item is required'],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'Purchase must have at least one line item',
      },
    },
    additionalChargesPaise: {
      type: Number,
      default: 0,
      min: [0, 'Additional charges cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Additional charges must be an integer in paise',
      },
    },
    subtotalPaise: {
      type: Number,
      required: [true, 'Subtotal is required in paise'],
      min: [0, 'Subtotal cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Subtotal must be an integer in paise',
      },
    },
    taxTotalPaise: {
      type: Number,
      required: [true, 'Tax total is required in paise'],
      min: [0, 'Tax total cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Tax total must be an integer in paise',
      },
    },
    roundOffPaise: {
      type: Number,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Round off must be an integer in paise',
      },
    },
    grandTotalPaise: {
      type: Number,
      required: [true, 'Grand total is required in paise'],
      min: [0, 'Grand total cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Grand total must be an integer in paise',
      },
    },
    paidPaise: {
      type: Number,
      default: 0,
      min: [0, 'Paid amount cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Paid amount must be an integer in paise',
      },
    },
    balancePaise: {
      type: Number,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Balance must be an integer in paise',
      },
    },
    paymentStatus: {
      type: String,
      enum: {
        values: PURCHASE_PAYMENT_STATUSES,
        message: '{VALUE} is not a valid payment status',
      },
      default: 'UNPAID',
      required: true,
      index: true,
    },
    paymentMode: {
      type: String,
      enum: {
        values: PURCHASE_PAYMENT_MODES,
        message: '{VALUE} is not a valid payment mode',
      },
      default: 'CREDIT',
      required: true,
    },
    isInterstate: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: '',
    },
    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    receivedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 255,
      default: '',
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// Indexes
purchaseSchema.index({ shopId: 1, purchaseNumber: 1 }, { unique: true });
purchaseSchema.index(
  { shopId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);
purchaseSchema.index({ shopId: 1, supplierId: 1, purchaseDate: -1 });
purchaseSchema.index({ shopId: 1, status: 1, paymentStatus: 1 });
purchaseSchema.index({ shopId: 1, supplierInvoiceNumber: 1 });

export const Purchase = mongoose.models.Purchase || mongoose.model('Purchase', purchaseSchema);
