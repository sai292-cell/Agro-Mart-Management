import React, { useState } from 'react';
import { X, Sliders, AlertCircle, ShieldAlert } from 'lucide-react';
import Button from '../common/Button';
import { recordCustomerAdjustmentApi } from '../../services/api';

export default function ManualAdjustmentModal({ customer, onClose, onSuccess }) {
  const [adjustmentType, setAdjustmentType] = useState('CREDIT');
  const [amountRupees, setAmountRupees] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const parsedRupees = parseFloat(amountRupees);
    if (isNaN(parsedRupees) || parsedRupees <= 0) {
      setError('Please enter a valid adjustment amount greater than zero.');
      return;
    }

    if (!reason || reason.trim().length < 5) {
      setError('A mandatory reason (minimum 5 characters) is required for audit trails.');
      return;
    }

    const amountPaise = Math.round(parsedRupees * 100);

    setLoading(true);
    try {
      const res = await recordCustomerAdjustmentApi(customer._id, {
        adjustmentType,
        amountPaise,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      });
      onSuccess(res);
    } catch (err) {
      setError(err.message || 'Failed to record adjustment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#166534]" />
            <h2 className="text-base font-bold text-slate-800">
              Manual Ledger Adjustment / समायोजन
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
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Adjustments create permanent, audited entries in <strong>{customer.name}</strong>&apos;s ledger. Direct balance mutations are strictly disallowed.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Adjustment Type / प्रकार <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjustmentType('CREDIT')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex flex-col items-center ${
                  adjustmentType === 'CREDIT'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>जमा (CREDIT)</span>
                <span className="text-[10px] font-normal text-slate-500">Reduces farmer debt</span>
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentType('DEBIT')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex flex-col items-center ${
                  adjustmentType === 'DEBIT'
                    ? 'border-rose-600 bg-rose-50 text-rose-800 ring-1 ring-rose-600'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>नावे (DEBIT)</span>
                <span className="text-[10px] font-normal text-slate-500">Increases farmer debt</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Adjustment Amount (₹) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400 font-bold text-sm">₹</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                required
                className="w-full pl-8 pr-3 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#166534]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mandatory Reason for Adjustment <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Promotional subsidy discount granted by owner, interest waiver"
              required
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#166534]"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">Minimum 5 characters. Permanently logged in audit trail.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Internal Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Approved in owner meeting"
              className="w-full px-3 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#166534]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={loading}
              className="bg-[#166534] hover:bg-[#14532d]"
            >
              {loading ? 'Posting...' : 'Post Adjustment / समायोजन करा'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
