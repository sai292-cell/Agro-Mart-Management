import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Scale } from 'lucide-react';
import { recordSupplierAdjustmentApi } from '../../services/api';

export default function SupplierAdjustmentModal({ isOpen, onClose, supplier, onAdjusted }) {
  const { t } = useTranslation();

  const [adjustmentType, setAdjustmentType] = useState('DEBIT');
  const [amountRupees, setAmountRupees] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !supplier) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amountPaise = Math.round(Number(amountRupees || 0) * 100);

    if (!amountPaise || amountPaise <= 0) {
      setError('Please enter a valid amount greater than zero');
      return;
    }

    if (!reason.trim() || reason.trim().length < 5) {
      setError('A mandatory reason (minimum 5 characters) is required for financial adjustments');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await recordSupplierAdjustmentApi(supplier._id, {
        adjustmentType,
        amountPaise,
        reason: reason.trim(),
        notes: notes.trim(),
      });

      onAdjusted();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record adjustment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Supplier Adjustment (समायोजन)
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

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Adjustment Type (समायोजन प्रकार) *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustmentType('DEBIT')}
                  className={`flex flex-col items-center justify-center rounded-xl border p-3 text-left transition ${
                    adjustmentType === 'DEBIT'
                      ? 'border-green-600 bg-green-50/50 text-green-900 ring-2 ring-green-600'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="text-sm font-bold">DEBIT (नावे)</span>
                  <span className="text-[11px] text-gray-500">Decreases amount owed to supplier</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType('CREDIT')}
                  className={`flex flex-col items-center justify-center rounded-xl border p-3 text-left transition ${
                    adjustmentType === 'CREDIT'
                      ? 'border-amber-600 bg-amber-50/50 text-amber-900 ring-2 ring-amber-600'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="text-sm font-bold">CREDIT (जमा)</span>
                  <span className="text-[11px] text-gray-500">Increases amount owed to supplier</span>
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Adjustment Amount (रक्कम ₹) *
              </label>
              <div className="relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm font-semibold text-gray-400">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-gray-200 py-2.5 pr-4 pl-8 text-base font-bold text-gray-900 focus:border-green-600 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Mandatory Reason (कारण - किमान ५ अक्षरे) *
              </label>
              <input
                type="text"
                required
                minLength={5}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Rate difference credit note from company / Annual rebate"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Additional Notes
              </label>
              <textarea
                rows="2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reference letter # / Mail confirmation..."
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-hidden"
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
              className="rounded-xl bg-amber-600 px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Apply Adjustment (समायोजन नोंदवा)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
