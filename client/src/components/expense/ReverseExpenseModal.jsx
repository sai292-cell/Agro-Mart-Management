import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, RotateCcw, AlertTriangle } from 'lucide-react';
import { reverseExpenseApi } from '../../services/api';

export default function ReverseExpenseModal({ isOpen, onClose, expense, onSuccess }) {
  const { t, i18n } = useTranslation();
  const isMr = i18n.language === 'mr';

  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !expense) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!reason.trim() || reason.trim().length < 5) {
      setError(
        isMr
          ? 'कृपया उलट नोंद (रिव्हर्सल) करण्याचे कारण प्रविष्ट करा (किमान ५ अक्षरे).'
          : 'Please enter a reversal reason (minimum 5 characters).'
      );
      return;
    }

    try {
      setLoading(true);
      await reverseExpenseApi(expense._id, { reason: reason.trim() });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to reverse expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-surface border-border w-full max-w-md overflow-hidden rounded-xl border shadow-2xl">
        <div className="border-border flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center space-x-2">
            <RotateCcw className="h-5 w-5 text-amber-600" />
            <h2 className="text-text-main text-lg font-bold">
              {isMr ? 'खर्च उलट नोंद (Reverse Expense)' : 'Reverse Operating Expense'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-main rounded-lg p-1.5 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && (
            <div className="flex items-center space-x-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400">
            {isMr
              ? 'टीप: मंजूर झालेला खर्च थेट हटवता येत नाही. ही क्रिया परस्परविरोधी उलट नोंद (Reversal) तयार करेल.'
              : 'Notice: Approved expenses cannot be deleted. This will record an auditable reversal counter-entry.'}
          </div>

          <div className="bg-surface-alt rounded-lg p-4 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-text-muted">{isMr ? 'खर्च क्रमांक:' : 'Expense No:'}</span>
              <span className="text-text-main font-semibold">{expense.expenseNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">{isMr ? 'रक्कम:' : 'Amount:'}</span>
              <span className="text-text-main font-bold">₹{((expense.amountPaise || 0) / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">{isMr ? 'वर्गवारी:' : 'Category:'}</span>
              <span className="text-text-main font-medium">{expense.category}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">{isMr ? 'प्राप्तकर्ता:' : 'Payee:'}</span>
              <span className="text-text-main">{expense.payee}</span>
            </div>
          </div>

          <div>
            <label className="text-text-main mb-1.5 block text-xs font-semibold">
              {isMr ? 'उलट नोंद करण्याचे कारण (किमान ५ अक्षरे)*' : 'Mandatory Reversal Reason (min 5 chars)*'}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isMr ? 'उदा. चुकीचा खर्च नोंदवला गेला / दुबार नोंद...' : 'e.g. Duplicate voucher recorded in error...'}
              rows={3}
              required
              className="bg-surface border-border text-text-main focus:border-amber-500 focus:ring-amber-500/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>

          <div className="border-border flex justify-end space-x-3 border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="border-border text-text-muted hover:bg-surface-alt rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
            >
              {isMr ? 'रद्द करा' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-amber-600 hover:bg-amber-700 flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50"
            >
              {loading ? (
                <span>{isMr ? 'प्रक्रिया सुरू आहे...' : 'Processing...'}</span>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  <span>{isMr ? 'उलट नोंद करा' : 'Confirm Reversal'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
