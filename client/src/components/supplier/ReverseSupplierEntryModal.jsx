import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, RotateCcw, AlertTriangle } from 'lucide-react';
import { reverseSupplierEntryApi } from '../../services/api';

export default function ReverseSupplierEntryModal({ isOpen, onClose, supplier, entry, onReversed }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !supplier || !entry) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 5) {
      setError('A mandatory reason (minimum 5 characters) is required for audit reversals');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await reverseSupplierEntryApi(supplier._id, entry._id, {
        reason: reason.trim(),
      });

      onReversed();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to reverse ledger entry');
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
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Reverse Ledger Entry (नोंद उलटवा)
              </h2>
              <p className="text-xs text-gray-500">{supplier.name}</p>
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

          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Immutable Ledger Correction Notice</span>
            </div>
            <p className="mt-1 text-[11px] text-amber-800">
              Financial ledger entries are never deleted. An authorized counter-entry of opposite sign
              will be created, neutralizing the original transaction while keeping the audit trail fully intact.
            </p>
          </div>

          <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs">
            <div className="font-semibold text-gray-900">{entry.description}</div>
            <div className="mt-1 flex justify-between text-gray-600">
              <span>Type: {entry.entryType} ({entry.transactionType})</span>
              <span className="font-bold text-gray-900">₹{(entry.amountPaise / 100).toFixed(2)}</span>
            </div>
            <div className="mt-1 text-[11px] text-gray-400">Date: {new Date(entry.createdAt).toLocaleDateString()}</div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Mandatory Reversal Reason (उलटवण्याचे कारण - किमान ५ अक्षरे) *
              </label>
              <input
                type="text"
                required
                minLength={5}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Erroneous rate entered / Wrong supplier bill mapped"
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
              {loading ? 'Reversing...' : 'Authorize Reversal (नोंद उलटवा)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
