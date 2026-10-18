import mongoose from 'mongoose';

const { Schema } = mongoose;

export const SUPPLIER_TYPES = ['MANUFACTURER', 'DISTRIBUTOR', 'WHOLESALER', 'OTHER'];

const supplierSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
      maxlength: [100, 'Supplier name cannot exceed 100 characters'],
    },
    contactPerson: {
      type: String,
      trim: true,
      maxlength: [100, 'Contact person name cannot exceed 100 characters'],
      default: '',
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
        message: 'Invalid supplier phone number',
      },
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [100, 'Email cannot exceed 100 characters'],
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Invalid email address',
      },
      default: '',
    },
    address: {
      type: String,
      trim: true,
      maxlength: [255, 'Address cannot exceed 255 characters'],
      default: '',
    },
    villageCity: {
      type: String,
      trim: true,
      maxlength: [100, 'City/village cannot exceed 100 characters'],
      default: '',
    },
    district: {
      type: String,
      trim: true,
      maxlength: [100, 'District cannot exceed 100 characters'],
      default: 'Nashik',
    },
    state: {
      type: String,
      trim: true,
      maxlength: [100, 'State cannot exceed 100 characters'],
      default: 'Maharashtra',
    },
    pincode: {
      type: String,
      trim: true,
      maxlength: [10, 'Pincode cannot exceed 10 characters'],
      default: '',
    },
    supplierType: {
      type: String,
      enum: {
        values: SUPPLIER_TYPES,
        message: '{VALUE} is not a valid supplier type. Allowed: MANUFACTURER, DISTRIBUTOR, WHOLESALER, OTHER',
      },
      default: 'DISTRIBUTOR',
    },
    taxDetails: {
      gstin: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: [20, 'GSTIN cannot exceed 20 characters'],
        validate: {
          validator: function (v) {
            if (!v) return true;
            return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v);
          },
          message: 'Invalid GSTIN format (e.g. 27ABCDE1234F1Z5)',
        },
        default: '',
      },
      pan: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: [20, 'PAN cannot exceed 20 characters'],
        default: '',
      },
    },
    paymentTermsDays: {
      type: Number,
      default: 30,
      min: [0, 'Payment terms days cannot be negative'],
    },
    creditLimitPaise: {
      type: Number,
      default: 0,
      min: [0, 'Credit limit cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Credit limit must be a whole integer in paise',
      },
    },
    bankDetails: {
      accountName: { type: String, trim: true, default: '' },
      accountNumber: { type: String, trim: true, default: '' },
      bankName: { type: String, trim: true, default: '' },
      ifscCode: { type: String, trim: true, uppercase: true, default: '' },
      branch: { type: String, trim: true, default: '' },
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: '',
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

supplierSchema.index({ shopId: 1, name: 1 });
supplierSchema.index({ shopId: 1, phone: 1 });
supplierSchema.index({ shopId: 1, 'taxDetails.gstin': 1 });

export const Supplier = mongoose.models.Supplier || mongoose.model('Supplier', supplierSchema);
