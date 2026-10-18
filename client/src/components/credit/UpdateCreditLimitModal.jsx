import React, { useState } from 'react';
import { X, ShieldCheck, AlertCircle } from 'lucide-react';
import Button from '../common/Button';
import { updateCustomerCreditLimitApi } from '../../services/api';

export default function UpdateCreditLimitModal({ customer, onClose, onSuccess }) {
  const [creditLimitRupees, setCreditLimitRupees] = useState(
    ((Number(customer.creditLimitPaise) || 0) / 100).toFixed(0)
  );
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatCurrency = (paise) => '₹' + ((Number(paise) || 0) / 100).toFixed(2);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const parsedRupees = parseFloat(creditLimitRupees);
    if (isNaN(parsedRupees) || parsedRupees < 0) {
      setError('Credit limit cannot be negative.');
      return;
    }

    const creditLimitPaise = Math.round(parsedRupees * 100);

    setLoading(true);
    try {
      const res = await updateCustomerCreditLimitApi(customer._id, {
        creditLimitPaise,
        reason: reason.trim() || undefined,
      });
      onSuccess(res);
    } catch (err) {
      setError(err.message || 'Failed to update credit limit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#166534]" />
            <h2 className="text-base font-bold text-slate-800">
              Update Credit Limit / उधारी मर्यादा बदला
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

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Farmer:</span>
              <span className="font-bold text-slate-800">{customer.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Current Outstanding:</span>
              <span className="font-mono font-bold text-rose-700">{formatCurrency(customer.outstandingBalancePaise)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Current Credit Limit:</span>
              <span className="font-mono font-bold text-slate-700">{formatCurrency(customer.creditLimitPaise)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              New Approved Credit Limit (₹) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400 font-bold text-sm">₹</span>
              <input
                type="number"
                step="100"
                min="0"
                value={creditLimitRupees}
                onChange={(e) => setCreditLimitRupees(e.target.value)}
                required
                className="w-full pl-8 pr-3 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#166534]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Reason / Justification for Limit Change
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Higher landholding season requirement, good repayment track record"
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#166534]"
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
              {loading ? 'Saving...' : 'Update Limit / मर्यादा जतन करा'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
