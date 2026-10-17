import mongoose from 'mongoose';

const { Schema } = mongoose;

const categorySchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID is required'],
      index: true,
    },
    nameEn: {
      type: String,
      required: [true, 'Category English name is required'],
      trim: true,
      maxlength: [100, 'English name cannot exceed 100 characters'],
    },
    nameMr: {
      type: String,
      required: [true, 'Category Marathi name is required'],
      trim: true,
      maxlength: [100, 'Marathi name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Category slug is required'],
      trim: true,
      lowercase: true,
      maxlength: [120, 'Slug cannot exceed 120 characters'],
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
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

// Enforce unique category slugs per shop
categorySchema.index({ shopId: 1, slug: 1 }, { unique: true });
categorySchema.index({ shopId: 1, parentId: 1 });

export const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);
