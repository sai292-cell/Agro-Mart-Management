import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';
import { recordSupplierPaymentApi, getPurchasesApi } from '../../services/api';

export default function RecordSupplierPaymentModal({ isOpen, onClose, supplier, onRecorded }) {
  const { t } = useTranslation();

  const [amountRupees, setAmountRupees] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [referenceId, setReferenceId] = useState('');
  const [notes, setNotes] = useState('');
  const [allocationMode, setAllocationMode] = useState('FIFO'); // 'FIFO' or 'CUSTOM'
  const [purchases, setPurchases] = useState([]);
  const [customAllocations, setCustomAllocations] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && supplier) {
      setAmountRupees('');
      setPaymentMethod('BANK_TRANSFER');
      setReferenceId('');
      setNotes('');
      setAllocationMode('FIFO');
      setError(null);
      setCustomAllocations({});

      // Fetch unpaid purchases for custom allocation option
      getPurchasesApi({
        supplierId: supplier._id,
        status: 'RECEIVED',
        paymentStatus: 'UNPAID,PARTIALLY_PAID',
        limit: 50,
      })
        .then((res) => {
          setPurchases(res.data || []);
        })
        .catch(() => setPurchases([]));
    }
  }, [isOpen, supplier]);

  if (!isOpen || !supplier) return null;

  const currentBalancePaise = supplier.outstandingBalancePaise || 0;
  const isAdvancePayment = currentBalancePaise <= 0;

  const handleCustomAllocChange = (purchaseId, rupees) => {
    setCustomAllocations((prev) => ({
      ...prev,
      [purchaseId]: rupees,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amountPaise = Math.round(Number(amountRupees || 0) * 100);

    if (!amountPaise || amountPaise <= 0) {
      setError('Please enter a valid payment amount greater than zero');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let allocations = undefined;
      const isAutoFifo = allocationMode === 'FIFO';

      if (!isAutoFifo) {
        allocations = Object.entries(customAllocations)
          .map(([purchaseId, val]) => ({
            purchaseId,
            amountPaise: Math.round(Number(val || 0) * 100),
          }))
          .filter((a) => a.amountPaise > 0);
      }

      await recordSupplierPaymentApi(supplier._id, {
        amountPaise,
        paymentMethod,
        referenceId: referenceId.trim(),
        notes: notes.trim(),
        autoFifo: isAutoFifo,
        allocations,
      });

      onRecorded();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record supplier payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {t('supplier.recordPayment', 'Pay Supplier (पुरवठादाराला पेमेंट करा)')}
              </h2>
              <p className="text-xs text-gray-500">{supplier.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Balance Context Card */}
          <div className="mb-4 flex items-center justify-between rounded-xl bg-emerald-50/70 p-3.5 border border-emerald-100">
            <div>
              <div className="text-xs text-emerald-800 font-medium">
                {isAdvancePayment
                  ? 'Current Advance Held with Supplier (अगाऊ जमा):'
                  : 'Current Payable Balance (देय बाकी):'}
              </div>
              <div className="text-xl font-bold text-emerald-950">
                ₹{Math.abs(currentBalancePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            {isAdvancePayment && (
              <span className="rounded-full bg-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                Advance Surplus
              </span>
            )}
          </div>

          <div className="space-y-4">
            {/* Amount */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Payment Amount (रक्कम ₹) *
              </label>
              <div className="relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm font-semibold text-gray-400">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-gray-200 py-2.5 pr-4 pl-8 text-base font-bold text-gray-900 focus:border-green-600 focus:outline-hidden"
                />
              </div>
              {currentBalancePaise > 0 && (
                <button
                  type="button"
                  onClick={() => setAmountRupees((currentBalancePaise / 100).toFixed(2))}
                  className="mt-1 text-xs font-medium text-green-700 hover:underline"
                >
                  Pay Full Balance (पूर्ण बाकी भरा: ₹{(currentBalancePaise / 100).toFixed(2)})
                </button>
              )}
            </div>

            {/* Payment Method & Reference */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  Payment Mode (पेमेंट पद्धत) *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-hidden"
                >
                  <option value="BANK_TRANSFER">Bank Transfer / NEFT / RTGS</option>
                  <option value="UPI">UPI / GPay / PhonePe</option>
                  <option value="CHEQUE">Cheque (धनादेश)</option>
                  <option value="CASH">Cash (रोख)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  Transaction Ref / Cheque No
                </label>
                <input
                  type="text"
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  placeholder="UTR / Chq # 123456"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Allocation Strategy */}
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
              <label className="mb-2 block text-xs font-bold text-gray-700 uppercase">
                Invoice Allocation Method (बिल वाटप पद्धत)
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                  <input
                    type="radio"
                    name="allocMode"
                    value="FIFO"
                    checked={allocationMode === 'FIFO'}
                    onChange={() => setAllocationMode('FIFO')}
                    className="text-green-600 focus:ring-green-500"
                  />
                  <span>Auto FIFO (जुन्या बिलांपासून आधी वजा करा)</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                  <input
                    type="radio"
                    name="allocMode"
                    value="CUSTOM"
                    checked={allocationMode === 'CUSTOM'}
                    onChange={() => setAllocationMode('CUSTOM')}
                    className="text-green-600 focus:ring-green-500"
                  />
                  <span>Specific Bills (विशिष्ट बिलाला जोडा)</span>
                </label>
              </div>

              {allocationMode === 'CUSTOM' && (
                <div className="mt-3 max-h-40 overflow-y-auto space-y-2 border-t border-gray-200 pt-2">
                  {purchases.length === 0 ? (
                    <div className="text-xs text-gray-500 py-1">No unpaid bills found. Payment will be held as advance.</div>
                  ) : (
                    purchases.map((p) => (
                      <div key={p._id} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-gray-200">
                        <div>
                          <span className="font-semibold">{p.purchaseNumber}</span> (Inv #{p.supplierInvoiceNumber})
                          <div className="text-gray-500">
                            Balance: ₹{(p.balancePaise / 100).toFixed(2)}
                          </div>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Amount ₹"
                          value={customAllocations[p._id] || ''}
                          onChange={(e) => handleCustomAllocChange(p._id, e.target.value)}
                          className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-xs focus:border-green-600 focus:outline-hidden"
                        />
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">Notes (नोंदी)</label>
              <textarea
                rows="2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Paid from Shop SBI Current A/c..."
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Footer */}
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
              className="rounded-xl bg-green-700 px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-green-800 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Confirm Outward Payment (पेमेंट नोंदवा)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
