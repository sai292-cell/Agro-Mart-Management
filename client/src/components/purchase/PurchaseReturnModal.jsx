import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, CornerUpLeft, AlertCircle } from 'lucide-react';
import { recordPurchaseReturnApi } from '../../services/api';

export default function PurchaseReturnModal({ isOpen, onClose, purchase, onReturned }) {
  const { t } = useTranslation();

  const [returnQtys, setReturnQtys] = useState({});
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !purchase) return null;

  const handleQtyChange = (itemId, val) => {
    setReturnQtys((prev) => ({
      ...prev,
      [itemId]: val,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!reason.trim() || reason.trim().length < 5) {
      setError('A mandatory return reason (minimum 5 characters) is required');
      return;
    }

    const returnItems = [];
    for (const it of purchase.items || []) {
      const qty = Number(returnQtys[it._id] || 0);
      if (qty > 0) {
        if (qty > it.quantity) {
          setError(`Return quantity for ${it.nameSnapshot} cannot exceed purchased quantity (${it.quantity})`);
          return;
        }
        returnItems.push({
          productId: it.productId,
          batchId: it.batchId || it._id, // fallback batch reference
          quantity: qty,
          ratePaise: it.purchaseRatePaise,
        });
      }
    }

    if (returnItems.length === 0) {
      setError('Please specify a return quantity greater than 0 for at least one item');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await recordPurchaseReturnApi(purchase._id, {
        items: returnItems,
        reason: reason.trim(),
        notes: notes.trim(),
      });

      onReturned();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record purchase return');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <CornerUpLeft className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Purchase Return to Supplier (खरेदी माल परत नोंद)
              </h2>
              <p className="text-xs text-gray-500">{purchase.purchaseNumber}</p>
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
              <label className="mb-2 block text-xs font-bold text-gray-700 uppercase">
                Select Items to Return (परत करावयाच्या वस्तू व प्रमाण)
              </label>
              <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/50 p-3">
                {purchase.items?.map((it) => (
                  <div
                    key={it._id}
                    className="flex items-center justify-between rounded-lg bg-white p-2.5 border border-gray-200 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-gray-900">{it.nameSnapshot}</div>
                      <div className="text-[11px] text-gray-500">
                        Purchased: {it.quantity} {it.unitSnapshot} @ ₹{(it.purchaseRatePaise / 100).toFixed(2)} | Batch: {it.batchNumber || '—'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Return:</span>
                      <input
                        type="number"
                        min="0"
                        max={it.quantity}
                        step="any"
                        placeholder="0"
                        value={returnQtys[it._id] || ''}
                        onChange={(e) => handleQtyChange(it._id, e.target.value)}
                        className="w-20 rounded border border-gray-300 p-1 text-right text-xs focus:border-amber-600 focus:outline-hidden"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Mandatory Return Reason (माल परत करण्याचे कारण) *
              </label>
              <input
                type="text"
                required
                minLength={5}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Damaged bottles received / Short expiry / Wrong variety supplied"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-amber-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">Notes / Remarks</label>
              <textarea
                rows="2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Transporter note / Company credit note pending..."
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-amber-600 focus:outline-hidden"
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
              className="rounded-xl bg-amber-600 px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Confirm Return & Deduct Stock (माल परत नोंदवा)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
