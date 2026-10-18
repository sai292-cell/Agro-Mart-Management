import mongoose from 'mongoose';

const { Schema } = mongoose;

export const PAYMENT_METHODS = ['CASH', 'UPI', 'CREDIT', 'BANK_TRANSFER', 'CHEQUE'];
export const PAYMENT_TRANSACTION_STATUSES = ['VERIFIED', 'CANCELLED'];
export const PAYMENT_DIRECTIONS = ['INFLOW', 'OUTFLOW'];

/**
 * Payment Model
 * Authoritative point-in-time record of all payments received from customers or made to suppliers.
 */
const paymentSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID is required'],
      index: true,
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
      index: true,
    },
    purchaseId: {
      type: Schema.Types.ObjectId,
      ref: 'Purchase',
      default: null,
      index: true,
    },
    paymentType: {
      type: String,
      enum: ['INVOICE_PAYMENT', 'ACCOUNT_PAYMENT', 'ADVANCE', 'PURCHASE_PAYMENT', 'SUPPLIER_PAYMENT'],
      default: 'INVOICE_PAYMENT',
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: PAYMENT_DIRECTIONS,
      default: 'INFLOW',
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null,
      index: true,
    },
    amountPaise: {
      type: Number,
      required: [true, 'Payment amount in paise is required'],
      min: [1, 'Payment amount must be greater than zero'],
      validate: {
        validator: Number.isInteger,
        message: 'Payment amount must be an integer in paise',
      },
    },
    paymentMethod: {
      type: String,
      enum: {
        values: PAYMENT_METHODS,
        message: '{VALUE} is not a valid payment method. Allowed: CASH, UPI, CREDIT, BANK_TRANSFER, CHEQUE',
      },
      required: [true, 'Payment method is required'],
    },
    referenceId: {
      type: String,
      trim: true,
      maxlength: [100, 'Payment reference cannot exceed 100 characters'],
      default: '',
    },
    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Staff member receiving payment is required'],
      index: true,
    },
    status: {
      type: String,
      enum: PAYMENT_TRANSACTION_STATUSES,
      default: 'VERIFIED',
      required: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 255,
      default: '',
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// Unique idempotency key per shop to prevent double payment registration
paymentSchema.index(
  { shopId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

paymentSchema.index({ shopId: 1, invoiceId: 1, createdAt: -1 });
paymentSchema.index({ shopId: 1, customerId: 1, createdAt: -1 });
paymentSchema.index({ shopId: 1, supplierId: 1, createdAt: -1 });
paymentSchema.index({ shopId: 1, purchaseId: 1, createdAt: -1 });

export const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
