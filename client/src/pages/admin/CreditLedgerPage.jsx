import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Search,
  DollarSign,
  CreditCard,
  FileText,
  Sliders,
  RotateCcw,
  BookOpen,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  Plus,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Printer,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Receipt,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import PageContainer from '../../components/layout/PageContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';

import {
  getCustomersApi,
  getCustomerDetailsApi,
  getCustomerStatementApi,
  getInvoicesApi,
} from '../../services/api';

import CollectCreditPaymentModal from '../../components/credit/CollectCreditPaymentModal';
import ManualAdjustmentModal from '../../components/credit/ManualAdjustmentModal';
import OpeningBalanceModal from '../../components/credit/OpeningBalanceModal';
import ReverseEntryModal from '../../components/credit/ReverseEntryModal';
import UpdateCreditLimitModal from '../../components/credit/UpdateCreditLimitModal';
import CustomerStatementModal from '../../components/credit/CustomerStatementModal';
import ReconciliationReportModal from '../../components/credit/ReconciliationReportModal';
import QuickCustomerModal from '../../components/pos/QuickCustomerModal';

export default function CreditLedgerPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const isOwnerOrManager = user?.role === 'OWNER' || user?.role === 'MANAGER';

  // Customer List State
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('ALL'); // 'ALL' | 'HAS_BALANCE' | 'OVERDUE'
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  // Selected Customer Details & Statement
  const [customerDetails, setCustomerDetails] = useState(null);
  const [statementEntries, setStatementEntries] = useState([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [loadingPassbook, setLoadingPassbook] = useState(false);

  // Modals
  const [showCollectPaymentModal, setShowCollectPaymentModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showOpeningBalanceModal, setShowOpeningBalanceModal] = useState(false);
  const [showUpdateLimitModal, setShowUpdateLimitModal] = useState(false);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [entryToReverse, setEntryToReverse] = useState(null);
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);
  const [showNewFarmerModal, setShowNewFarmerModal] = useState(false);

  // Feedback
  const [feedback, setFeedback] = useState(null);

  const formatCurrency = (paise) => '₹' + ((Number(paise) || 0) / 100).toFixed(2);
  const formatDate = (date) => new Date(date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

  // 1. Fetch Customers List
  const loadCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    try {
      const params = { limit: 50 };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (balanceFilter === 'HAS_BALANCE') params.hasBalance = 'true';
      if (balanceFilter === 'OVERDUE') params.overdueOnly = 'true';

      const res = await getCustomersApi(params);
      const list = res.customers || [];
      setCustomers(list);

      // Auto-select first customer if none selected or current selection missing
      if (list.length > 0) {
        if (!selectedCustomerId || !list.some((c) => c._id === selectedCustomerId)) {
          setSelectedCustomerId(list[0]._id);
        }
      } else {
        setSelectedCustomerId(null);
        setCustomerDetails(null);
        setStatementEntries([]);
      }
    } catch (err) {
      console.error('Failed to load customers', err);
    } finally {
      setLoadingCustomers(false);
    }
  }, [searchTerm, balanceFilter, selectedCustomerId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers();
    }, 200);
    return () => clearTimeout(timer);
  }, [searchTerm, balanceFilter]);

  // 2. Fetch Selected Customer Passbook & Invoices
  const loadCustomerPassbook = useCallback(async (id) => {
    if (!id) return;
    setLoadingPassbook(true);
    try {
      const [detailsRes, stmtRes, invRes] = await Promise.all([
        getCustomerDetailsApi(id),
        getCustomerStatementApi(id, { limit: 100 }),
        getInvoicesApi({ customerId: id, status: 'FINALIZED', paymentStatus: 'UNPAID,PARTIALLY_PAID', limit: 20 }),
      ]);

      setCustomerDetails(detailsRes.customer);
      setStatementEntries(stmtRes.entries || []);
      setUnpaidInvoices((invRes.invoices || []).filter((inv) => inv.balanceDuePaise > 0));
    } catch (err) {
      console.error('Failed to load customer passbook', err);
    } finally {
      setLoadingPassbook(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      loadCustomerPassbook(selectedCustomerId);
    }
  }, [selectedCustomerId, loadCustomerPassbook]);

  return (
    <PageContainer className="py-6 max-w-7xl">
      {/* Top Banner Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={ArrowLeft}
            onClick={() => navigate('/admin/dashboard')}
            className="text-slate-600 hover:text-slate-900"
          >
            Dashboard
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                शेतकरी खातेवही व उधारी व्यवस्थापन (Farmer Credit Ledger)
              </h1>
              <Badge variant="primary" size="sm">
                KHAATA OS
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              Shivshree Agro Mart — Immutable credit accounting, passbook statements & audit reconciliation
            </p>
          </div>
        </div>

        {/* Global Staff Actions */}
        <div className="flex items-center gap-2">
          {isOwnerOrManager && (
            <Button
              variant="outline"
              size="sm"
              icon={ShieldAlert}
              onClick={() => setShowReconciliationModal(true)}
              className="text-amber-800 border-amber-200 bg-amber-50 hover:bg-amber-100"
            >
              Audit Integrity Check
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setShowNewFarmerModal(true)}
            className="bg-[#166534] hover:bg-[#14532d]"
          >
            + Register Farmer
          </Button>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border mb-6 text-xs flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Main 2-Column Split: Farmer List (Left 4 Cols) & Passbook (Right 8 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Farmer Accounts Search & List */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-slate-200 shadow-xs p-4">
            <div className="space-y-3 mb-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search farmer by name, village or mobile..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#166534] bg-slate-50/50"
                />
              </div>

              {/* Balance Filter Chips */}
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  onClick={() => setBalanceFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    balanceFilter === 'ALL'
                      ? 'bg-[#166534] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All ({customers.length})
                </button>
                <button
                  onClick={() => setBalanceFilter('HAS_BALANCE')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    balanceFilter === 'HAS_BALANCE'
                      ? 'bg-rose-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  उधारी बाकी (Debt)
                </button>
                <button
                  onClick={() => setBalanceFilter('OVERDUE')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    balanceFilter === 'OVERDUE'
                      ? 'bg-amber-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  थकबाकी (Overdue)
                </button>
              </div>
            </div>

            {/* Farmer Accounts List */}
            <div className="border-t border-slate-100 pt-2 space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
              {loadingCustomers ? (
                <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#166534]" />
                  <span>Loading farmer ledger accounts...</span>
                </div>
              ) : customers.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No farmers found matching search.
                </div>
              ) : (
                customers.map((c) => {
                  const isSelected = c._id === selectedCustomerId;
                  const isDebtor = c.outstandingBalancePaise > 0;
                  return (
                    <div
                      key={c._id}
                      onClick={() => setSelectedCustomerId(c._id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#166534] bg-emerald-50/50 shadow-xs ring-1 ring-[#166534]'
                          : 'border-slate-200 bg-white hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <p className="font-bold text-slate-900 leading-tight">{c.name}</p>
                          <p className="text-[10px] text-slate-500">
                            {c.village || 'राहुरी'} {c.phone ? `• ${c.phone}` : ''}
                          </p>
                        </div>
                        {c.isOverdue && (
                          <Badge variant="warning" size="sm">
                            Overdue
                          </Badge>
                        )}
                      </div>

                      <div className="flex justify-between items-center pt-2 mt-1 border-t border-slate-100">
                        <span className="text-[11px] text-slate-500">बाकी शिल्लक:</span>
                        <span
                          className={`font-mono font-bold text-xs ${
                            isDebtor ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {formatCurrency(c.outstandingBalancePaise)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: Customer Detail, Credit Card, Unpaid Bills & Passbook */}
        <div className="lg:col-span-8 space-y-4">
          {!customerDetails ? (
            <Card className="p-12 text-center text-xs text-slate-400 border-slate-200">
              Select a farmer on the left to view their credit profile and digital passbook.
            </Card>
          ) : (
            <>
              {/* Farmer Profile Header Card */}
              <Card className="border-slate-200 shadow-xs p-5">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">{customerDetails.name}</h2>
                      <Badge variant={customerDetails.active ? 'success' : 'default'} size="sm">
                        {customerDetails.active ? 'Active Farmer' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      मोबाईल: {customerDetails.phone || 'N/A'} | गाव: {customerDetails.village || 'राहुरी'}, तालुका: {customerDetails.taluka || 'राहुरी'}
                    </p>
                  </div>

                  {/* Operational Action Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={DollarSign}
                      onClick={() => setShowCollectPaymentModal(true)}
                      className="bg-[#166534] hover:bg-[#14532d]"
                    >
                      Collect Payment / जमा
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Printer}
                      onClick={() => setShowStatementModal(true)}
                    >
                      Passbook Statement
                    </Button>
                    {isOwnerOrManager && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={Sliders}
                          onClick={() => setShowAdjustmentModal(true)}
                          title="Manual Adjustment"
                        >
                          Adjustment
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={BookOpen}
                          onClick={() => setShowOpeningBalanceModal(true)}
                          title="Set Opening Balance"
                        >
                          Opening
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={ShieldCheck}
                          onClick={() => setShowUpdateLimitModal(true)}
                          title="Edit Credit Limit"
                        >
                          Limit
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* 3 Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-xs">
                  <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl">
                    <span className="text-[11px] text-rose-800 font-semibold block">
                      चालू बाकी शिल्लक (Outstanding Debt):
                    </span>
                    <span className="text-lg font-black font-mono text-rose-700 block mt-0.5">
                      {formatCurrency(customerDetails.outstandingBalancePaise)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {customerDetails.outstandingBalancePaise > 0
                        ? 'Amount owed to shop by farmer'
                        : customerDetails.outstandingBalancePaise < 0
                        ? 'Advance credit held in shop'
                        : 'Fully settled / पूर्ण भरणा'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[11px] text-slate-600 font-semibold block">
                      मंजूर उधारी मर्यादा (Credit Limit):
                    </span>
                    <span className="text-lg font-black font-mono text-slate-800 block mt-0.5">
                      {formatCurrency(customerDetails.creditLimitPaise)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Approved seasonal mart credit ceiling
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                    <span className="text-[11px] text-emerald-800 font-semibold block">
                      उपलब्ध उधारी (Available Credit):
                    </span>
                    <span className="text-lg font-black font-mono text-emerald-700 block mt-0.5">
                      {formatCurrency(customerDetails.availableCreditPaise)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Remaining credit allowance for new sales
                    </span>
                  </div>
                </div>
              </Card>

              {/* Unpaid Invoices Drawer if any */}
              {unpaidInvoices.length > 0 && (
                <Card className="border-amber-200 bg-amber-50/30 shadow-xs p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-amber-700" />
                      Unpaid Credit Invoices ({unpaidInvoices.length})
                    </h3>
                    <span className="text-[11px] text-amber-800 font-semibold font-mono">
                      Total Due: {formatCurrency(unpaidInvoices.reduce((a, b) => a + b.balanceDuePaise, 0))}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {unpaidInvoices.map((inv) => (
                      <div key={inv._id} className="p-2.5 bg-white rounded-lg border border-amber-200 flex justify-between items-center">
                        <div>
                          <span className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</span>
                          <span className="text-[10px] text-slate-400 block">{formatDate(inv.invoiceDate)}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-rose-700 block">{formatCurrency(inv.balanceDuePaise)}</span>
                          <span className="text-[10px] text-slate-500">of {formatCurrency(inv.grandTotalPaise)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Passbook Ledger Transactions Table */}
              <Card className="border-slate-200 shadow-xs p-5">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-[#166534]" />
                      डिजिटल पासबुक नोंदवही (Chronological Ledger Entries)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Immutable financial transactions. Red entries increase debt; green entries decrease debt.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-semibold text-slate-500">
                    {statementEntries.length} entries
                  </span>
                </div>

                {loadingPassbook ? (
                  <div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#166534]" />
                    <span>Loading farmer passbook ledger...</span>
                  </div>
                ) : statementEntries.length === 0 ? (
                  <div className="py-16 text-center text-xs text-slate-400">
                    No transactions recorded for this farmer yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Reference</th>
                          <th className="py-2.5 px-3">Description</th>
                          <th className="py-2.5 px-3 text-right">नावे / Debit (₹)</th>
                          <th className="py-2.5 px-3 text-right">जमा / Credit (₹)</th>
                          <th className="py-2.5 px-3 text-right">शिल्लक / Balance (₹)</th>
                          {isOwnerOrManager && <th className="py-2.5 px-3 text-right">Action</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {statementEntries.map((e) => (
                          <tr
                            key={e._id}
                            className={`hover:bg-slate-50/60 ${e.isReversed ? 'text-slate-400 line-through bg-slate-50/30' : ''}`}
                          >
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                              {formatDate(e.createdAt)}
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge
                                variant={
                                  e.entryType === 'CREDIT_SALE'
                                    ? 'warning'
                                    : e.entryType === 'PAYMENT_RECEIVED'
                                    ? 'success'
                                    : e.entryType === 'REVERSAL'
                                    ? 'default'
                                    : 'primary'
                                }
                                size="sm"
                              >
                                {e.entryType}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                              {e.referenceId || '-'}
                            </td>
                            <td className="py-2.5 px-3">
                              <p className="font-semibold text-slate-900">{e.description}</p>
                              {e.notes && <p className="text-[10px] text-slate-500 italic">{e.notes}</p>}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                              {e.transactionType === 'DEBIT' ? formatCurrency(e.amountPaise) : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                              {e.transactionType === 'CREDIT' ? formatCurrency(e.amountPaise) : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                              {formatCurrency(e.runningBalancePaise)}
                            </td>
                            {isOwnerOrManager && (
                              <td className="py-2.5 px-3 text-right">
                                {!e.isReversed && e.entryType !== 'REVERSAL' && (
                                  <button
                                    onClick={() => setEntryToReverse(e)}
                                    title="Reverse this ledger entry"
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>

      {/* MODAL 1: Collect Credit Payment */}
      {showCollectPaymentModal && customerDetails && (
        <CollectCreditPaymentModal
          customer={customerDetails}
          onClose={() => setShowCollectPaymentModal(false)}
          onSuccess={(res) => {
            setShowCollectPaymentModal(false);
            setFeedback({
              type: 'success',
              message: `Payment of ${formatCurrency(res.payment.amountPaise)} recorded. New balance: ${formatCurrency(res.newBalancePaise)}`,
            });
            loadCustomers();
            loadCustomerPassbook(customerDetails._id);
          }}
        />
      )}

      {/* MODAL 2: Manual Ledger Adjustment */}
      {showAdjustmentModal && customerDetails && (
        <ManualAdjustmentModal
          customer={customerDetails}
          onClose={() => setShowAdjustmentModal(false)}
          onSuccess={(res) => {
            setShowAdjustmentModal(false);
            setFeedback({
              type: 'success',
              message: `Adjustment recorded successfully. New balance: ${formatCurrency(res.newBalancePaise)}`,
            });
            loadCustomers();
            loadCustomerPassbook(customerDetails._id);
          }}
        />
      )}

      {/* MODAL 3: Opening Balance Setup */}
      {showOpeningBalanceModal && customerDetails && (
        <OpeningBalanceModal
          customer={customerDetails}
          onClose={() => setShowOpeningBalanceModal(false)}
          onSuccess={(res) => {
            setShowOpeningBalanceModal(false);
            setFeedback({
              type: 'success',
              message: `Opening balance recorded. Balance: ${formatCurrency(res.newBalancePaise)}`,
            });
            loadCustomers();
            loadCustomerPassbook(customerDetails._id);
          }}
        />
      )}

      {/* MODAL 4: Update Credit Limit */}
      {showUpdateLimitModal && customerDetails && (
        <UpdateCreditLimitModal
          customer={customerDetails}
          onClose={() => setShowUpdateLimitModal(false)}
          onSuccess={(res) => {
            setShowUpdateLimitModal(false);
            setFeedback({
              type: 'success',
              message: `Credit limit updated to ${formatCurrency(res.newLimitPaise)}.`,
            });
            loadCustomers();
            loadCustomerPassbook(customerDetails._id);
          }}
        />
      )}

      {/* MODAL 5: Printable Passbook Statement */}
      {showStatementModal && customerDetails && (
        <CustomerStatementModal
          customer={customerDetails}
          onClose={() => setShowStatementModal(false)}
        />
      )}

      {/* MODAL 6: Reversal Dialog */}
      {entryToReverse && (
        <ReverseEntryModal
          entry={entryToReverse}
          onClose={() => setEntryToReverse(null)}
          onSuccess={(res) => {
            setEntryToReverse(null);
            setFeedback({
              type: 'success',
              message: `Entry reversed successfully. Restored balance: ${formatCurrency(res.newBalancePaise)}`,
            });
            loadCustomers();
            if (customerDetails) loadCustomerPassbook(customerDetails._id);
          }}
        />
      )}

      {/* MODAL 7: Reconciliation Report Modal */}
      {showReconciliationModal && (
        <ReconciliationReportModal
          customerId={selectedCustomerId}
          onClose={() => setShowReconciliationModal(false)}
        />
      )}

      {/* MODAL 8: Register New Farmer */}
      {showNewFarmerModal && (
        <QuickCustomerModal
          userRole={user?.role}
          onClose={() => setShowNewFarmerModal(false)}
          onSuccess={(newCust) => {
            setShowNewFarmerModal(false);
            setFeedback({
              type: 'success',
              message: `Farmer ${newCust.name} registered successfully.`,
            });
            loadCustomers();
            setSelectedCustomerId(newCust._id);
          }}
        />
      )}
    </PageContainer>
  );
}
