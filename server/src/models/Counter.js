import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Counter Model
 * Provides atomic, race-condition-free sequential numbering for invoices and audit entities.
 */
const counterSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID is required'],
      index: true,
    },
    sequenceName: {
      type: String,
      required: [true, 'Sequence name is required'],
      trim: true,
      maxlength: 50,
    },
    currentSeq: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// Enforce unique sequence name per shop
counterSchema.index({ shopId: 1, sequenceName: 1 }, { unique: true });

/**
 * Atomically increments and retrieves the next sequence value for a given sequence name and shop.
 * @param {mongoose.Types.ObjectId|string} shopId
 * @param {string} sequenceName
 * @param {mongoose.ClientSession|null} [session]
 * @returns {Promise<number>} Next sequential integer
 */
counterSchema.statics.getNextSequence = async function (shopId, sequenceName, session = null) {
  const options = {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  };
  if (session) {
    options.session = session;
  }

  const counter = await this.findOneAndUpdate(
    { shopId, sequenceName },
    { $inc: { currentSeq: 1 } },
    options
  );

  return counter.currentSeq;
};

export const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);
