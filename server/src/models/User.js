import mongoose from 'mongoose';

const { Schema } = mongoose;

export const USER_ROLES = ['OWNER', 'MANAGER', 'CASHIER', 'CUSTOMER'];

const userSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID is required for multi-tenant tenancy'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [120, 'Email cannot exceed 120 characters'],
      validate: {
        validator: function (v) {
          if (!v) return true; // Optional
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Invalid email format',
      },
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone cannot exceed 20 characters'],
      validate: {
        validator: function (v) {
          if (!v) return true; // Optional
          return /^[0-9+\-\s]{7,20}$/.test(v);
        },
        message: 'Invalid phone number format',
      },
    },
    farmerId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [50, 'Farmer ID cannot exceed 50 characters'],
    },
    passwordHash: {
      type: String,
      select: false, // Never return password hash in regular queries
      maxlength: [255, 'Password hash cannot exceed 255 characters'],
    },
    externalAuthProviderId: {
      type: String,
      trim: true,
      maxlength: [120, 'External provider ID cannot exceed 120 characters'],
    },
    role: {
      type: String,
      enum: {
        values: USER_ROLES,
        message: '{VALUE} is not a valid user role. Allowed: OWNER, MANAGER, CASHIER, CUSTOMER',
      },
      default: 'CUSTOMER',
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// Compound unique indexes with partialFilterExpression to safely allow optional unique values
userSchema.index(
  { shopId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: 'string' } },
  }
);

userSchema.index(
  { shopId: 1, phone: 1 },
  {
    unique: true,
    partialFilterExpression: { phone: { $type: 'string' } },
  }
);

userSchema.index(
  { farmerId: 1 },
  {
    unique: true,
    partialFilterExpression: { farmerId: { $type: 'string' } },
  }
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);
