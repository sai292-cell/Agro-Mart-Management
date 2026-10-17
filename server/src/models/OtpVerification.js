import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * OtpVerification Model
 * Secure short-lived OTP sessions for customer phone verification.
 * Hashed OTP ensures plaintext pins are never exposed in DB.
 * TTL index expires documents after 5 minutes.
 */
const otpVerificationSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0, // MongoDB TTL index (expires automatically)
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

otpVerificationSchema.index({ phone: 1, shopId: 1 });

export const OtpVerification =
  mongoose.models.OtpVerification || mongoose.model('OtpVerification', otpVerificationSchema);
