import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wallet,
  Lock,
  Unlock,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  AlertTriangle,
  CheckCircle,
  Smartphone,
  Building,
  RefreshCw,
} from 'lucide-react';
import { getActiveCashSessionApi, getCashSessionsApi, getCashMovementsApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import OpenDrawerModal from '../../components/cashbook/OpenDrawerModal';
import CloseDrawerModal from '../../components/cashbook/CloseDrawerModal';

export default function CashbookPage() {
  const { t, i18n } = useTranslation();
  const isMr = i18n.language === 'mr';
  const { user } = useAuth();
  const isManagerOrOwner = user?.role === 'OWNER' || user?.role === 'MANAGER';

  const [activeSession, setActiveSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [movements, setMovements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [activeRes, sessionsRes, movementsRes] = await Promise.all([
        getActiveCashSessionApi(),
        getCashSessionsApi({ limit: 15 }),
        getCashMovementsApi(),
      ]);

      setActiveSession(activeRes);
      setSessions(sessionsRes.data || []);
      setMovements(movementsRes);
    } catch (err) {
      setError(err.message || 'Failed to load cashbook data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-text-main flex items-center space-x-2 text-2xl font-black">
            <Wallet className="text-primary h-7 w-7" />
            <span>{isMr ? 'दैनंदिन रोखवही (Cashbook & Drawer)' : 'Cashbook & Drawer'}</span>
          </h1>
          <p className="text-text-muted text-sm">
            {isMr
              ? 'भौतिक कॅश ड्रॉवर, रोख आवक-जावक, सत्र व्यवस्थापन आणि डिजिटल व्यवहारांचे पृथक्करण'
              : 'Physical cash drawer sessions, cash inflows/outflows, and digital fund segregation'}
          </p>
        </div>

        <button
          onClick={fetchData}
          className="border-border text-text-muted hover:text-text-main flex items-center space-x-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          <span>{isMr ? 'ताजे करा' : 'Refresh'}</span>
        </button>
      </div>

      {/* Active Cash Drawer Hero Card */}
      <div className="bg-surface border-border overflow-hidden rounded-2xl border shadow-sm">
        <div className="border-border flex flex-col justify-between gap-4 border-b p-6 sm:flex-row sm:items-center">
          <div className="flex items-center space-x-3">
            <div
              className={`rounded-xl p-3 ${
                activeSession
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-amber-500/10 text-amber-600'
              }`}
            >
              {activeSession ? <Unlock className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-text-main text-lg font-bold">
                  {isMr ? 'कॅश ड्रॉवर स्थिती' : 'Cash Drawer Status'}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-black uppercase ${
                    activeSession
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {activeSession ? (isMr ? 'सत्र सुरू आहे (OPEN)' : 'SESSION OPEN') : isMr ? 'सत्र बंद आहे (CLOSED)' : 'SESSION CLOSED'}
                </span>
              </div>
              <p className="text-text-muted text-xs">
                {activeSession
                  ? `${isMr ? 'सत्र' : 'Session'} #${activeSession.sessionNumber} • ${isMr ? 'सुरू केले' : 'Opened by'} ${
                      activeSession.openedBy?.name || 'Staff'
                    } (${new Date(activeSession.openedAt).toLocaleTimeString()})`
                  : isMr
                  ? 'विक्री सुरू करण्यासाठी प्रथम ड्रॉवर सत्र सुरू करा'
                  : 'Open drawer session before initiating cash sales'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {activeSession ? (
              <button
                onClick={() => setIsCloseModalOpen(true)}
                className="bg-amber-600 hover:bg-amber-700 flex items-center space-x-2 rounded-xl px-4 py-2.5 font-bold text-white shadow-sm transition-all active:scale-95"
              >
                <Lock className="h-4 w-4" />
                <span>{isMr ? 'ड्रॉवर बंद करा' : 'Close Drawer Session'}</span>
              </button>
            ) : (
              <button
                onClick={() => setIsOpenModalOpen(true)}
                className="bg-primary hover:bg-primary-hover flex items-center space-x-2 rounded-xl px-4 py-2.5 font-bold text-white shadow-sm transition-all active:scale-95"
              >
                <Unlock className="h-4 w-4" />
                <span>{isMr ? 'नवीन सत्र सुरू करा' : 'Open Drawer Session'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Drawer Numbers */}
        {activeSession && (
          <div className="grid grid-cols-1 divide-border divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="p-6">
              <span className="text-text-muted text-xs font-semibold uppercase">
                {isMr ? 'सुरुवातीची रोकड (Opening Float)' : 'Opening Cash Float'}
              </span>
              <div className="text-text-main mt-1 text-2xl font-black">
                ₹{((activeSession.openingCashPaise || 0) / 100).toFixed(2)}
              </div>
              <p className="text-text-muted mt-1 text-xs">
                {isMr ? 'सकाळची मोजलेली रोकड' : 'counted at session opening'}
              </p>
            </div>

            <div className="p-6">
              <span className="text-text-muted text-xs font-semibold uppercase">
                {isMr ? 'सध्याची निव्वळ आवक-जावक' : 'Net Cash Movement'}
              </span>
              <div className="mt-1 text-2xl font-black text-emerald-600">
                +₹{((activeSession.liveMovements?.cash?.netMovementPaise || 0) / 100).toFixed(2)}
              </div>
              <p className="text-text-muted mt-1 text-xs">
                +{isMr ? 'रोख विक्री' : 'sales'} - {isMr ? 'खर्च' : 'expenses'}
              </p>
            </div>

            <div className="bg-primary/5 p-6">
              <span className="text-primary text-xs font-black uppercase">
                {isMr ? 'ड्रॉवरमधील अपेक्षित रोकड (Expected Cash)' : 'Live Expected Drawer Cash'}
              </span>
              <div className="text-primary mt-1 text-3xl font-black">
                ₹{((activeSession.liveExpectedCashPaise || 0) / 100).toFixed(2)}
              </div>
              <p className="text-text-muted mt-1 text-xs">
                {isMr ? 'बंद करताना प्रत्यक्ष मोजणीशी पडताळा' : 'must match counted closing cash'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Movement Breakdown Cards */}
      {movements && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Physical Cash Movements */}
          <div className="bg-surface border-border rounded-xl border p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <Wallet className="text-emerald-600 h-5 w-5" />
                <h3 className="text-text-main font-bold">
                  {isMr ? 'आजची रोख आवक-जावक (Physical Cash)' : "Today's Cash Flow"}
                </h3>
              </div>
              <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-md px-2 py-0.5 text-xs font-bold">
                {isMr ? 'ड्रॉवरमधील रोकड' : 'Drawer Cash'}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted flex items-center space-x-1.5">
                  <ArrowDownRight className="text-emerald-600 h-4 w-4" />
                  <span>{isMr ? 'थेट रोख विक्री (POS Sales):' : 'Cash POS Sales:'}</span>
                </span>
                <span className="text-text-main font-bold">
                  +₹{((movements.cash.inflows.salesPaise || 0) / 100).toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted flex items-center space-x-1.5">
                  <ArrowDownRight className="text-emerald-600 h-4 w-4" />
                  <span>{isMr ? 'शेतकरी उधारी रोख वसुली:' : 'Customer Credit Collections:'}</span>
                </span>
                <span className="text-text-main font-bold">
                  +₹{((movements.cash.inflows.collectionsPaise || 0) / 100).toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted flex items-center space-x-1.5">
                  <ArrowUpRight className="text-red-600 h-4 w-4" />
                  <span>{isMr ? 'सप्लायर रोख देयके:' : 'Supplier Cash Payments:'}</span>
                </span>
                <span className="text-red-600 font-bold">
                  -₹{((movements.cash.outflows.supplierPaymentsPaise || 0) / 100).toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted flex items-center space-x-1.5">
                  <ArrowUpRight className="text-red-600 h-4 w-4" />
                  <span>{isMr ? 'रोख दुकान खर्च:' : 'Cash Operating Expenses:'}</span>
                </span>
                <span className="text-red-600 font-bold">
                  -₹{((movements.cash.outflows.expensesPaise || 0) / 100).toFixed(2)}
                </span>
              </div>

              <div className="border-border flex items-center justify-between border-t pt-3 font-black text-base">
                <span className="text-text-main">{isMr ? 'एकूण निव्वळ रोख प्रवाह:' : 'Net Cash Movement:'}</span>
                <span className="text-primary">
                  ₹{((movements.cash.netMovementPaise || 0) / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Digital Channels (Physically Segregated from Drawer) */}
          <div className="bg-surface border-border rounded-xl border p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <Smartphone className="text-purple-600 h-5 w-5" />
                <h3 className="text-text-main font-bold">
                  {isMr ? 'डिजिटल व्यवहार (UPI & Bank)' : 'Digital Channels'}
                </h3>
              </div>
              <span className="bg-purple-500/10 text-purple-700 dark:text-purple-400 rounded-md px-2 py-0.5 text-xs font-bold">
                {isMr ? 'बँक खात्यात थेट जमा' : 'Non-Drawer Funds'}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted flex items-center space-x-1.5">
                  <Smartphone className="text-purple-600 h-4 w-4" />
                  <span>{isMr ? 'यूपीआय विक्री आवक:' : 'UPI Sales Inflow:'}</span>
                </span>
                <span className="text-text-main font-bold">
                  +₹{((movements.upi.salesPaise || 0) / 100).toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted flex items-center space-x-1.5">
                  <Smartphone className="text-purple-600 h-4 w-4" />
                  <span>{isMr ? 'यूपीआय उधारी जमा:' : 'UPI Credit Collections:'}</span>
                </span>
                <span className="text-text-main font-bold">
                  +₹{((movements.upi.collectionsPaise || 0) / 100).toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted flex items-center space-x-1.5">
                  <Building className="text-blue-600 h-4 w-4" />
                  <span>{isMr ? 'बँक ट्रान्सफर विक्री:' : 'Bank Transfer Inflow:'}</span>
                </span>
                <span className="text-text-main font-bold">
                  +₹{((movements.bank.salesPaise || 0) / 100).toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted flex items-center space-x-1.5">
                  <ArrowUpRight className="text-red-600 h-4 w-4" />
                  <span>{isMr ? 'डिजिटल खर्च व सप्लायर देयके:' : 'Digital Outflow (Supplier/Expense):'}</span>
                </span>
                <span className="text-red-600 font-bold">
                  -₹{(((movements.upi.totalOutflowPaise || 0) + (movements.bank.totalOutflowPaise || 0)) / 100).toFixed(2)}
                </span>
              </div>

              <div className="border-border flex items-center justify-between border-t pt-3 text-xs text-text-muted">
                <span>{isMr ? 'टीप: यूपीआय व बँक रक्कम कॅश ड्रॉवरमध्ये मोजली जात नाही.' : 'Note: Digital payments bypass physical cash drawer completely.'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cash Drawer Sessions History Table */}
      <div className="bg-surface border-border overflow-hidden rounded-xl border shadow-xs">
        <div className="border-border border-b px-5 py-4">
          <h3 className="text-text-main font-bold">
            {isMr ? 'कॅश ड्रॉवर सत्र इतिहास' : 'Drawer Sessions History'}
          </h3>
        </div>

        {sessions.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            {isMr ? 'कोणतेही बंद झालेले सत्र सापडले नाही' : 'No past sessions recorded'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-alt border-border text-text-muted border-b text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">{isMr ? 'सत्र क्र.' : 'Session #'}</th>
                  <th className="px-4 py-3">{isMr ? 'सुरुवात दिनांक' : 'Opened'}</th>
                  <th className="px-4 py-3">{isMr ? 'बंद दिनांक' : 'Closed'}</th>
                  <th className="px-4 py-3 text-right">{isMr ? 'सुरुवातीची रोकड' : 'Opening'}</th>
                  <th className="px-4 py-3 text-right">{isMr ? 'अपेक्षित रोकड' : 'Expected'}</th>
                  <th className="px-4 py-3 text-right">{isMr ? 'प्रत्यक्ष रोकड' : 'Counted'}</th>
                  <th className="px-4 py-3 text-center">{isMr ? 'तफावत' : 'Variance'}</th>
                  <th className="px-4 py-3">{isMr ? 'शेरा' : 'Notes'}</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {sessions.map((s) => (
                  <tr key={s._id} className="hover:bg-surface-alt/50 transition-colors">
                    <td className="text-text-main px-4 py-3 font-semibold whitespace-nowrap">
                      {s.sessionNumber}
                    </td>
                    <td className="text-text-muted px-4 py-3 text-xs whitespace-nowrap">
                      {new Date(s.openedAt).toLocaleDateString()} {new Date(s.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="text-text-muted px-4 py-3 text-xs whitespace-nowrap">
                      {s.closedAt
                        ? `${new Date(s.closedAt).toLocaleDateString()} ${new Date(s.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : isMr
                        ? 'सुरू आहे'
                        : 'Active'}
                    </td>
                    <td className="text-text-main px-4 py-3 text-right font-medium whitespace-nowrap">
                      ₹{((s.openingCashPaise || 0) / 100).toFixed(2)}
                    </td>
                    <td className="text-text-main px-4 py-3 text-right font-medium whitespace-nowrap">
                      {s.expectedCashPaise !== null ? `₹${((s.expectedCashPaise || 0) / 100).toFixed(2)}` : '-'}
                    </td>
                    <td className="text-text-main px-4 py-3 text-right font-bold whitespace-nowrap">
                      {s.closingCashCountedPaise !== null
                        ? `₹${((s.closingCashCountedPaise || 0) / 100).toFixed(2)}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {s.variancePaise === null ? (
                        <span className="text-text-muted text-xs">-</span>
                      ) : s.variancePaise === 0 ? (
                        <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-full px-2 py-0.5 text-xs font-semibold">
                          ₹0.00
                        </span>
                      ) : (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            s.variancePaise > 0
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                              : 'bg-red-500/10 text-red-700 dark:text-red-400'
                          }`}
                        >
                          {s.variancePaise > 0 ? '+' : ''}₹{((s.variancePaise || 0) / 100).toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="text-text-muted px-4 py-3 max-w-xs truncate text-xs">
                      {s.closingNotes || s.openingNotes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <OpenDrawerModal
        isOpen={isOpenModalOpen}
        onClose={() => setIsOpenModalOpen(false)}
        onSuccess={fetchData}
      />

      <CloseDrawerModal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        activeSession={activeSession}
        onSuccess={fetchData}
      />
    </div>
  );
}
