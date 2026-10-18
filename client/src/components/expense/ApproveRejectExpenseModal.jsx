import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { approveExpenseApi, rejectExpenseApi } from '../../services/api';

export default function ApproveRejectExpenseModal({ isOpen, onClose, expense, mode = 'APPROVE', onSuccess }) {
  const { t, i18n } = useTranslation();
  const isMr = i18n.language === 'mr';

  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !expense) return null;

  const isApprove = mode === 'APPROVE';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!isApprove && (!reason.trim() || reason.trim().length < 3)) {
      setError(isMr ? 'कृपया नकार देण्याचे कारण प्रविष्ट करा (किमान ३ अक्षरे).' : 'Please enter a rejection reason (min 3 characters).');
      return;
    }

    try {
      setLoading(true);
      if (isApprove) {
        await approveExpenseApi(expense._id);
      } else {
        await rejectExpenseApi(expense._id, { reason: reason.trim() });
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-surface border-border w-full max-w-md overflow-hidden rounded-xl border shadow-2xl">
        <div className="border-border flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center space-x-2">
            {isApprove ? (
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <h2 className="text-text-main text-lg font-bold">
              {isApprove
                ? isMr
                  ? 'खर्च मंजूर करा (Approve Expense)'
                  : 'Approve Operating Expense'
                : isMr
                ? 'खर्च नाकारा (Reject Expense)'
                : 'Reject Operating Expense'}
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
            <div className="pt-1 text-xs text-text-muted italic">
              "{expense.description}"
            </div>
          </div>

          {!isApprove && (
            <div>
              <label className="text-text-main mb-1.5 block text-xs font-semibold">
                {isMr ? 'नकार देण्याचे कारण*' : 'Rejection Reason*'}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={isMr ? 'खर्च का नाकारला जात आहे ते नमूद करा...' : 'Reason for rejection...'}
                rows={3}
                required
                className="bg-surface border-border text-text-main focus:border-red-500 focus:ring-red-500/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              />
            </div>
          )}

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
              className={`flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
                isApprove ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {loading ? (
                <span>{isMr ? 'प्रक्रिया सुरू आहे...' : 'Processing...'}</span>
              ) : isApprove ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span>{isMr ? 'मंजूर करा' : 'Approve'}</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  <span>{isMr ? 'नाकारा' : 'Reject'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
