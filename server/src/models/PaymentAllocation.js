import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * PaymentAllocation Model
 * Tracks precise allocation of a payment across one or more invoices.
 */
const paymentAllocationSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID is required'],
      index: true,
    },
    targetType: {
      type: String,
      enum: ['INVOICE', 'PURCHASE'],
      default: 'INVOICE',
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
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
      required: [true, 'Payment ID is required'],
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
    allocatedAmountPaise: {
      type: Number,
      required: [true, 'Allocated amount in paise is required'],
      min: [1, 'Allocated amount must be at least 1 paise'],
      validate: {
        validator: Number.isInteger,
        message: 'Allocated amount must be an integer in paise',
      },
    },
    allocatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Staff member allocating payment is required'],
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

paymentAllocationSchema.index({ shopId: 1, invoiceId: 1 });
paymentAllocationSchema.index({ shopId: 1, purchaseId: 1 });
paymentAllocationSchema.index({ shopId: 1, paymentId: 1 });
paymentAllocationSchema.index({ shopId: 1, customerId: 1, createdAt: -1 });
paymentAllocationSchema.index({ shopId: 1, supplierId: 1, createdAt: -1 });

export const PaymentAllocation =
  mongoose.models.PaymentAllocation ||
  mongoose.model('PaymentAllocation', paymentAllocationSchema);
