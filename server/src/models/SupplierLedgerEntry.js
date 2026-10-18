import mongoose from 'mongoose';

const { Schema } = mongoose;

export const SUPPLIER_LEDGER_ENTRY_TYPES = [
  'OPENING_BALANCE',
  'PURCHASE_INVOICE',
  'PAYMENT_MADE',
  'PURCHASE_RETURN',
  'DEBIT_NOTE',
  'CREDIT_NOTE',
  'ADJUSTMENT',
  'REVERSAL',
];

export const SUPPLIER_TRANSACTION_TYPES = ['CREDIT', 'DEBIT'];

export const SUPPLIER_REFERENCE_TYPES = [
  'PURCHASE',
  'PAYMENT',
  'RETURN',
  'ADJUSTMENT',
  'OPENING_BALANCE',
  'REVERSAL',
  'OTHER',
];

/**
 * SupplierLedgerEntry Model
 * Immutable financial ledger tracking accounts payable for suppliers.
 *
 * ACCOUNTS PAYABLE CONVENTION:
 * - CREDIT (जमा): Increases the amount owed by the shop to the supplier (खरेदी बिल / देयता वाढ).
 * - DEBIT (नावे): Decreases the amount owed by the shop to the supplier (देय रक्कम / माल परत / सूट).
 * - Net Outstanding Payable = Sum(CREDIT) - Sum(DEBIT).
 *   - Net Balance > 0: Shop owes supplier (देय बाकी).
 *   - Net Balance = 0: Fully settled (हिशोब पूर्ण).
 *   - Net Balance < 0: Advance paid to supplier (अगाऊ जमा).
 */
const supplierLedgerEntrySchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID is required'],
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: [true, 'Supplier ID is required'],
      index: true,
    },
    entryType: {
      type: String,
      enum: {
        values: SUPPLIER_LEDGER_ENTRY_TYPES,
        message: '{VALUE} is not a valid supplier ledger entry type',
      },
      required: [true, 'Supplier ledger entry type is required'],
      index: true,
    },
    transactionType: {
      type: String,
      enum: {
        values: SUPPLIER_TRANSACTION_TYPES,
        message: '{VALUE} is not a valid transaction type. Allowed: CREDIT, DEBIT',
      },
      required: [true, 'Transaction type is required'],
      index: true,
    },
    amountPaise: {
      type: Number,
      required: [true, 'Amount in paise is required'],
      min: [1, 'Amount must be at least 1 paise'],
      validate: {
        validator: Number.isInteger,
        message: 'Amount must be a whole integer in paise',
      },
    },
    runningBalancePaise: {
      type: Number,
      required: [true, 'Running balance in paise is required'],
      validate: {
        validator: Number.isInteger,
        message: 'Running balance must be an integer in paise',
      },
    },
    referenceType: {
      type: String,
      enum: {
        values: SUPPLIER_REFERENCE_TYPES,
        message: '{VALUE} is not a valid reference type',
      },
      required: [true, 'Reference type is required'],
    },
    referenceId: {
      type: String,
      trim: true,
      maxlength: [100, 'Reference ID cannot exceed 100 characters'],
      default: '',
    },
    description: {
      type: String,
      required: [true, 'Transaction description is required'],
      trim: true,
      maxlength: [255, 'Description cannot exceed 255 characters'],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: '',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isReversed: {
      type: Boolean,
      default: false,
      index: true,
    },
    reversedByEntryId: {
      type: Schema.Types.ObjectId,
      ref: 'SupplierLedgerEntry',
      default: null,
    },
    originalEntryId: {
      type: Schema.Types.ObjectId,
      ref: 'SupplierLedgerEntry',
      default: null,
      index: true,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Staff member recording the transaction is required'],
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
supplierLedgerEntrySchema.index({ shopId: 1, supplierId: 1, createdAt: -1 });
supplierLedgerEntrySchema.index({ shopId: 1, supplierId: 1, entryType: 1 });
supplierLedgerEntrySchema.index(
  { shopId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

// Immutability Safeguards
supplierLedgerEntrySchema.pre('save', function () {
  if (!this.isNew) {
    const error = new Error('SupplierLedgerEntry records are immutable financial documents and cannot be edited.');
    error.statusCode = 403;
    throw error;
  }
});

const blockSupplierLedgerMutation = function () {
  const error = new Error('SupplierLedgerEntry records cannot be updated or deleted directly. Neutralize errors through authorized reversals.');
  error.statusCode = 403;
  throw error;
};

supplierLedgerEntrySchema.pre('updateOne', function () {
  const update = this.getUpdate();
  if (update && (update.$set?.isReversed !== undefined || update.$set?.reversedByEntryId !== undefined)) {
    return;
  }
  blockSupplierLedgerMutation();
});

supplierLedgerEntrySchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate();
  if (update && (update.$set?.isReversed !== undefined || update.$set?.reversedByEntryId !== undefined)) {
    return;
  }
  blockSupplierLedgerMutation();
});

supplierLedgerEntrySchema.pre('updateMany', blockSupplierLedgerMutation);
supplierLedgerEntrySchema.pre('deleteOne', blockSupplierLedgerMutation);
supplierLedgerEntrySchema.pre('deleteMany', blockSupplierLedgerMutation);
supplierLedgerEntrySchema.pre('findOneAndDelete', blockSupplierLedgerMutation);

export const SupplierLedgerEntry =
  mongoose.models.SupplierLedgerEntry ||
  mongoose.model('SupplierLedgerEntry', supplierLedgerEntrySchema);
