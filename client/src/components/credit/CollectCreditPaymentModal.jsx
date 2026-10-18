import React, { useState, useEffect } from 'react';
import { X, DollarSign, CreditCard, AlertCircle, CheckCircle, ListPlus, ArrowRight } from 'lucide-react';
import Button from '../common/Button';
import { recordCustomerAccountPaymentApi, getInvoicesApi } from '../../services/api';

export default function CollectCreditPaymentModal({ customer, onClose, onSuccess }) {
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [amountRupees, setAmountRupees] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Unpaid invoices for custom allocation
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [allocationMode, setAllocationMode] = useState('FIFO'); // 'FIFO' | 'CUSTOM'
  const [customAllocations, setCustomAllocations] = useState({}); // { [invoiceId]: rupeesString }

  const formatCurrency = (paise) => '₹' + ((Number(paise) || 0) / 100).toFixed(2);

  // Load unpaid invoices
  useEffect(() => {
    async function loadInvoices() {
      try {
        const res = await getInvoicesApi({
          customerId: customer._id,
          status: 'FINALIZED',
          paymentStatus: 'UNPAID,PARTIALLY_PAID',
          limit: 30,
        });
        const activeUnpaid = (res.invoices || []).filter((inv) => inv.balanceDuePaise > 0);
        setUnpaidInvoices(activeUnpaid);

        // Pre-fill amount with outstanding balance if positive
        if (customer.outstandingBalancePaise > 0) {
          setAmountRupees(((customer.outstandingBalancePaise || 0) / 100).toFixed(2));
        }
      } catch (err) {
        console.error('Failed to load unpaid invoices', err);
      } finally {
        setLoadingInvoices(false);
      }
    }
    loadInvoices();
  }, [customer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const parsedRupees = parseFloat(amountRupees);
    if (isNaN(parsedRupees) || parsedRupees <= 0) {
      setError('Please enter a valid payment amount greater than zero.');
      return;
    }

    const amountPaise = Math.round(parsedRupees * 100);

    if (paymentMethod === 'UPI' && !referenceId.trim()) {
      setError('UPI Reference / UTR Number is mandatory for UPI payments.');
      return;
    }

    // Build payload
    const payload = {
      amountPaise,
      paymentMethod,
      referenceId: referenceId.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    if (allocationMode === 'CUSTOM') {
      const explicit = [];
      let totalCustomPaise = 0;
      for (const [invId, rupees] of Object.entries(customAllocations)) {
        const pRupees = parseFloat(rupees);
        if (!isNaN(pRupees) && pRupees > 0) {
          const aPaise = Math.round(pRupees * 100);
          explicit.push({ invoiceId: invId, amountPaise: aPaise });
          totalCustomPaise += aPaise;
        }
      }

      if (totalCustomPaise > amountPaise) {
        setError(`Sum of invoice allocations (${formatCurrency(totalCustomPaise)}) exceeds the collected payment amount (${formatCurrency(amountPaise)}).`);
        return;
      }
      if (explicit.length > 0) {
        payload.invoiceAllocations = explicit;
      }
    }

    setLoading(true);
    try {
      const idempotencyKey = 'cust_pay_' + crypto.randomUUID();
      const res = await recordCustomerAccountPaymentApi(customer._id, payload, idempotencyKey);
      onSuccess(res);
    } catch (err) {
      setError(err.message || 'Failed to record customer payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#166534]" />
            <h2 className="text-base font-bold text-slate-800">
              Collect Credit Payment / उधारी जमा करा
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Farmer Account Summary */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Farmer / शेतकरी:</span>
              <span className="font-bold text-slate-800">{customer.name}</span>
            </div>
            {customer.phone && (
              <div className="flex justify-between">
                <span className="text-slate-500">Phone:</span>
                <span className="font-mono text-slate-700">{customer.phone}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Village:</span>
              <span className="text-slate-700">{customer.village || 'N/A'}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
              <span className="text-slate-700">Total Outstanding Debt:</span>
              <span className="font-mono text-sm text-rose-700">{formatCurrency(customer.outstandingBalancePaise)}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Payment Method / पद्धत <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  paymentMethod === 'CASH'
                    ? 'border-[#166534] bg-emerald-50 text-[#166534] ring-1 ring-[#166534]'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                💵 Cash / रोख
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('UPI')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  paymentMethod === 'UPI'
                    ? 'border-[#166534] bg-emerald-50 text-[#166534] ring-1 ring-[#166534]'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                📱 UPI / QR
              </button>
            </div>
          </div>

          {/* Payment Amount */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Amount Received (₹) <span className="text-rose-500">*</span>
              </label>
              {customer.outstandingBalancePaise > 0 && (
                <button
                  type="button"
                  onClick={() => setAmountRupees(((customer.outstandingBalancePaise || 0) / 100).toFixed(2))}
                  className="text-[11px] text-[#166534] hover:underline font-semibold"
                >
                  Pay Full Balance ({formatCurrency(customer.outstandingBalancePaise)})
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                required
                className="w-full pl-8 pr-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534]"
              />
            </div>
          </div>

          {/* UPI Reference if UPI */}
          {paymentMethod === 'UPI' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                UPI Reference / UTR Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                placeholder="12-digit UTR or transaction ID"
                required
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534]"
              />
            </div>
          )}

          {/* Allocation Strategy Options */}
          {unpaidInvoices.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700">
                  Bill Allocation Strategy:
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="allocMode"
                      value="FIFO"
                      checked={allocationMode === 'FIFO'}
                      onChange={() => setAllocationMode('FIFO')}
                    />
                    <span className="font-semibold text-slate-700">Auto (FIFO)</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="allocMode"
                      value="CUSTOM"
                      checked={allocationMode === 'CUSTOM'}
                      onChange={() => setAllocationMode('CUSTOM')}
                    />
                    <span className="font-semibold text-slate-700">Choose Bills</span>
                  </label>
                </div>
              </div>

              {allocationMode === 'FIFO' ? (
                <p className="text-[11px] text-slate-500 leading-snug">
                  Payment will be automatically applied to the oldest unpaid bills first. Any remaining balance will be held as advance credit (अगाऊ).
                </p>
              ) : (
                <div className="space-y-2 max-h-36 overflow-y-auto pt-1">
                  {unpaidInvoices.map((inv) => (
                    <div key={inv._id} className="flex justify-between items-center text-xs bg-white p-2 rounded border border-slate-200">
                      <div>
                        <span className="font-mono font-bold">{inv.invoiceNumber}</span>
                        <span className="text-[10px] text-slate-400 ml-2">Due: {formatCurrency(inv.balanceDuePaise)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={customAllocations[inv._id] || ''}
                          onChange={(e) =>
                            setCustomAllocations({ ...customAllocations, [inv._id]: e.target.value })
                          }
                          className="w-20 px-1.5 py-0.5 text-xs font-mono border rounded"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Paid at counter by brother"
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
              {loading ? 'Recording...' : 'Record Payment / जमा करा'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
