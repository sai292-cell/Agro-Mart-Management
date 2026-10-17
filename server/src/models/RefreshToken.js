import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * RefreshToken Model
 * Tracks valid refresh sessions for cryptographic rotation and instant logout revocation.
 * Automatically cleaned up by MongoDB TTL index upon expiration.
 */
const refreshTokenSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0, // MongoDB TTL index automatically deletes expired documents
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

refreshTokenSchema.index({ userId: 1, revokedAt: 1 });

export const RefreshToken =
  mongoose.models.RefreshToken || mongoose.model('RefreshToken', refreshTokenSchema);
