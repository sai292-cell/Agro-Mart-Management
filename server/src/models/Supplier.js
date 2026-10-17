import mongoose from 'mongoose';

const { Schema } = mongoose;

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
    address: {
      type: String,
      trim: true,
      maxlength: [255, 'Address cannot exceed 255 characters'],
      default: '',
    },
    taxDetails: {
      gstin: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: [20, 'GSTIN cannot exceed 20 characters'],
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

export const Supplier = mongoose.models.Supplier || mongoose.model('Supplier', supplierSchema);
