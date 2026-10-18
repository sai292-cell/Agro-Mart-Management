import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Ban, AlertTriangle } from 'lucide-react';
import { cancelPurchaseApi } from '../../services/api';

export default function CancelPurchaseModal({ isOpen, onClose, purchase, onCancelled }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !purchase) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 5) {
      setError('A mandatory cancellation reason (minimum 5 characters) is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await cancelPurchaseApi(purchase._id, {
        reason: reason.trim(),
      });

      onCancelled();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to cancel purchase');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-700">
              <Ban className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Cancel Purchase Bill (खरेदी बिल रद्द करा)
              </h2>
              <p className="text-xs text-gray-500">{purchase.purchaseNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {purchase.status === 'RECEIVED' && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                <span>Stock & Accounting Reversal Warning</span>
              </div>
              <p className="mt-1 text-[11px] text-red-800">
                Cancelling this received bill will atomically deduct the inward stock via
                RETURN_OUTWARD movements and neutralize the payable balance in the supplier ledger.
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Mandatory Cancellation Reason (रद्द करण्याचे कारण - किमान ५ अक्षरे) *
              </label>
              <input
                type="text"
                required
                minLength={5}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Inward bill entered twice / Duplicate delivery challan"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-red-600 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-red-600 px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Confirm Bill Cancellation (बिल रद्द करा)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
