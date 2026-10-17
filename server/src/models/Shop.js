import mongoose from 'mongoose';

const { Schema } = mongoose;

const shopSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Shop name is required'],
      trim: true,
      maxlength: [100, 'Shop name cannot exceed 100 characters'],
      default: 'Shivshree Agro Mart',
    },
    displayName: {
      type: String,
      required: [true, 'Shop display name is required'],
      trim: true,
      maxlength: [100, 'Display name cannot exceed 100 characters'],
      default: 'Shivshree Agro Mart',
    },
    address: {
      type: String,
      trim: true,
      maxlength: [255, 'Address cannot exceed 255 characters'],
      default: '',
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
    state: {
      type: String,
      trim: true,
      maxlength: [100, 'State cannot exceed 100 characters'],
      default: 'Maharashtra',
    },
    country: {
      type: String,
      trim: true,
      maxlength: [100, 'Country cannot exceed 100 characters'],
      default: 'India',
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone cannot exceed 20 characters'],
      default: '',
    },
    preferredLanguage: {
      type: String,
      enum: {
        values: ['mr', 'en'],
        message: '{VALUE} is not a supported language. Choose "mr" or "en".',
      },
      default: 'mr',
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

export const Shop = mongoose.models.Shop || mongoose.model('Shop', shopSchema);
