import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, BookOpen } from 'lucide-react';
import { recordSupplierOpeningBalanceApi } from '../../services/api';

export default function SupplierOpeningBalanceModal({ isOpen, onClose, supplier, onRecorded }) {
  const { t } = useTranslation();

  const [balanceType, setBalanceType] = useState('PAYABLE_CREDIT');
  const [amountRupees, setAmountRupees] = useState('');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [referenceId, setReferenceId] = useState('LEGACY_KHATA_2026');
  const [reason, setReason] = useState('Paper register opening balance migration');
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
      setError('A mandatory reason (minimum 5 characters) is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await recordSupplierOpeningBalanceApi(supplier._id, {
        balanceType,
        amountPaise,
        asOfDate,
        referenceId: referenceId.trim(),
        reason: reason.trim(),
        notes: notes.trim(),
      });

      onRecorded();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record opening balance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Opening Balance Migration (आरंभीची बाकी नोंद)
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
                Nature of Opening Balance (आरंभीची शिल्लक स्वरूप) *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setBalanceType('PAYABLE_CREDIT')}
                  className={`flex flex-col items-center justify-center rounded-xl border p-3 text-left transition ${
                    balanceType === 'PAYABLE_CREDIT'
                      ? 'border-red-600 bg-red-50/50 text-red-900 ring-2 ring-red-600'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="text-sm font-bold">Payable (देय बाकी)</span>
                  <span className="text-[11px] text-gray-500">Shop owes supplier (CREDIT)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBalanceType('ADVANCE_DEBIT')}
                  className={`flex flex-col items-center justify-center rounded-xl border p-3 text-left transition ${
                    balanceType === 'ADVANCE_DEBIT'
                      ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900 ring-2 ring-emerald-600'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="text-sm font-bold">Advance (अगाऊ जमा)</span>
                  <span className="text-[11px] text-gray-500">Shop has advance credit (DEBIT)</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  Opening Balance Amount (रक्कम ₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-900 focus:border-blue-600 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  As of Date (तारीख)
                </label>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Legacy Reference / Page #
              </label>
              <input
                type="text"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                placeholder="e.g. Khata Book #2, Page #45"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Mandatory Migration Reason (कारण) *
              </label>
              <input
                type="text"
                required
                minLength={5}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">Notes</label>
              <textarea
                rows="2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Verified by shop accountant..."
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-hidden"
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
              className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Recording...' : 'Record Opening Balance (आरंभीची नोंद करा)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
