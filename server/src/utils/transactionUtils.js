import mongoose from 'mongoose';

/**
 * Executes an operation inside a MongoDB transaction if replica set transactions are supported.
 * For non-critical writes, falls back safely to non-transactional execution in standalone or unsupported environments.
 * If options.requireTransaction is true (e.g. for finalized POS sales requiring multi-document atomicity),
 * it strictly refuses to execute unsafe partial writes and fails safely with a clear operational message.
 * 
 * @param {Function} operation - async (session) => { ... }
 * @param {Object} [options]
 * @param {boolean} [options.requireTransaction=false] - If true, refuses partial writes when transactions unsupported
 * @returns {Promise<any>}
 */
export async function withTransaction(operation, options = {}) {
  const { requireTransaction = false } = options;
  let session = null;

  try {
    session = await mongoose.startSession();
  } catch (err) {
    if (requireTransaction) {
      const error = new Error('Atomic transaction support is required to finalize sales and deduct inventory safely without risk of partial writes.');
      error.code = 'TRANSACTION_REQUIRED';
      error.statusCode = 503;
      throw error;
    }
    // Session creation failed (e.g. standalone Mongo without session support)
    return await operation(null);
  }

  try {
    session.startTransaction();
    const result = await operation(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    const isUnsupported =
      error?.message?.includes('Transactions are not supported') ||
      error?.message?.includes('replica set') ||
      error?.message?.includes('standalone') ||
      error?.codeName === 'TransactionNotSupported' ||
      error?.code === 20;

    if (session && session.inTransaction()) {
      try {
        await session.abortTransaction();
      } catch (_) {
        // Ignore abort errors
      }
    }

    if (isUnsupported) {
      if (requireTransaction) {
        const txError = new Error('Atomic transaction support is required to finalize sales and deduct inventory safely without risk of partial writes.');
        txError.code = 'TRANSACTION_REQUIRED';
        txError.statusCode = 503;
        throw txError;
      }
      // Fall back cleanly to running without transaction for non-critical writes
      return await operation(null);
    }

    throw error;
  } finally {
    if (session) {
      try {
        await session.endSession();
      } catch (_) {
        // Ignore session end errors
      }
    }
  }
}
