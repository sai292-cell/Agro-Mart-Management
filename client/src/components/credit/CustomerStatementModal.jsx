import React, { useState, useEffect } from 'react';
import { X, Printer, Calendar, RefreshCw, AlertCircle, FileText } from 'lucide-react';
import Button from '../common/Button';
import { getCustomerStatementApi } from '../../services/api';

export default function CustomerStatementModal({ customer, onClose }) {
  const [entries, setEntries] = useState([]);
  const [openingBalancePaise, setOpeningBalancePaise] = useState(0);
  const [totalDebits, setTotalDebits] = useState(0);
  const [totalCredits, setTotalCredits] = useState(0);
  const [latestBalancePaise, setLatestBalancePaise] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const formatCurrency = (paise) => '₹' + ((Number(paise) || 0) / 100).toFixed(2);
  const formatDate = (date) => new Date(date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

  const loadStatement = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { limit: 150 };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await getCustomerStatementApi(customer._id, params);
      setEntries(res.entries || []);
      setOpeningBalancePaise(res.openingBalancePaise || 0);
      setTotalDebits(res.totalPeriodDebits || 0);
      setTotalCredits(res.totalPeriodCredits || 0);
      setLatestBalancePaise(res.latestBalancePaise || 0);
    } catch (err) {
      setError(err.message || 'Failed to load statement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatement();
  }, [customer]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header - Hidden on Print */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#166534]" />
            <h2 className="text-base font-bold text-slate-800">
              Customer Passbook Statement / शेतकरी खातेवही ({customer.name})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={Printer}
              onClick={handlePrint}
              className="bg-[#166534] hover:bg-[#14532d]"
            >
              Print Statement / छापा
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Date Filter Bar - Hidden on Print */}
        <div className="px-6 py-3 bg-slate-100/60 border-b border-slate-200 flex flex-wrap items-center gap-3 text-xs print:hidden">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-slate-600">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded bg-white text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded bg-white text-xs"
            />
          </div>
          <Button variant="outline" size="sm" onClick={loadStatement} className="py-1 text-xs">
            Filter Period
          </Button>
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="text-[11px] text-slate-500 hover:underline"
            >
              Reset All Dates
            </button>
          )}
        </div>

        {/* Printable Passbook Body */}
        <div className="p-6 md:p-8 overflow-y-auto text-slate-800" id="printable-statement">
          {/* Shop Header */}
          <div className="border-b-2 border-[#166534] pb-4 mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black text-[#166534]">
                शिवश्री ॲग्रो मार्ट / SHIVSHREE AGRO MART
              </h1>
              <p className="text-xs text-slate-600">
                दुकान नं. ४, कृषी उत्पन्न बाजार समिती, राहुरी, जि. अहिल्यानगर | मो. ९८७६५४३२१०
              </p>
              <p className="text-xs font-bold text-emerald-800 mt-0.5">
                अधिकृत शेतकरी डिजिटल खातेवही पासबुक / Official Credit Statement
              </p>
            </div>
            <div className="text-right text-xs">
              <p className="text-slate-500">तारीख / Date: {new Date().toLocaleDateString('en-IN')}</p>
              <p className="font-bold text-slate-800">
                कालावधी: {startDate ? formatDate(startDate) : 'आरंभापासून'} ते {endDate ? formatDate(endDate) : 'आजपर्यंत'}
              </p>
            </div>
          </div>

          {/* Farmer Info Box */}
          <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500">शेतकरी नाव / Farmer Details:</p>
              <p className="text-sm font-bold text-slate-900">{customer.name}</p>
              {customer.phone && <p className="text-slate-600">मोबाईल: {customer.phone}</p>}
              <p className="text-slate-600">गाव: {customer.village || 'N/A'} {customer.taluka ? `(${customer.taluka})` : ''}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-slate-500">खाते स्थिती / Standing:</p>
              <p className="text-slate-700">मंजूर उधारी मर्यादा: <span className="font-bold">{formatCurrency(customer.creditLimitPaise)}</span></p>
              <p className="text-rose-700 font-bold text-sm mt-0.5">
                चालू बाकी शिल्लक: {formatCurrency(latestBalancePaise)}
              </p>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#166534]" />
              <span>Loading ledger transactions...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 text-rose-800 text-xs rounded-lg">{error}</div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No transactions recorded in this period.
            </div>
          ) : (
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Description / तपशील</th>
                    <th className="py-2.5 px-3 text-right">नावे / Debit (₹)</th>
                    <th className="py-2.5 px-3 text-right">जमा / Credit (₹)</th>
                    <th className="py-2.5 px-3 text-right">शिल्लक / Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {startDate && (
                    <tr className="bg-slate-50/50 italic text-slate-600">
                      <td className="py-2 px-3">{formatDate(startDate)}</td>
                      <td className="py-2 px-3">OPENING</td>
                      <td className="py-2 px-3">-</td>
                      <td className="py-2 px-3">आरंभीची शिल्लक (Opening Balance)</td>
                      <td className="py-2 px-3 text-right">-</td>
                      <td className="py-2 px-3 text-right">-</td>
                      <td className="py-2 px-3 text-right font-bold font-mono">{formatCurrency(openingBalancePaise)}</td>
                    </tr>
                  )}
                  {entries.map((e) => (
                    <tr
                      key={e._id}
                      className={`hover:bg-slate-50/60 ${e.isReversed ? 'text-slate-400 line-through' : ''}`}
                    >
                      <td className="py-2 px-3 whitespace-nowrap text-slate-600">{formatDate(e.createdAt)}</td>
                      <td className="py-2 px-3">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-700">
                          {e.entryType}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono font-medium text-slate-800">{e.referenceId || '-'}</td>
                      <td className="py-2 px-3">
                        <p className="font-medium text-slate-900">{e.description}</p>
                        {e.notes && <p className="text-[10px] text-slate-500 italic">{e.notes}</p>}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-rose-700">
                        {e.transactionType === 'DEBIT' ? formatCurrency(e.amountPaise) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                        {e.transactionType === 'CREDIT' ? formatCurrency(e.amountPaise) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-black text-slate-900">
                        {formatCurrency(e.runningBalancePaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals Box */}
          <div className="w-full sm:w-72 ml-auto bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1 mb-6">
            <div className="flex justify-between text-rose-700 font-semibold">
              <span>एकूण नावे / Total Debits:</span>
              <span className="font-mono">{formatCurrency(totalDebits)}</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>एकूण जमा / Total Credits:</span>
              <span className="font-mono">{formatCurrency(totalCredits)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t-2 border-[#166534] font-black text-sm text-[#166534]">
              <span>चालू बाकी / Net Balance:</span>
              <span className="font-mono text-base">{formatCurrency(latestBalancePaise)}</span>
            </div>
          </div>

          {/* Footer Signature */}
          <div className="pt-4 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
            <div>
              <p>शिवश्री ॲग्रो मार्ट, राहुरी — संगणकीय खातेवही पावती</p>
              <p className="text-[10px]">कोणत्याही विसंगतीबाबत त्वरित दुकानात संपर्क साधावा.</p>
            </div>
            <div className="text-right">
              <div className="w-32 border-b border-slate-400 mb-1"></div>
              <p className="font-semibold text-slate-700">अधिकृत स्वाक्षरी / Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
