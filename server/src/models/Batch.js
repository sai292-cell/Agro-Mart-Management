import mongoose from 'mongoose';

const { Schema } = mongoose;

export const BATCH_STATUSES = ['ACTIVE', 'QUARANTINED', 'EXPIRED'];

/**
 * Batch Model
 * Represents manufacturer batch with expiry dates for seed, pesticide and chemical tracking.
 * NOTE: As specified in ARCHITECTURE.md, batch quantities are verified and audited via
 * the immutable StockMovement ledger. Expired or quarantined batches are blocked from sales.
 */
const batchSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID is required'],
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true,
    },
    batchNumber: {
      type: String,
      required: [true, 'Batch number is required'],
      trim: true,
      uppercase: true,
      maxlength: [50, 'Batch number cannot exceed 50 characters'],
    },
    manufacturingDate: {
      type: Date,
    },
    expiryDate: {
      type: Date,
      index: true,
    },
    purchaseCostPaisePerBaseUnit: {
      type: Number,
      required: [true, 'Purchase cost per base unit is required in paise'],
      min: [0, 'Purchase cost cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Purchase cost must be a whole integer in paise',
      },
    },
    status: {
      type: String,
      enum: {
        values: BATCH_STATUSES,
        message: '{VALUE} is not a valid batch status. Allowed: ACTIVE, QUARANTINED, EXPIRED',
      },
      default: 'ACTIVE',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// Unique batch number per product within a shop
batchSchema.index({ shopId: 1, productId: 1, batchNumber: 1 }, { unique: true });
// Fast query for expiring batches (e.g. 30/60/90 days FEFO)
batchSchema.index({ shopId: 1, status: 1, expiryDate: 1 });

export const Batch = mongoose.models.Batch || mongoose.model('Batch', batchSchema);
