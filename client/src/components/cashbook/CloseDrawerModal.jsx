import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Lock, AlertTriangle, CheckCircle } from 'lucide-react';
import { closeCashSessionApi } from '../../services/api';

export default function CloseDrawerModal({ isOpen, onClose, activeSession, onSuccess }) {
  const { t, i18n } = useTranslation();
  const isMr = i18n.language === 'mr';

  const [closingCashRupees, setClosingCashRupees] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !activeSession) return null;

  const expectedPaise = activeSession.liveExpectedCashPaise || activeSession.openingCashPaise || 0;
  const countedPaise = closingCashRupees !== '' ? Math.round(parseFloat(closingCashRupees || 0) * 100) : null;
  const variancePaise = countedPaise !== null ? countedPaise - expectedPaise : 0;
  const hasVariance = countedPaise !== null && variancePaise !== 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const countedNum = parseFloat(closingCashRupees);
    if (isNaN(countedNum) || countedNum < 0) {
      setError(isMr ? 'कृपया प्रत्यक्ष मोजलेली रोकड रक्कम प्रविष्ट करा.' : 'Please enter the actual counted cash amount.');
      return;
    }

    if (hasVariance && (!closingNotes.trim() || closingNotes.trim().length < 3)) {
      setError(
        isMr
          ? 'रोकड रकमेत तफावत आढळली आहे. कृपया कारण / शेरा प्रविष्ट करा (किमान ३ अक्षरे).'
          : 'Cash discrepancy detected. An explanatory note (min 3 characters) is mandatory.'
      );
      return;
    }

    try {
      setLoading(true);
      await closeCashSessionApi({
        closingCashCountedPaise: Math.round(countedNum * 100),
        closingNotes: closingNotes.trim(),
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to close cash drawer session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-surface border-border w-full max-w-lg overflow-hidden rounded-xl border shadow-2xl">
        <div className="border-border flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center space-x-2">
            <Lock className="h-5 w-5 text-amber-600" />
            <h2 className="text-text-main text-lg font-bold">
              {isMr ? 'कॅश ड्रॉवर सत्र बंद करा (Daily Cash Closing)' : 'Close Cash Drawer Session'}
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

          {/* Breakdown summary */}
          <div className="bg-surface-alt rounded-lg p-4 space-y-2 text-sm border border-border">
            <div className="flex justify-between">
              <span className="text-text-muted">{isMr ? 'सत्र क्रमांक:' : 'Session Number:'}</span>
              <span className="text-text-main font-semibold">{activeSession.sessionNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">{isMr ? 'सुरुवातीची रोकड (Opening):' : 'Opening Float:'}</span>
              <span className="text-text-main font-semibold">
                ₹{((activeSession.openingCashPaise || 0) / 100).toFixed(2)}
              </span>
            </div>
            {activeSession.liveMovements && (
              <>
                <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                  <span>+ {isMr ? 'रोख विक्री व उधारी जमा:' : 'Cash Sales & Collections:'}</span>
                  <span>+₹{((activeSession.liveMovements.cash.inflows.totalInflowPaise || 0) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-red-600 dark:text-red-400">
                  <span>- {isMr ? 'रोख खरेदी व खर्च:' : 'Cash Supplier & Expenses:'}</span>
                  <span>-₹{((activeSession.liveMovements.cash.outflows.totalOutflowPaise || 0) / 100).toFixed(2)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <span className="text-text-main">{isMr ? 'अपेक्षित रोकड (Expected Cash):' : 'Expected Cash:'}</span>
              <span className="text-primary">₹{(expectedPaise / 100).toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="text-text-main mb-1.5 block text-xs font-semibold">
              {isMr ? 'ड्रॉवरमधील प्रत्यक्ष मोजलेली रोकड (₹)*' : 'Actual Counted Cash in Drawer (₹)*'}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={closingCashRupees}
              onChange={(e) => setClosingCashRupees(e.target.value)}
              placeholder="e.g. 5420.00"
              required
              className="bg-surface border-border text-text-main focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-lg font-bold focus:ring-2 focus:outline-none"
            />
          </div>

          {/* Variance Status Indicator */}
          {closingCashRupees !== '' && (
            <div
              className={`rounded-lg p-3 text-sm flex items-center justify-between border ${
                variancePaise === 0
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                  : variancePaise > 0
                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400'
              }`}
            >
              <div className="flex items-center space-x-2">
                {variancePaise === 0 ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <span className="font-semibold">
                  {variancePaise === 0
                    ? isMr
                      ? 'तंतोतंत मेळ बसला (No Variance)'
                      : 'Exact Match (No Variance)'
                    : variancePaise > 0
                    ? isMr
                      ? 'अतिरिक्त रोकड (Cash Surplus)'
                      : 'Cash Surplus'
                    : isMr
                      ? 'रोकड तूट (Cash Shortage)'
                      : 'Cash Shortage'}
                </span>
              </div>
              <span className="font-bold">
                {variancePaise > 0 ? '+' : ''}₹{(variancePaise / 100).toFixed(2)}
              </span>
            </div>
          )}

          <div>
            <label className="text-text-main mb-1.5 block text-xs font-semibold">
              {isMr
                ? `शेरा / तफावतीचे स्पष्टीकरण ${hasVariance ? '*' : '(ऐच्छिक)'}`
                : `Closing Notes / Variance Reason ${hasVariance ? '*' : '(Optional)'}`}
            </label>
            <textarea
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              placeholder={
                hasVariance
                  ? isMr
                    ? 'तफावत असण्याचे कारण स्पष्ट करा...'
                    : 'Explain reason for variance...'
                  : isMr
                  ? 'दिवसअखेर शेरा...'
                  : 'End of day closing note...'
              }
              rows={2}
              required={hasVariance}
              className="bg-surface border-border text-text-main focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
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
                <span>{isMr ? 'बंद होत आहे...' : 'Closing...'}</span>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span>{isMr ? 'सत्र बंद करा' : 'Close Session'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
