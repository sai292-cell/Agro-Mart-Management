import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * AuditLog Model
 * Records security-sensitive and business-critical operations.
 * NOTE: Passwords, tokens, database URIs and payment PINs must NEVER be passed to metadata.
 * Logs are immutable and append-only.
 */
const auditLogSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID is required'],
      index: true,
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      trim: true,
      uppercase: true,
      maxlength: [100, 'Action cannot exceed 100 characters'],
      index: true,
    },
    entityType: {
      type: String,
      required: [true, 'Entity type is required'],
      trim: true,
      uppercase: true,
      maxlength: [50, 'Entity type cannot exceed 50 characters'],
      index: true,
    },
    entityId: {
      type: String,
      required: [true, 'Entity ID is required'],
      trim: true,
      maxlength: [100, 'Entity ID cannot exceed 100 characters'],
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [255, 'Reason cannot exceed 255 characters'],
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: false, // Explicit timestamp field used
    strict: true,
  }
);

// Indexes for chronological audit trail inspection
auditLogSchema.index({ shopId: 1, timestamp: -1 });
auditLogSchema.index({ shopId: 1, entityType: 1, entityId: 1 });

// Immutability safeguards: Prevent modification or deletion of audit logs
const blockMutation = function (next) {
  const error = new Error('AuditLog entries are permanent legal audit records and cannot be altered or deleted.');
  error.statusCode = 403;
  next(error);
};

auditLogSchema.pre('updateOne', blockMutation);
auditLogSchema.pre('updateMany', blockMutation);
auditLogSchema.pre('findOneAndUpdate', blockMutation);
auditLogSchema.pre('deleteOne', blockMutation);
auditLogSchema.pre('deleteMany', blockMutation);
auditLogSchema.pre('findOneAndDelete', blockMutation);

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
