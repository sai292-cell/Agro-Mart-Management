import mongoose from 'mongoose';

const { Schema } = mongoose;

export const MOVEMENT_TYPES = [
  'INWARD',
  'OUTWARD_SALE',
  'RETURN_INWARD',
  'RETURN_OUTWARD',
  'ADJUSTMENT_ADD',
  'ADJUSTMENT_SUBTRACT',
  'SCRAP',
];

export const REFERENCE_TYPES = [
  'PURCHASE',
  'INVOICE',
  'ADJUSTMENT',
  'INITIAL_STOCK',
  'SCRAP_LOG',
];

/**
 * StockMovement Model
 * Represents the immutable ledger of all physical stock movements.
 * Inventory balances are derived and reconciled from this collection.
 * Records are strictly append-only; update and delete operations are blocked.
 */
const stockMovementSchema = new Schema(
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
    batchId: {
      type: Schema.Types.ObjectId,
      ref: 'Batch',
      default: null,
      index: true,
    },
    movementType: {
      type: String,
      enum: {
        values: MOVEMENT_TYPES,
        message: '{VALUE} is not a valid stock movement type',
      },
      required: [true, 'Movement type is required'],
      index: true,
    },
    quantityBase: {
      type: Number,
      required: [true, 'Quantity in base unit is required'],
      validate: {
        validator: function (v) {
          return typeof v === 'number' && v !== 0;
        },
        message: 'Stock movement quantity must be a non-zero signed number',
      },
    },
    referenceType: {
      type: String,
      enum: {
        values: REFERENCE_TYPES,
        message: '{VALUE} is not a valid reference type',
      },
      required: [true, 'Reference type is required'],
    },
    referenceId: {
      type: String,
      trim: true,
      maxlength: [100, 'Reference ID cannot exceed 100 characters'],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by user reference is required'],
      index: true,
    },
    reason: {
      type: String,
      required: [true, 'Reason or audit note is required for all stock movements'],
      trim: true,
      maxlength: [255, 'Reason cannot exceed 255 characters'],
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// Indexes for ledger reconciliation and product history
stockMovementSchema.index({ shopId: 1, productId: 1, createdAt: -1 });
stockMovementSchema.index({ shopId: 1, batchId: 1, createdAt: -1 });

// Immutability safeguards: Prevent silent edits or deletes of stock movements
const blockMutation = function (next) {
  const error = new Error('StockMovement records are immutable financial audit entries and cannot be updated or deleted.');
  error.statusCode = 403;
  next(error);
};

stockMovementSchema.pre('updateOne', blockMutation);
stockMovementSchema.pre('updateMany', blockMutation);
stockMovementSchema.pre('findOneAndUpdate', blockMutation);
stockMovementSchema.pre('deleteOne', blockMutation);
stockMovementSchema.pre('deleteMany', blockMutation);
stockMovementSchema.pre('findOneAndDelete', blockMutation);

export const StockMovement =
  mongoose.models.StockMovement || mongoose.model('StockMovement', stockMovementSchema);
