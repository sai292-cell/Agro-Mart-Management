import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Printer, Calendar, FileText, Download } from 'lucide-react';
import { getSupplierStatementApi } from '../../services/api';

export default function SupplierStatementModal({ isOpen, onClose, supplier }) {
  const { t } = useTranslation();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [statementData, setStatementData] = useState(null);
  const [error, setError] = useState(null);

  const fetchStatement = async () => {
    if (!supplier) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getSupplierStatementApi(supplier._id, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: 100,
      });
      setStatementData(res.data);
    } catch (err) {
      setError(err.message || 'Failed to fetch statement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && supplier) {
      // Default to last 90 days
      const d = new Date();
      d.setDate(d.getDate() - 90);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(new Date().toISOString().slice(0, 10));
      fetchStatement();
    }
  }, [isOpen, supplier]);

  if (!isOpen || !supplier) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[95vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header - Screen only */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Supplier Statement / Passbook (पुरवठादार खातेवही)
              </h2>
              <p className="text-xs text-gray-500">{supplier.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-gray-800"
            >
              <Printer className="h-4 w-4" />
              <span>Print Statement (प्रिंट करा)</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Date Filter Bar - Screen only */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/50 px-6 py-3 print:hidden">
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="font-semibold text-gray-700">Date Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs focus:border-green-600 focus:outline-hidden"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs focus:border-green-600 focus:outline-hidden"
            />
            <button
              onClick={fetchStatement}
              disabled={loading}
              className="rounded-lg bg-green-700 px-3 py-1 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-50"
            >
              Filter
            </button>
          </div>
          {statementData && (
            <div className="text-xs font-semibold text-gray-700">
              Current Net Balance:{' '}
              <span className="text-sm font-bold text-gray-900">
                ₹{(statementData.currentBalancePaise / 100).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Printable Passbook Body */}
        <div className="flex-1 overflow-y-auto p-6 printable-area">
          {/* Printable Mart Header */}
          <div className="mb-6 border-b border-gray-200 pb-4 text-center">
            <h1 className="text-xl font-black tracking-wide text-gray-900 uppercase">
              Shivshree Agro Mart (शिवश्री ॲग्रो मार्ट)
            </h1>
            <p className="text-xs text-gray-600">
              Seeds, Fertilizers, Pesticides & Agricultural Equipment | Nashik, Maharashtra
            </p>
            <div className="mt-2 inline-block rounded-md border border-gray-300 bg-gray-50 px-3 py-1 text-xs font-bold text-gray-800">
              SUPPLIER ACCOUNTS PAYABLE STATEMENT (पुरवठादार खातेवही उतारा)
            </div>
          </div>

          {/* Supplier Info Summary */}
          <div className="mb-4 grid grid-cols-2 gap-4 rounded-xl border border-gray-200 p-4 text-xs">
            <div>
              <div className="font-bold text-sm text-gray-900">{supplier.name}</div>
              <div className="text-gray-600">{supplier.address}</div>
              {supplier.villageCity && (
                <div className="text-gray-600">
                  {supplier.villageCity}, {supplier.district}
                </div>
              )}
              {supplier.phone && <div className="text-gray-600">Ph: {supplier.phone}</div>}
              {supplier.taxDetails?.gstin && (
                <div className="font-semibold text-gray-800">GSTIN: {supplier.taxDetails.gstin}</div>
              )}
            </div>
            <div className="text-right">
              <div className="text-gray-500">Statement Period:</div>
              <div className="font-semibold text-gray-800">
                {startDate ? new Date(startDate).toLocaleDateString() : 'Beginning'} -{' '}
                {endDate ? new Date(endDate).toLocaleDateString() : 'Present'}
              </div>
              <div className="mt-2 text-gray-500">Opening Balance:</div>
              <div className="font-bold text-sm text-gray-900">
                ₹{((statementData?.openingBalancePaise || 0) / 100).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-500">Loading statement records...</div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-600">
              {error}
            </div>
          ) : statementData?.entries?.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              No transactions recorded in this period.
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-gray-300 bg-gray-100 text-gray-700">
                  <th className="py-2.5 px-3">Date (तारीख)</th>
                  <th className="py-2.5 px-3">Particulars (तपशील)</th>
                  <th className="py-2.5 px-3 text-right">Debit / Paid (नावे ₹)</th>
                  <th className="py-2.5 px-3 text-right">Credit / Bill (जमा ₹)</th>
                  <th className="py-2.5 px-3 text-right">Balance (बाकी ₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {/* Opening balance row if start date filtered */}
                {startDate && (
                  <tr className="bg-gray-50 font-semibold text-gray-700">
                    <td className="py-2 px-3">{new Date(startDate).toLocaleDateString()}</td>
                    <td className="py-2 px-3">Opening Balance (आरंभीची बाकी)</td>
                    <td className="py-2 px-3 text-right">—</td>
                    <td className="py-2 px-3 text-right">—</td>
                    <td className="py-2 px-3 text-right">
                      ₹{((statementData?.openingBalancePaise || 0) / 100).toFixed(2)}
                    </td>
                  </tr>
                )}

                {statementData?.entries.map((entry) => {
                  const isDebit = entry.transactionType === 'DEBIT';
                  const isCredit = entry.transactionType === 'CREDIT';

                  return (
                    <tr
                      key={entry._id}
                      className={entry.isReversed ? 'bg-red-50/40 text-gray-400 line-through' : ''}
                    >
                      <td className="py-2.5 px-3 text-gray-600">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-gray-900">{entry.description}</div>
                        {entry.isReversed && (
                          <span className="text-[10px] text-red-600">[Reversed Entry]</span>
                        )}
                        {entry.notes && (
                          <div className="text-[11px] text-gray-400">{entry.notes}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-emerald-700">
                        {isDebit ? `₹${(entry.amountPaise / 100).toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-red-700">
                        {isCredit ? `₹${(entry.amountPaise / 100).toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                        ₹{(entry.runningBalancePaise / 100).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-800 bg-gray-50 font-bold text-gray-900">
                  <td colSpan="4" className="py-3 px-3 text-right text-sm">
                    Closing Outstanding Payable (अखेर देय बाकी):
                  </td>
                  <td className="py-3 px-3 text-right text-base text-gray-950">
                    ₹{((statementData?.currentBalancePaise || 0) / 100).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}

          {/* Signatures */}
          <div className="mt-12 hidden grid-cols-2 pt-8 text-xs text-gray-600 print:grid">
            <div>
              <div className="border-t border-gray-400 pt-2 w-48">Verified by Staff / Accountant</div>
            </div>
            <div className="text-right">
              <div className="border-t border-gray-400 pt-2 w-48 ml-auto">
                For Shivshree Agro Mart
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
