import mongoose from 'mongoose';

const { Schema } = mongoose;

export const LEDGER_ENTRY_TYPES = [
  'OPENING_BALANCE',
  'CREDIT_SALE',
  'PAYMENT_RECEIVED',
  'SALE_RETURN',
  'CREDIT_NOTE',
  'ADJUSTMENT',
  'REVERSAL',
];

export const TRANSACTION_TYPES = ['DEBIT', 'CREDIT'];

export const REFERENCE_TYPES = [
  'INVOICE',
  'PAYMENT',
  'ADJUSTMENT',
  'OPENING_BALANCE',
  'REVERSAL',
  'OTHER',
];

/**
 * CustomerLedgerEntry Model
 * Immutable financial ledger tracking all credit transactions for farmers.
 *
 * ACCOUNTING CONVENTION:
 * - DEBIT: Increases the amount owed by the farmer to the shop (नावे - खरेदी/समायोजन).
 * - CREDIT: Decreases the amount owed by the farmer to the shop (जमा - रोख/UPI पावती/सूट).
 * - Net Balance = Sum(DEBIT) - Sum(CREDIT).
 *   - Net Balance > 0: Farmer owes money (उधारी बाकी).
 *   - Net Balance = 0: Fully settled (हिशोब पूर्ण).
 *   - Net Balance < 0: Advance credit held by farmer (अगाऊ जमा).
 */
const customerLedgerEntrySchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID is required'],
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer ID is required'],
      index: true,
    },
    entryType: {
      type: String,
      enum: {
        values: LEDGER_ENTRY_TYPES,
        message: '{VALUE} is not a valid ledger entry type',
      },
      required: [true, 'Ledger entry type is required'],
      index: true,
    },
    transactionType: {
      type: String,
      enum: {
        values: TRANSACTION_TYPES,
        message: '{VALUE} is not a valid transaction type (Allowed: DEBIT, CREDIT)',
      },
      required: [true, 'Transaction type is required'],
      index: true,
    },
    amountPaise: {
      type: Number,
      required: [true, 'Amount in paise is required'],
      min: [1, 'Ledger transaction amount must be greater than zero'],
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
      enum: REFERENCE_TYPES,
      default: 'OTHER',
      required: true,
    },
    referenceId: {
      type: String,
      trim: true,
      maxlength: [100, 'Reference identifier cannot exceed 100 characters'],
      default: '',
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
      index: true,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
      index: true,
    },
    originalEntryId: {
      type: Schema.Types.ObjectId,
      ref: 'CustomerLedgerEntry',
      default: null,
      index: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    description: {
      type: String,
      required: [true, 'Ledger description is required'],
      trim: true,
      maxlength: [255, 'Description cannot exceed 255 characters'],
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User recording ledger entry is required'],
      index: true,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    isReversed: {
      type: Boolean,
      default: false,
      index: true,
    },
    reversalReason: {
      type: String,
      trim: true,
      maxlength: 255,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// Immutability: Prevent direct edits or deletions of finalized financial ledger records
customerLedgerEntrySchema.pre(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'findByIdAndUpdate'],
  function (next) {
    const update = this.getUpdate();
    // Allow flagging isReversed and reversalReason only
    const updateKeys = Object.keys(update?.$set || update || {});
    const allowedKeys = ['isReversed', 'reversalReason', 'notes'];
    const isOnlyAllowed = updateKeys.every((k) => allowedKeys.includes(k));

    if (!isOnlyAllowed) {
      return next(
        new Error(
          'IMMUTABLE_LEDGER_ERROR: CustomerLedgerEntry records cannot be modified directly. Use authorized reversal entries.'
        )
      );
    }
    next();
  }
);

customerLedgerEntrySchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete', 'findByIdAndDelete'], function (next) {
  return next(
    new Error(
      'IMMUTABLE_LEDGER_ERROR: CustomerLedgerEntry records cannot be deleted. Use authorized reversal entries.'
    )
  );
});

// Indexes for fast passbook and statement lookups
customerLedgerEntrySchema.index({ shopId: 1, customerId: 1, createdAt: 1 });
customerLedgerEntrySchema.index({ shopId: 1, customerId: 1, createdAt: -1 });
customerLedgerEntrySchema.index({ shopId: 1, invoiceId: 1 });
customerLedgerEntrySchema.index({ shopId: 1, paymentId: 1 });

// Partial unique index for idempotency keys per shop
customerLedgerEntrySchema.index(
  { shopId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

export const CustomerLedgerEntry =
  mongoose.models.CustomerLedgerEntry ||
  mongoose.model('CustomerLedgerEntry', customerLedgerEntrySchema);
