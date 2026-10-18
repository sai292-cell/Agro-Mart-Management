import React, { useState } from 'react';
import { X, RotateCcw, AlertTriangle, ShieldAlert } from 'lucide-react';
import Button from '../common/Button';
import { reverseCustomerLedgerEntryApi } from '../../services/api';

export default function ReverseEntryModal({ entry, onClose, onSuccess }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatCurrency = (paise) => '₹' + ((Number(paise) || 0) / 100).toFixed(2);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!reason || reason.trim().length < 5) {
      setError('A mandatory reason (minimum 5 characters) is required for audit trails.');
      return;
    }

    setLoading(true);
    try {
      const res = await reverseCustomerLedgerEntryApi(entry._id, { reason: reason.trim() });
      onSuccess(res);
    } catch (err) {
      setError(err.message || 'Failed to reverse entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-rose-200">
        <div className="flex items-center justify-between px-6 py-4 bg-rose-50 border-b border-rose-200">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-rose-600" />
            <h2 className="text-base font-bold text-rose-900">
              Reverse Ledger Entry / नोंद उलटवा
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {error}
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Entry Type:</span>
              <span className="font-semibold text-slate-800">{entry.entryType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Nature:</span>
              <span className={`font-bold ${entry.transactionType === 'DEBIT' ? 'text-rose-600' : 'text-emerald-700'}`}>
                {entry.transactionType === 'DEBIT' ? 'नावे (DEBIT)' : 'जमा (CREDIT)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Amount:</span>
              <span className="font-mono font-bold text-slate-900">{formatCurrency(entry.amountPaise)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Description:</span>
              <span className="text-slate-700">{entry.description}</span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              This will create an exact opposite counter-entry ({entry.transactionType === 'DEBIT' ? 'CREDIT' : 'DEBIT'}) to restore the balance. The original entry is preserved for audit compliance.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mandatory Reversal Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Erroneous adjustment entered, check bounced or cancelled"
              required
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">Minimum 5 characters.</p>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              type="submit"
              disabled={loading}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {loading ? 'Reversing...' : 'Confirm Reversal / उलटवा'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
