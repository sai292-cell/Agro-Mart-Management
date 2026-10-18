import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { getCustomerReconciliationReportApi } from '../../services/api';

export default function ReconciliationReportModal({ customerId = null, onClose }) {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const formatCurrency = (paise) => '₹' + ((Number(paise) || 0) / 100).toFixed(2);

  const loadReport = async () => {
    setLoading(true);
    setError('');
    try {
      const params = customerId ? { customerId } : {};
      const res = await getCustomerReconciliationReportApi(params);
      setReportData(res);
    } catch (err) {
      setError(err.message || 'Failed to load reconciliation audit report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [customerId]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#166534]" />
            <h2 className="text-base font-bold text-slate-800">
              Financial Integrity & Reconciliation Audit / खाते पडताळणी अहवाल
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-800">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#166534]" />
              <span>Running mathematical reconciliation on ledger entries, invoice debts, and payments...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 text-rose-800 rounded-lg">{error}</div>
          ) : !reportData ? (
            <div className="text-center py-6 text-slate-400">No report available.</div>
          ) : (
            <div className="space-y-4">
              {/* Top Banner Status */}
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  reportData.isFullyReconciled || reportData.report?.isConsistent
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {reportData.isFullyReconciled || reportData.report?.isConsistent ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className="font-bold text-sm">
                    {reportData.isFullyReconciled || reportData.report?.isConsistent
                      ? 'All Accounts Mathematically Reconciled (100% Consistent)'
                      : 'Audit Discrepancies or Policy Breaches Detected'}
                  </h3>
                  <p className="mt-0.5 text-slate-600">
                    System verifies that sum of debits minus credits equals current balance, and checks against invoice debt.
                  </p>
                </div>
              </div>

              {/* Single Customer Audit Display */}
              {reportData.report && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between font-bold text-slate-900 border-b border-slate-200 pb-2">
                    <span>Farmer: {reportData.report.customerName}</span>
                    <Badge variant={reportData.report.isConsistent ? 'success' : 'danger'}>
                      {reportData.report.isConsistent ? 'PASS' : 'FLAGGED'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div>Latest Ledger Balance: <strong className="font-mono">{formatCurrency(reportData.report.latestBalancePaise)}</strong></div>
                    <div>Calculated Debits - Credits: <strong className="font-mono">{formatCurrency(reportData.report.calculatedLedgerBalancePaise)}</strong></div>
                    <div>Approved Credit Limit: <strong className="font-mono">{formatCurrency(reportData.report.creditLimitPaise)}</strong></div>
                    <div>Total Payments Recorded: <strong className="font-mono">{formatCurrency(reportData.report.totalPaymentsReceivedPaise)}</strong></div>
                  </div>

                  {reportData.report.discrepancies?.length > 0 && (
                    <div className="mt-3 p-3 bg-rose-100/60 rounded-lg border border-rose-200 text-rose-800 space-y-1">
                      <p className="font-bold">Detected Flags:</p>
                      {reportData.report.discrepancies.map((d, dIdx) => (
                        <p key={dIdx} className="text-[11px]">
                          • <strong>[{d.code}]</strong>: {d.message}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Shop-Wide Summary List */}
              {reportData.reports && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
                    <span>Total Customers Audited: {reportData.totalCustomersAudited}</span>
                    <span>Discrepancies: {reportData.discrepanciesCount}</span>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {reportData.reports.map((r, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                          r.isConsistent ? 'bg-white border-slate-200' : 'bg-rose-50/60 border-rose-300'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-slate-900">{r.customerName}</p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            Balance: {formatCurrency(r.latestBalancePaise)} | Limit: {formatCurrency(r.creditLimitPaise)}
                          </p>
                        </div>
                        <Badge variant={r.isConsistent ? 'success' : 'danger'}>
                          {r.isConsistent ? 'Audit Clean' : `${r.discrepancies?.length || 1} Flags`}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Report
          </Button>
        </div>
      </div>
    </div>
  );
}
