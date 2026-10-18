import mongoose from 'mongoose';

const { Schema } = mongoose;

export const EXPENSE_CATEGORIES = [
  'RENT',
  'ELECTRICITY',
  'WATER',
  'INTERNET_PHONE',
  'SALARIES_WAGES',
  'TRANSPORT_FUEL',
  'MAINTENANCE',
  'STATIONERY_PACKAGING',
  'BANK_CHARGES',
  'TEA_REFRESHMENT',
  'MISCELLANEOUS',
];

export const EXPENSE_PAYMENT_MODES = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'];

export const EXPENSE_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'REVERSED',
];

/**
 * Expense Model
 * Tracks store operating expenditures with integer paise, approvals, and immutable audit logs.
 */
const expenseSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID is required'],
      index: true,
    },
    expenseNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    amountPaise: {
      type: Number,
      required: [true, 'Expense amount in paise is required'],
      min: [1, 'Expense amount must be greater than zero'],
      validate: {
        validator: Number.isInteger,
        message: 'Expense amount must be an integer in paise (e.g. ₹500.00 = 50000 paise)',
      },
    },
    expenseDate: {
      type: Date,
      required: [true, 'Expense date is required'],
      default: Date.now,
      index: true,
    },
    category: {
      type: String,
      enum: {
        values: EXPENSE_CATEGORIES,
        message: '{VALUE} is not a valid operating expense category',
      },
      required: [true, 'Expense category is required'],
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Expense description is required'],
      trim: true,
      minlength: [3, 'Description must be at least 3 characters'],
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    paymentMode: {
      type: String,
      enum: {
        values: EXPENSE_PAYMENT_MODES,
        message: '{VALUE} is not a valid expense payment mode',
      },
      required: [true, 'Payment mode is required'],
      index: true,
    },
    referenceNumber: {
      type: String,
      trim: true,
      maxlength: [100, 'Reference number cannot exceed 100 characters'],
      default: '',
    },
    payee: {
      type: String,
      required: [true, 'Payee / recipient name is required'],
      trim: true,
      minlength: [2, 'Payee must be at least 2 characters'],
      maxlength: [120, 'Payee cannot exceed 120 characters'],
    },
    receiptDocumentRef: {
      type: String,
      trim: true,
      maxlength: [255, 'Document reference cannot exceed 255 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: EXPENSE_STATUSES,
        message: '{VALUE} is not a valid expense status',
      },
      default: 'APPROVED',
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User creating expense is required'],
      index: true,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [255, 'Rejection reason cannot exceed 255 characters'],
      default: '',
    },
    isReversed: {
      type: Boolean,
      default: false,
      index: true,
    },
    reversedByExpenseId: {
      type: Schema.Types.ObjectId,
      ref: 'Expense',
      default: null,
    },
    originalExpenseId: {
      type: Schema.Types.ObjectId,
      ref: 'Expense',
      default: null,
    },
    reversalReason: {
      type: String,
      trim: true,
      maxlength: [255, 'Reversal reason cannot exceed 255 characters'],
      default: '',
    },
    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// Indexes
expenseSchema.index({ shopId: 1, expenseNumber: 1 }, { unique: true });
expenseSchema.index(
  { shopId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);
expenseSchema.index({ shopId: 1, expenseDate: -1, status: 1 });
expenseSchema.index({ shopId: 1, category: 1, expenseDate: -1 });

// Append-only immutability safeguards
expenseSchema.pre('save', function () {
  if (!this.isNew && (this.status === 'APPROVED' || this.status === 'REVERSED')) {
    // Only allow marking as reversed or updating reversal linkage
    const modifiedPaths = this.modifiedPaths();
    const allowedModifications = ['isReversed', 'reversedByExpenseId', 'reversalReason', 'updatedAt'];
    const invalidModifications = modifiedPaths.filter((p) => !allowedModifications.includes(p));

    if (invalidModifications.length > 0) {
      const err = new Error(
        `Financial integrity violation: Cannot modify posted/approved expense ${this.expenseNumber}. Use reversal counter-entries.`
      );
      err.code = 'EXPENSE_IMMUTABLE';
      throw err;
    }
  }
});

expenseSchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate() || {};
  const setOps = update.$set || update;
  // If updating financial fields directly on an existing document, throw error
  const forbiddenFields = ['amountPaise', 'category', 'paymentMode', 'shopId', 'expenseNumber'];
  for (const field of forbiddenFields) {
    if (setOps[field] !== undefined) {
      const err = new Error(`Financial integrity violation: Cannot update '${field}' on existing expense record.`);
      err.code = 'EXPENSE_IMMUTABLE';
      throw err;
    }
  }
});

expenseSchema.pre('deleteOne', function () {
  const err = new Error('Financial integrity violation: Deleting expense records is strictly forbidden. Use reversal.');
  err.code = 'EXPENSE_DELETE_FORBIDDEN';
  throw err;
});

export const Expense = mongoose.models.Expense || mongoose.model('Expense', expenseSchema);
