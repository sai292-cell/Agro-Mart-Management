import React, { useState } from 'react';
import { X, BookOpen, AlertCircle, Info } from 'lucide-react';
import Button from '../common/Button';
import { recordCustomerOpeningBalanceApi } from '../../services/api';

export default function OpeningBalanceModal({ customer, onClose, onSuccess }) {
  const [balanceType, setBalanceType] = useState('DEBIT');
  const [amountRupees, setAmountRupees] = useState('');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const parsedRupees = parseFloat(amountRupees);
    if (isNaN(parsedRupees) || parsedRupees <= 0) {
      setError('Please enter a valid opening balance amount greater than zero.');
      return;
    }

    const amountPaise = Math.round(parsedRupees * 100);

    setLoading(true);
    try {
      const res = await recordCustomerOpeningBalanceApi(customer._id, {
        balanceType,
        amountPaise,
        asOfDate,
        notes: notes.trim() || undefined,
      });
      onSuccess(res);
    } catch (err) {
      setError(err.message || 'Failed to record opening balance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#166534]" />
            <h2 className="text-base font-bold text-slate-800">
              Set Opening Balance / आरंभीची शिल्लक नोंदवा
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

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-[#166534] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Use this to migrate existing balances from traditional paper khaata books for <strong>{customer.name}</strong>. Can only be recorded once per farmer.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Balance Nature / स्वरूप <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBalanceType('DEBIT')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex flex-col items-center ${
                  balanceType === 'DEBIT'
                    ? 'border-rose-600 bg-rose-50 text-rose-800 ring-1 ring-rose-600'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>नावे (DEBIT - उधारी)</span>
                <span className="text-[10px] font-normal text-slate-500">Farmer owes money</span>
              </button>
              <button
                type="button"
                onClick={() => setBalanceType('CREDIT')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex flex-col items-center ${
                  balanceType === 'CREDIT'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>जमा (CREDIT - अगाऊ)</span>
                <span className="text-[10px] font-normal text-slate-500">Advance held in shop</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Opening Balance Amount (₹) <span className="text-rose-500">*</span>
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
              As of Date / तारीख
            </label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#166534]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Migration Reference / Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Migrated from Register Book 2025-26 Page 42"
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
              {loading ? 'Recording...' : 'Set Opening Balance / नोंदवा'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
