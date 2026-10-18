import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ShieldCheck, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { getSupplierReconciliationReportApi } from '../../services/api';

export default function SupplierReconciliationModal({ isOpen, onClose, supplier }) {
  const { t } = useTranslation();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && supplier) {
      setLoading(true);
      setError(null);
      getSupplierReconciliationReportApi(supplier._id)
        .then((data) => setReport(data))
        .catch((err) => setError(err.message || 'Failed to generate reconciliation report'))
        .finally(() => setLoading(false));
    }
  }, [isOpen, supplier]);

  if (!isOpen || !supplier) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Supplier Reconciliation Audit (खाते मेळ पडताळणी)
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

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-500">
              Auditing purchase bills, ledger entries, and payment allocations...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          ) : report ? (
            <div className="space-y-4">
              {/* Status Banner */}
              <div
                className={`flex items-center gap-3 rounded-xl border p-4 ${
                  report.isConsistent
                    ? 'border-green-200 bg-green-50 text-green-900'
                    : 'border-red-200 bg-red-50 text-red-900'
                }`}
              >
                {report.isConsistent ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
                ) : (
                  <AlertOctagon className="h-6 w-6 text-red-600 shrink-0" />
                )}
                <div>
                  <div className="font-bold text-sm">
                    {report.isConsistent
                      ? 'Reconciliation Status: 100% Consistent (सर्व हिशोब जुळला आहे)'
                      : 'Reconciliation Warning: Discrepancies Detected (विसंगती आढळली)'}
                  </div>
                  <div className="text-xs text-gray-600">
                    {report.isConsistent
                      ? 'Ledger debits/credits match all received purchase invoices and recorded payments.'
                      : 'Financial anomalies detected. Please review the detailed flags below.'}
                  </div>
                </div>
              </div>

              {/* Metric Breakdown */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">Current Ledger Balance</div>
                  <div className="text-base font-bold text-gray-900">
                    ₹{((report.ledgerBalancePaise || 0) / 100).toFixed(2)}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">Received Purchases Total</div>
                  <div className="text-base font-bold text-gray-900">
                    ₹{((report.totalReceivedPurchasesPaise || 0) / 100).toFixed(2)}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">Payments Recorded</div>
                  <div className="text-base font-bold text-gray-900">
                    ₹{((report.totalPaymentsPaise || 0) / 100).toFixed(2)}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">Active Purchases / Allocations</div>
                  <div className="text-base font-bold text-gray-900">
                    {report.activePurchasesCount || 0} Bills / {report.totalAllocationsCount || 0} Allocs
                  </div>
                </div>
              </div>

              {/* Anomalies List */}
              {report.anomalies?.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
                  <h4 className="mb-2 text-xs font-bold uppercase text-red-900">
                    Detected Discrepancies ({report.anomalies.length}):
                  </h4>
                  <ul className="space-y-2 text-xs text-red-800">
                    {report.anomalies.map((anom, idx) => (
                      <li key={idx} className="rounded-lg bg-white p-2 border border-red-200">
                        <div className="font-semibold">{anom.type}</div>
                        {anom.purchaseNumber && (
                          <div>Purchase: {anom.purchaseNumber}</div>
                        )}
                        {anom.recordedPaidPaise !== undefined && (
                          <div>
                            Recorded Paid: ₹{(anom.recordedPaidPaise / 100).toFixed(2)} |
                            Allocated Sum: ₹{(anom.allocatedSumPaise / 100).toFixed(2)}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-gray-900 px-5 py-2 text-xs font-semibold text-white hover:bg-gray-800"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
