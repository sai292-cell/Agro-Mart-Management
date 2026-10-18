import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calendar,
  CheckCircle,
  AlertTriangle,
  Wallet,
  Printer,
  Smartphone,
  Building,
  RefreshCw,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
  FileText,
} from 'lucide-react';
import { getDailyClosingSummaryApi } from '../../services/api';

export default function DailyClosingPage() {
  const { t, i18n } = useTranslation();
  const isMr = i18n.language === 'mr';

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getDailyClosingSummaryApi({ date });
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to fetch daily closing summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [date]);

  const handlePrint = () => {
    window.print();
  };

  const rec = data?.reconciliation;
  const session = data?.session;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-text-main flex items-center space-x-2 text-2xl font-black">
            <CheckCircle className="text-primary h-7 w-7" />
            <span>{isMr ? 'दिवसअखेर ताळेबंद (Daily Closing)' : 'Daily Closing & Reconciliation'}</span>
          </h1>
          <p className="text-text-muted text-sm">
            {isMr
              ? 'दैनिक रोकड मेळ, अपेक्षित विरुद्ध प्रत्यक्ष रोकड, आणि डिजिटल व्यवहारांचा ताळेबंद'
              : 'End-of-day physical cash reconciliation, expected vs counted cash, and transaction audit'}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-surface border-border text-text-main focus:border-primary rounded-xl border px-3 py-2 text-sm font-semibold focus:outline-none"
          />

          <button
            onClick={handlePrint}
            className="border-border text-text-main hover:bg-surface-alt flex items-center space-x-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors shadow-xs"
          >
            <Printer className="h-4 w-4" />
            <span>{isMr ? 'प्रिंट काढा' : 'Print Report'}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-text-muted">
          <span>{isMr ? 'ताळेबंद मोजणी सुरू आहे...' : 'Calculating daily reconciliation...'}</span>
        </div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center space-y-2 text-red-500">
          <AlertTriangle className="h-8 w-8" />
          <span>{error}</span>
        </div>
      ) : !data ? null : (
        <div className="space-y-6">
          {/* Main Reconciliation Status Card */}
          <div className="bg-surface border-border overflow-hidden rounded-2xl border shadow-xs">
            <div className="border-border flex flex-col justify-between gap-3 border-b p-6 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-text-main text-lg font-bold">
                  {isMr ? `${date} चा दिवसअखेर ताळेबंद` : `Daily Cash Reconciliation for ${date}`}
                </h2>
                <p className="text-text-muted text-xs">
                  {session
                    ? `${isMr ? 'कॅश ड्रॉवर सत्र' : 'Drawer Session'} #${session.sessionNumber} (${session.status})`
                    : isMr
                    ? 'या तारखेला कोणतेही कॅश ड्रॉवर सत्र आढळले नाही'
                    : 'No drawer session recorded for this date'}
                </p>
              </div>

              <div>
                {session?.status === 'CLOSED' ? (
                  rec.hasVariance ? (
                    <div className="flex items-center space-x-2 rounded-full border border-red-500/20 bg-red-500/10 px-3.5 py-1 text-sm font-bold text-red-700 dark:text-red-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span>
                        {isMr ? 'तफावत आढळली:' : 'Variance:'} {rec.cashVariancePaise > 0 ? '+' : ''}₹
                        {((rec.cashVariancePaise || 0) / 100).toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle className="h-4 w-4" />
                      <span>{isMr ? 'तंतोतंत मेळ बसला (₹0.00)' : 'Perfect Reconciliation (₹0.00)'}</span>
                    </div>
                  )
                ) : (
                  <div className="flex items-center space-x-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3.5 py-1 text-sm font-bold text-amber-700 dark:text-amber-400">
                    <Clock className="h-4 w-4" />
                    <span>{isMr ? 'सत्र बंद झालेले नाही' : 'Session Not Closed Yet'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Reconciliation Math Grid */}
            <div className="grid grid-cols-2 divide-border divide-y sm:grid-cols-4 sm:divide-x sm:divide-y-0">
              <div className="p-5">
                <span className="text-text-muted text-xs font-semibold uppercase">
                  {isMr ? 'सुरुवातीची रोकड' : 'Opening Float'}
                </span>
                <div className="text-text-main mt-1 text-xl font-bold">
                  ₹{((rec.openingCashPaise || 0) / 100).toFixed(2)}
                </div>
              </div>

              <div className="p-5">
                <span className="text-text-muted text-xs font-semibold uppercase">
                  + {isMr ? 'एकूण रोख आवक' : 'Total Cash Inflow'}
                </span>
                <div className="mt-1 text-xl font-bold text-emerald-600">
                  +₹{((rec.totalCashInflowPaise || 0) / 100).toFixed(2)}
                </div>
              </div>

              <div className="p-5">
                <span className="text-text-muted text-xs font-semibold uppercase">
                  - {isMr ? 'एकूण रोख जावक' : 'Total Cash Outflow'}
                </span>
                <div className="mt-1 text-xl font-bold text-red-600">
                  -₹{((rec.totalCashOutflowPaise || 0) / 100).toFixed(2)}
                </div>
              </div>

              <div className="bg-primary/5 p-5">
                <span className="text-primary text-xs font-bold uppercase">
                  = {isMr ? 'अपेक्षित दिवसअखेर रोकड' : 'Expected Closing Cash'}
                </span>
                <div className="text-primary mt-1 text-2xl font-black">
                  ₹{((rec.expectedClosingCashPaise || 0) / 100).toFixed(2)}
                </div>
                {session?.status === 'CLOSED' && (
                  <div className="text-text-muted mt-1 text-xs">
                    {isMr ? 'प्रत्यक्ष मोजलेली:' : 'Counted:'} ₹{((rec.actualCountedCashPaise || 0) / 100).toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Details 2-Column Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Cash Detail */}
            <div className="bg-surface border-border rounded-xl border p-5 shadow-xs space-y-4">
              <h3 className="text-text-main font-bold flex items-center space-x-2 border-b border-border pb-3">
                <Wallet className="h-5 w-5 text-emerald-600" />
                <span>{isMr ? 'रोख व्यवहारांचा सविस्तर ताळेबंद' : 'Cash Movements Detail'}</span>
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">{isMr ? '१. थेट रोख विक्री (POS Cash Sales):' : '1. POS Cash Sales:'}</span>
                  <span className="font-semibold text-text-main">+₹{((rec.cashSalesPaise || 0) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">{isMr ? '२. शेतकरी उधारी रोख जमा (Credit Collections):' : '2. Farmer Credit Cash Collections:'}</span>
                  <span className="font-semibold text-text-main">+₹{((rec.cashCreditCollectionsPaise || 0) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">{isMr ? '३. सप्लायर खरेदी रोख देयके (Supplier Payments):' : '3. Cash Supplier Payments:'}</span>
                  <span className="font-semibold text-red-600">-₹{((rec.cashSupplierPaymentsPaise || 0) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">{isMr ? '४. रोख दुकान खर्च (Cash Expenses):' : '4. Cash Operating Expenses:'}</span>
                  <span className="font-semibold text-red-600">-₹{((rec.cashExpensesPaise || 0) / 100).toFixed(2)}</span>
                </div>
              </div>

              {session?.closingNotes && (
                <div className="bg-surface-alt rounded-lg p-3 text-xs border border-border mt-3">
                  <span className="font-semibold text-text-main">{isMr ? 'सत्र शेरा:' : 'Closing Notes:'} </span>
                  <span className="text-text-muted">{session.closingNotes}</span>
                </div>
              )}
            </div>

            {/* Digital & Credit Detail */}
            <div className="bg-surface border-border rounded-xl border p-5 shadow-xs space-y-4">
              <h3 className="text-text-main font-bold flex items-center space-x-2 border-b border-border pb-3">
                <Smartphone className="h-5 w-5 text-purple-600" />
                <span>{isMr ? 'डिजिटल व उधारी व्यवहार (Non-Drawer)' : 'Digital & Credit Activities'}</span>
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">{isMr ? '१. यूपीआय एकूण आवक (UPI Sales & Khata):' : '1. UPI Inflows:'}</span>
                  <span className="font-semibold text-purple-600">
                    ₹{((data.digitalChannels?.upi?.totalInflowPaise || 0) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">{isMr ? '२. बँक ट्रान्सफर आवक (Bank Inflows):' : '2. Bank Inflows:'}</span>
                  <span className="font-semibold text-blue-600">
                    ₹{((data.digitalChannels?.bank?.totalInflowPaise || 0) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">{isMr ? '३. आज झालेली नवीन उधारी विक्री (New Credit):' : '3. New Credit Sales:'}</span>
                  <span className="font-semibold text-amber-600">
                    ₹{((data.credit?.newCreditSalesPaise || 0) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">{isMr ? '४. एकूण उधारी वसुली (All Collections):' : '4. Total Credit Collections:'}</span>
                  <span className="font-semibold text-emerald-600">
                    ₹{((data.credit?.collectionsPaise || 0) / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-surface-alt p-3 text-xs text-text-muted">
                {isMr
                  ? 'सुरक्षा पडताळणी: डिजिटल खात्यांचे व्यवहार थेट बँक खात्यात वर्ग होतात. रोख ड्रॉवरमध्ये केवळ प्रत्यक्ष चलन मोजले जाते.'
                  : 'Accounting note: Digital funds settle directly to bank accounts and are excluded from the physical cash drawer.'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
