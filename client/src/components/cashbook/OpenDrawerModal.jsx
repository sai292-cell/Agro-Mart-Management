import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { openCashSessionApi } from '../../services/api';

export default function OpenDrawerModal({ isOpen, onClose, onSuccess }) {
  const { t, i18n } = useTranslation();
  const isMr = i18n.language === 'mr';

  const [openingCashRupees, setOpeningCashRupees] = useState('');
  const [openingNotes, setOpeningNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(openingCashRupees);
    if (isNaN(amountNum) || amountNum < 0) {
      setError(isMr ? 'कृपया वैध सुरुवातीची रोकड रक्कम प्रविष्ट करा.' : 'Please enter a valid opening cash float.');
      return;
    }

    try {
      setLoading(true);
      await openCashSessionApi({
        openingCashPaise: Math.round(amountNum * 100),
        openingNotes: openingNotes.trim(),
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to open cash drawer session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-surface border-border w-full max-w-md overflow-hidden rounded-xl border shadow-2xl">
        <div className="border-border flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center space-x-2">
            <Lock className="text-primary h-5 w-5" />
            <h2 className="text-text-main text-lg font-bold">
              {isMr ? 'कॅश ड्रॉवर सत्र सुरू करा' : 'Open Cash Drawer Session'}
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
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-surface-alt rounded-lg p-3 text-xs text-text-muted">
            {isMr
              ? 'टीप: दिवसाच्या सुरुवातीला ड्रॉवरमध्ये ठेवलेली सुरुवातीची रोकड (Opening Float) मोजून येथे नोंदवा.'
              : 'Notice: Count and record the opening cash float available in the physical register drawer.'}
          </div>

          <div>
            <label className="text-text-main mb-1.5 block text-xs font-semibold">
              {isMr ? 'सुरुवातीची रोकड रक्कम (₹)*' : 'Opening Cash Float (₹)*'}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={openingCashRupees}
              onChange={(e) => setOpeningCashRupees(e.target.value)}
              placeholder="e.g. 2000.00"
              required
              className="bg-surface border-border text-text-main focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-base font-bold focus:ring-2 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-text-main mb-1.5 block text-xs font-semibold">
              {isMr ? 'सुरुवातीची नोंद / शेरा' : 'Opening Notes (Optional)'}
            </label>
            <textarea
              value={openingNotes}
              onChange={(e) => setOpeningNotes(e.target.value)}
              placeholder={isMr ? 'उदा. सकाळची मोजणी पूर्ण झाली...' : 'e.g. Morning float verified...'}
              rows={2}
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
              className="bg-primary hover:bg-primary-hover flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50"
            >
              {loading ? (
                <span>{isMr ? 'सुरू होत आहे...' : 'Opening...'}</span>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span>{isMr ? 'सत्र सुरू करा' : 'Open Session'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
