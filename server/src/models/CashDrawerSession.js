import mongoose from 'mongoose';

const { Schema } = mongoose;

export const SESSION_STATUSES = ['OPEN', 'CLOSED'];

/**
 * CashDrawerSession Model
 * Represents an authorized physical cash drawer operating session.
 * Tracks opening float, recorded inflows/outflows, counted closing cash, and cash variance.
 */
const cashDrawerSessionSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID is required'],
      index: true,
    },
    sessionNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: {
        values: SESSION_STATUSES,
        message: '{VALUE} is not a valid cash drawer session status',
      },
      default: 'OPEN',
      required: true,
      index: true,
    },
    openedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User opening the session is required'],
      index: true,
    },
    openedAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    openingCashPaise: {
      type: Number,
      required: [true, 'Opening cash amount in paise is required'],
      min: [0, 'Opening cash cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Opening cash must be an integer in paise (e.g. ₹2000.00 = 200000 paise)',
      },
    },
    openingNotes: {
      type: String,
      trim: true,
      maxlength: [255, 'Opening notes cannot exceed 255 characters'],
      default: '',
    },
    closedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    closingCashCountedPaise: {
      type: Number,
      default: null,
      validate: {
        validator: function (v) {
          return v === null || (Number.isInteger(v) && v >= 0);
        },
        message: 'Counted closing cash must be a non-negative integer in paise',
      },
    },
    expectedCashPaise: {
      type: Number,
      default: null,
      validate: {
        validator: function (v) {
          return v === null || Number.isInteger(v);
        },
        message: 'Expected cash must be an integer in paise',
      },
    },
    variancePaise: {
      type: Number,
      default: null,
      validate: {
        validator: function (v) {
          return v === null || Number.isInteger(v);
        },
        message: 'Cash variance must be an integer in paise',
      },
    },
    closingNotes: {
      type: String,
      trim: true,
      maxlength: [500, 'Closing notes cannot exceed 500 characters'],
      default: '',
    },
    breakdown: {
      cashSalesPaise: { type: Number, default: 0 },
      cashCreditCollectionsPaise: { type: Number, default: 0 },
      cashSupplierPaymentsPaise: { type: Number, default: 0 },
      cashExpensesPaise: { type: Number, default: 0 },
      cashRefundsPaise: { type: Number, default: 0 },
      upiSalesPaise: { type: Number, default: 0 },
      bankSalesPaise: { type: Number, default: 0 },
      upiCollectionsPaise: { type: Number, default: 0 },
      bankCollectionsPaise: { type: Number, default: 0 },
      upiSupplierPaymentsPaise: { type: Number, default: 0 },
      bankSupplierPaymentsPaise: { type: Number, default: 0 },
      upiExpensesPaise: { type: Number, default: 0 },
      bankExpensesPaise: { type: Number, default: 0 },
      creditSalesPaise: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// Indexes
cashDrawerSessionSchema.index({ shopId: 1, sessionNumber: 1 }, { unique: true });
// Guarantee at most ONE open drawer session per shop
cashDrawerSessionSchema.index(
  { shopId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'OPEN' } }
);
cashDrawerSessionSchema.index({ shopId: 1, openedAt: -1 });

export const CashDrawerSession =
  mongoose.models.CashDrawerSession || mongoose.model('CashDrawerSession', cashDrawerSessionSchema);
