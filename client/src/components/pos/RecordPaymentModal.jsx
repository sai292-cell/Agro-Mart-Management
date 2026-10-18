import React, { useState } from 'react';
import { X, DollarSign, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';
import Button from '../common/Button';
import { recordInvoicePaymentApi } from '../../services/api';

export default function RecordPaymentModal({ invoice, onClose, onSuccess }) {
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [amountRupees, setAmountRupees] = useState(
    ((Number(invoice.balancePaise) || 0) / 100).toFixed(2)
  );
  const [transactionReference, setTransactionReference] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatCurrency = (paise) => '₹' + ((Number(paise) || 0) / 100).toFixed(2);
  const maxAllowedRupees = (Number(invoice.balancePaise) || 0) / 100;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const parsedRupees = parseFloat(amountRupees);
    if (isNaN(parsedRupees) || parsedRupees <= 0) {
      setError('Please enter a valid payment amount greater than zero.');
      return;
    }

    const amountPaise = Math.round(parsedRupees * 100);
    if (amountPaise > invoice.balancePaise) {
      setError(`Payment cannot exceed the outstanding balance of ${formatCurrency(invoice.balancePaise)}.`);
      return;
    }

    if (paymentMode === 'UPI' && !transactionReference.trim()) {
      setError('UPI Reference / UTR Number is strictly required for UPI transactions.');
      return;
    }

    setLoading(true);
    try {
      const idempotencyKey = 'pay_' + crypto.randomUUID();
      const res = await recordInvoicePaymentApi(
        invoice._id,
        {
          paymentMode,
          amountPaise,
          transactionReference: transactionReference.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        idempotencyKey
      );

      onSuccess(res.invoice);
    } catch (err) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#166534]" />
            <h2 className="text-base font-bold text-slate-800">
              Record Payment / बाकी रक्कम जमा करा
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
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Invoice Summary */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice:</span>
              <span className="font-mono font-bold text-slate-800">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Customer:</span>
              <span className="font-semibold text-slate-800">{invoice.customerSnapshot?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Grand Total:</span>
              <span className="font-mono font-medium">{formatCurrency(invoice.grandTotalPaise)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Already Paid:</span>
              <span className="font-mono font-medium text-emerald-700">{formatCurrency(invoice.paidPaise)}</span>
            </div>
            <div className="flex justify-between font-bold text-rose-700 pt-1 border-t border-slate-200">
              <span>Outstanding Balance Due:</span>
              <span className="font-mono text-sm">{formatCurrency(invoice.balancePaise)}</span>
            </div>
          </div>

          {/* Payment Mode Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Payment Mode / पद्धत <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMode('CASH')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  paymentMode === 'CASH'
                    ? 'border-[#166534] bg-emerald-50 text-[#166534] ring-1 ring-[#166534]'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                💵 Cash / रोख
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode('UPI')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  paymentMode === 'UPI'
                    ? 'border-[#166534] bg-emerald-50 text-[#166534] ring-1 ring-[#166534]'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                📱 UPI / QR
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Amount to Collect (₹) <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setAmountRupees(maxAllowedRupees.toFixed(2))}
                className="text-[11px] text-[#166534] hover:underline font-semibold"
              >
                Full Balance ({formatCurrency(invoice.balancePaise)})
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={maxAllowedRupees}
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                required
                className="w-full pl-8 pr-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534]"
              />
            </div>
          </div>

          {/* UPI Reference if UPI */}
          {paymentMode === 'UPI' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                UPI Reference / UTR Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                placeholder="12-digit UTR or txn ID"
                required
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534]"
              />
            </div>
          )}

          {/* Optional Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Paid at counter by farmer's son"
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534]"
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
              {loading ? 'Processing...' : 'Confirm Payment / जमा करा'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
