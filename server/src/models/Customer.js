import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Customer Model
 * NOTE ON DATA INTEGRITY:
 * Customer balance is NOT stored directly as a single mutable field here.
 * As defined in ARCHITECTURE.md, the authoritative credit/debit balance will be
 * calculated and audited via the immutable financial ledger (Phase 6).
 */
const customerSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: [100, 'Customer name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone cannot exceed 20 characters'],
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^[0-9+\-\s]{7,20}$/.test(v);
        },
        message: 'Invalid customer phone number',
      },
    },
    village: {
      type: String,
      trim: true,
      maxlength: [100, 'Village cannot exceed 100 characters'],
      default: '',
    },
    taluka: {
      type: String,
      trim: true,
      maxlength: [100, 'Taluka cannot exceed 100 characters'],
      default: '',
    },
    district: {
      type: String,
      trim: true,
      maxlength: [100, 'District cannot exceed 100 characters'],
      default: '',
    },
    preferredLanguage: {
      type: String,
      enum: {
        values: ['mr', 'en'],
        message: '{VALUE} is not supported. Use "mr" or "en"',
      },
      default: 'mr',
    },
    creditLimitPaise: {
      type: Number,
      required: [true, 'Credit limit in paise is required'],
      default: 0,
      min: [0, 'Credit limit cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Credit limit must be a whole integer in paise (e.g., ₹50,000 = 5000000 paise)',
      },
    },
    linkedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
    },
    lastPaymentDate: {
      type: Date,
      default: null,
    },
    creditStatus: {
      type: String,
      enum: ['ACTIVE', 'OVERDUE', 'BLOCKED'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// Indexes for common queries
customerSchema.index({ shopId: 1, phone: 1 });
customerSchema.index({ shopId: 1, village: 1 });
customerSchema.index({ shopId: 1, name: 1 });

export const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);
