import React, { useState } from 'react';
import { X, AlertTriangle, ShieldAlert } from 'lucide-react';
import Button from '../common/Button';
import { cancelInvoiceApi } from '../../services/api';

export default function CancelInvoiceModal({ invoice, onClose, onSuccess }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatCurrency = (paise) => '₹' + ((Number(paise) || 0) / 100).toFixed(2);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!reason || reason.trim().length < 5) {
      setError('A comprehensive cancellation reason (minimum 5 characters) is required for statutory audit.');
      return;
    }

    setLoading(true);
    try {
      const res = await cancelInvoiceApi(invoice._id, { reason: reason.trim() });
      onSuccess(res.invoice);
    } catch (err) {
      setError(err.message || 'Failed to cancel invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-rose-200">
        <div className="flex items-center justify-between px-6 py-4 bg-rose-50 border-b border-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <h2 className="text-base font-bold text-rose-900">
              Cancel Invoice / बिल रद्द करा
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

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
            <p className="font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
              Stock Reversal Warning:
            </p>
            <p className="mt-1 leading-relaxed">
              Cancelling invoice <strong className="font-mono">{invoice.invoiceNumber}</strong> ({formatCurrency(invoice.grandTotalPaise)}) will automatically create traceable <strong>RETURN_INWARD</strong> stock ledger entries and restore batch quantities.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mandatory Reason for Cancellation <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer cancelled order at counter, wrong pesticide item billed"
              required
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">Minimum 5 characters. Recorded in shop audit logs.</p>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Cancel Action
            </Button>
            <Button
              variant="danger"
              size="sm"
              type="submit"
              disabled={loading}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {loading ? 'Reversing...' : 'Confirm & Reverse Stock'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
