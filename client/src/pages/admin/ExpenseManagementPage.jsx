import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  RotateCcw,
  Calendar,
  AlertCircle,
  Clock,
  TrendingDown,
  DollarSign,
} from 'lucide-react';
import { getExpensesApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import NewExpenseModal from '../../components/expense/NewExpenseModal';
import ApproveRejectExpenseModal from '../../components/expense/ApproveRejectExpenseModal';
import ReverseExpenseModal from '../../components/expense/ReverseExpenseModal';

export default function ExpenseManagementPage() {
  const { t, i18n } = useTranslation();
  const isMr = i18n.language === 'mr';
  const { user } = useAuth();
  const isManagerOrOwner = user?.role === 'OWNER' || user?.role === 'MANAGER';

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState({ totalApprovedPaise: 0, approvedCount: 0 });

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [paymentModeFilter, setPaymentModeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [approveModal, setApproveModal] = useState({ isOpen: false, expense: null, mode: 'APPROVE' });
  const [reverseModal, setReverseModal] = useState({ isOpen: false, expense: null });

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, limit: 20 };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (paymentModeFilter) params.paymentMode = paymentModeFilter;

      const res = await getExpensesApi(params);
      setExpenses(res.data || []);
      setPagination(res.pagination || { total: 0, totalPages: 1 });
      setSummary(res.summary || { totalApprovedPaise: 0, approvedCount: 0 });
    } catch (err) {
      setError(err.message || 'Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [page, statusFilter, categoryFilter, paymentModeFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchExpenses();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-text-main flex items-center space-x-2 text-2xl font-black">
            <Receipt className="text-primary h-7 w-7" />
            <span>{isMr ? 'दुकान खर्च व्यवस्थापन' : 'Operating Expenses'}</span>
          </h1>
          <p className="text-text-muted text-sm">
            {isMr
              ? 'भाडे, वीज बिल, पगार, हमाली, वाहतूक आणि इतर दैनंदिन खर्चाची नोंद व मंजुरी'
              : 'Record, approve, and audit store operating expenditures, utilities, and wages'}
          </p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="bg-primary hover:bg-primary-hover flex items-center justify-center space-x-2 rounded-xl px-4 py-2.5 font-bold text-white shadow-md transition-all active:scale-95"
        >
          <Plus className="h-5 w-5" />
          <span>{isMr ? 'नवीन खर्च नोंदवा' : 'Record Expense'}</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-surface border-border rounded-xl border p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-text-muted text-xs font-semibold uppercase">
              {isMr ? 'एकूण मंजूर खर्च' : 'Total Approved Expenses'}
            </span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
              <TrendingDown className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600">
            ₹{((summary.totalApprovedPaise || 0) / 100).toFixed(2)}
          </div>
          <div className="text-text-muted mt-1 text-xs">
            {summary.approvedCount} {isMr ? 'मंजूर नोंदी' : 'approved vouchers'}
          </div>
        </div>

        <div className="bg-surface border-border rounded-xl border p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-text-muted text-xs font-semibold uppercase">
              {isMr ? 'प्रलंबित मंजुरी' : 'Pending Approval'}
            </span>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600">
            {expenses.filter((e) => e.status === 'PENDING_APPROVAL').length}
          </div>
          <div className="text-text-muted mt-1 text-xs">
            {isMr ? 'मंजुरीची आवश्यकता आहे' : 'require manager approval'}
          </div>
        </div>

        <div className="bg-surface border-border rounded-xl border p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-text-muted text-xs font-semibold uppercase">
              {isMr ? 'रोख खर्च (Cash)' : 'Cash Outflow'}
            </span>
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-blue-600">
            ₹{(
              expenses
                .filter((e) => e.status === 'APPROVED' && e.paymentMode === 'CASH')
                .reduce((sum, e) => sum + (e.amountPaise || 0), 0) / 100
            ).toFixed(2)}
          </div>
          <div className="text-text-muted mt-1 text-xs">
            {isMr ? 'कॅश ड्रॉवरमधून दिलेले' : 'deducted from cash drawer'}
          </div>
        </div>

        <div className="bg-surface border-border rounded-xl border p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-text-muted text-xs font-semibold uppercase">
              {isMr ? 'डिजिटल खर्च (UPI/Bank)' : 'Bank / UPI Outflow'}
            </span>
            <div className="rounded-lg bg-purple-500/10 p-2 text-purple-600">
              <Receipt className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-purple-600">
            ₹{(
              expenses
                .filter((e) => e.status === 'APPROVED' && e.paymentMode !== 'CASH')
                .reduce((sum, e) => sum + (e.amountPaise || 0), 0) / 100
            ).toFixed(2)}
          </div>
          <div className="text-text-muted mt-1 text-xs">
            {isMr ? 'बँक खात्यातून दिलेले' : 'paid directly from bank'}
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-surface border-border flex flex-col gap-3 rounded-xl border p-4 shadow-xs sm:flex-row sm:items-center">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="text-text-muted absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              isMr
                ? 'खर्च क्रमांक, प्राप्तकर्ता, किंवा तपशील शोधा...'
                : 'Search expense #, payee, or description...'
            }
            className="bg-surface-alt border-border text-text-main focus:border-primary focus:ring-primary/20 w-full rounded-lg border py-2 pr-4 pl-9 text-sm focus:ring-2 focus:outline-none"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-surface-alt border-border text-text-main rounded-lg border px-3 py-2 text-xs font-semibold focus:outline-none"
          >
            <option value="">{isMr ? 'सर्व स्थिती (Status)' : 'All Statuses'}</option>
            <option value="APPROVED">{isMr ? 'मंजूर (Approved)' : 'Approved'}</option>
            <option value="PENDING_APPROVAL">{isMr ? 'प्रलंबित (Pending)' : 'Pending'}</option>
            <option value="REJECTED">{isMr ? 'नाकारलेले (Rejected)' : 'Rejected'}</option>
            <option value="REVERSED">{isMr ? 'उलट नोंद (Reversed)' : 'Reversed'}</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="bg-surface-alt border-border text-text-main rounded-lg border px-3 py-2 text-xs font-semibold focus:outline-none"
          >
            <option value="">{isMr ? 'सर्व वर्गवारी (Category)' : 'All Categories'}</option>
            <option value="RENT">Rent / भाडे</option>
            <option value="ELECTRICITY">Electricity / वीज</option>
            <option value="SALARIES_WAGES">Salaries / पगार</option>
            <option value="TRANSPORT_FUEL">Transport / वाहतूक</option>
            <option value="MAINTENANCE">Maintenance / दुरुस्ती</option>
            <option value="STATIONERY_PACKAGING">Stationery / स्टेशनरी</option>
            <option value="MISCELLANEOUS">Miscellaneous / इतर</option>
          </select>

          <select
            value={paymentModeFilter}
            onChange={(e) => {
              setPaymentModeFilter(e.target.value);
              setPage(1);
            }}
            className="bg-surface-alt border-border text-text-main rounded-lg border px-3 py-2 text-xs font-semibold focus:outline-none"
          >
            <option value="">{isMr ? 'सर्व पेमेंट (Payment)' : 'All Modes'}</option>
            <option value="CASH">CASH</option>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">BANK</option>
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-surface border-border overflow-hidden rounded-xl border shadow-xs">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-text-muted">
            <span>{isMr ? 'खर्च माहिती लोड होत आहे...' : 'Loading expenses...'}</span>
          </div>
        ) : error ? (
          <div className="flex h-64 flex-col items-center justify-center space-y-2 text-red-500">
            <AlertCircle className="h-8 w-8" />
            <span>{error}</span>
          </div>
        ) : expenses.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center space-y-2 text-text-muted">
            <Receipt className="h-10 w-10 stroke-1" />
            <p className="text-base font-semibold">{isMr ? 'कोणतेही खर्च सापडले नाहीत' : 'No expenses found'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-alt border-border text-text-muted border-b text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">{isMr ? 'दिनांक' : 'Date'}</th>
                  <th className="px-4 py-3">{isMr ? 'खर्च क्र.' : 'Voucher #'}</th>
                  <th className="px-4 py-3">{isMr ? 'वर्गवारी' : 'Category'}</th>
                  <th className="px-4 py-3">{isMr ? 'प्राप्तकर्ता' : 'Payee'}</th>
                  <th className="px-4 py-3">{isMr ? 'तपशील' : 'Description'}</th>
                  <th className="px-4 py-3">{isMr ? 'पेमेंट' : 'Mode'}</th>
                  <th className="px-4 py-3 text-right">{isMr ? 'रक्कम' : 'Amount'}</th>
                  <th className="px-4 py-3 text-center">{isMr ? 'स्थिती' : 'Status'}</th>
                  <th className="px-4 py-3 text-right">{isMr ? 'कृती' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {expenses.map((exp) => (
                  <tr key={exp._id} className="hover:bg-surface-alt/50 transition-colors">
                    <td className="text-text-muted px-4 py-3 text-xs whitespace-nowrap">
                      {new Date(exp.expenseDate).toLocaleDateString()}
                    </td>
                    <td className="text-text-main px-4 py-3 font-semibold whitespace-nowrap">
                      {exp.expenseNumber}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="bg-surface-alt border-border text-text-main rounded-md border px-2 py-0.5 text-xs font-medium">
                        {exp.category}
                      </span>
                    </td>
                    <td className="text-text-main px-4 py-3 font-medium whitespace-nowrap">
                      {exp.payee}
                    </td>
                    <td className="text-text-muted px-4 py-3 max-w-xs truncate text-xs" title={exp.description}>
                      {exp.description}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                          exp.paymentMode === 'CASH'
                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                            : 'bg-purple-500/10 text-purple-700 dark:text-purple-400'
                        }`}
                      >
                        {exp.paymentMode}
                      </span>
                    </td>
                    <td className="text-text-main px-4 py-3 text-right font-bold whitespace-nowrap">
                      ₹{((exp.amountPaise || 0) / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          exp.status === 'APPROVED'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : exp.status === 'PENDING_APPROVAL'
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                            : exp.status === 'REVERSED'
                            ? 'bg-gray-500/10 text-gray-700 dark:text-gray-400'
                            : 'bg-red-500/10 text-red-700 dark:text-red-400'
                        }`}
                      >
                        {exp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        {isManagerOrOwner && exp.status === 'PENDING_APPROVAL' && (
                          <>
                            <button
                              onClick={() =>
                                setApproveModal({ isOpen: true, expense: exp, mode: 'APPROVE' })
                              }
                              className="text-emerald-600 hover:bg-emerald-500/10 rounded-lg p-1 transition-colors"
                              title={isMr ? 'मंजूर करा' : 'Approve'}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() =>
                                setApproveModal({ isOpen: true, expense: exp, mode: 'REJECT' })
                              }
                              className="text-red-600 hover:bg-red-500/10 rounded-lg p-1 transition-colors"
                              title={isMr ? 'नाकारा' : 'Reject'}
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {isManagerOrOwner && exp.status === 'APPROVED' && !exp.isReversed && (
                          <button
                            onClick={() => setReverseModal({ isOpen: true, expense: exp })}
                            className="text-amber-600 hover:bg-amber-500/10 rounded-lg p-1 transition-colors"
                            title={isMr ? 'उलट नोंद (Reverse)' : 'Reverse'}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {pagination.totalPages > 1 && (
          <div className="border-border flex items-center justify-between border-t px-4 py-3 text-xs">
            <span className="text-text-muted">
              {isMr ? 'एकूण नोंदी:' : 'Total entries:'} {pagination.total}
            </span>
            <div className="flex space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="border-border text-text-muted hover:bg-surface-alt rounded-md border px-2.5 py-1 disabled:opacity-50"
              >
                {isMr ? 'मागे' : 'Prev'}
              </button>
              <span className="text-text-main font-semibold self-center">
                {page} / {pagination.totalPages}
              </span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="border-border text-text-muted hover:bg-surface-alt rounded-md border px-2.5 py-1 disabled:opacity-50"
              >
                {isMr ? 'पुढे' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <NewExpenseModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={fetchExpenses}
      />

      <ApproveRejectExpenseModal
        isOpen={approveModal.isOpen}
        onClose={() => setApproveModal({ isOpen: false, expense: null, mode: 'APPROVE' })}
        expense={approveModal.expense}
        mode={approveModal.mode}
        onSuccess={fetchExpenses}
      />

      <ReverseExpenseModal
        isOpen={reverseModal.isOpen}
        onClose={() => setReverseModal({ isOpen: false, expense: null })}
        expense={reverseModal.expense}
        onSuccess={fetchExpenses}
      />
    </div>
  );
}
