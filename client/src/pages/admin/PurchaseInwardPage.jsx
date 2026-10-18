import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Package,
  Plus,
  Search,
  Filter,
  Eye,
  CheckCircle,
  CornerUpLeft,
  Ban,
  Calendar,
  FileText,
  RefreshCw,
} from 'lucide-react';
import {
  getPurchasesApi,
  receivePurchaseApi,
} from '../../services/api';
import NewPurchaseModal from '../../components/purchase/NewPurchaseModal';
import PurchaseViewModal from '../../components/purchase/PurchaseViewModal';
import CancelPurchaseModal from '../../components/purchase/CancelPurchaseModal';
import PurchaseReturnModal from '../../components/purchase/PurchaseReturnModal';

export default function PurchaseInwardPage() {
  const { t } = useTranslation();

  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [purchaseToCancel, setPurchaseToCancel] = useState(null);

  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [purchaseToReturn, setPurchaseToReturn] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const res = await getPurchasesApi({
        search: searchTerm || undefined,
        status: statusFilter || undefined,
        paymentStatus: paymentStatusFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: 50,
      });
      setPurchases(res.data || []);
    } catch (err) {
      console.error('Error fetching purchases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, [searchTerm, statusFilter, paymentStatusFilter, startDate, endDate]);

  const handleReceiveDraft = async (purchase) => {
    if (!window.confirm(`Receive draft purchase ${purchase.purchaseNumber} and increment inventory?`)) {
      return;
    }
    setActionLoading(true);
    try {
      await receivePurchaseApi(purchase._id, {});
      fetchPurchases();
    } catch (err) {
      alert(err.message || 'Failed to receive draft purchase');
    } finally {
      setActionLoading(false);
    }
  };

  // Calculations for summary stats
  const totalReceivedValuePaise = purchases
    .filter((p) => p.status === 'RECEIVED')
    .reduce((sum, p) => sum + (p.grandTotalPaise || 0), 0);

  const totalOutstandingPaise = purchases
    .filter((p) => p.status === 'RECEIVED')
    .reduce((sum, p) => sum + (p.balancePaise || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Purchase Inward & Stock Receipts (खरेदी आवक व साठा नोंद)
          </h1>
          <p className="text-sm text-gray-500">
            Record incoming stock, manage manufacturer batches, and audit accounts payable bills
          </p>
        </div>

        <button
          onClick={() => setNewModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-green-800 transition"
        >
          <Plus className="h-4 w-4" />
          <span>New Inward Bill (नवीन खरेदी नोंद)</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Total Inward Bills
          </div>
          <div className="mt-2 text-2xl font-black text-gray-900">{purchases.length}</div>
          <div className="mt-1 text-xs text-gray-500">Matching filtered query</div>
        </div>

        <div className="rounded-2xl border border-green-100 bg-green-50/50 p-5 shadow-xs">
          <div className="text-xs font-semibold text-green-800 uppercase tracking-wider">
            Total Inward Value (खरेदी मूल्य)
          </div>
          <div className="mt-2 text-2xl font-black text-green-800">
            ₹{(totalReceivedValuePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-green-600">Total received stock value</div>
        </div>

        <div className="rounded-2xl border border-red-100 bg-red-50/50 p-5 shadow-xs">
          <div className="text-xs font-semibold text-red-800 uppercase tracking-wider">
            Pending Bill Balances (बाकी देय)
          </div>
          <div className="mt-2 text-2xl font-black text-red-700">
            ₹{(totalOutstandingPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-red-600">Pending credit payments</div>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5 shadow-xs">
          <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
            Draft Purchases (मसुदा)
          </div>
          <div className="mt-2 text-2xl font-black text-amber-800">
            {purchases.filter((p) => p.status === 'DRAFT').length}
          </div>
          <div className="mt-1 text-xs text-amber-600">Pending physical inward receipt</div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Purchase #, Supplier Inv #, or product name..."
              className="w-full rounded-xl border border-gray-200 py-2 pr-4 pl-9 text-sm focus:border-green-600 focus:outline-hidden"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl bg-gray-100 p-1 text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('')}
              className={`rounded-lg px-3 py-1.5 transition ${
                statusFilter === '' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Status
            </button>
            <button
              onClick={() => setStatusFilter('RECEIVED')}
              className={`rounded-lg px-3 py-1.5 transition ${
                statusFilter === 'RECEIVED' ? 'bg-white text-green-800 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Received (स्वीकारलेले)
            </button>
            <button
              onClick={() => setStatusFilter('DRAFT')}
              className={`rounded-lg px-3 py-1.5 transition ${
                statusFilter === 'DRAFT' ? 'bg-white text-amber-800 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Drafts (मसुदा)
            </button>
            <button
              onClick={() => setStatusFilter('CANCELLED')}
              className={`rounded-lg px-3 py-1.5 transition ${
                statusFilter === 'CANCELLED' ? 'bg-white text-red-800 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Cancelled (रद्द)
            </button>
          </div>
        </div>

        {/* Date Filter */}
        <div className="flex flex-wrap items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span>Date Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs focus:border-green-600 focus:outline-hidden"
            />
            <span>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs focus:border-green-600 focus:outline-hidden"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-xs text-gray-500 hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium focus:border-green-600 focus:outline-hidden"
            >
              <option value="">All Payment Status</option>
              <option value="PAID">Paid (पूर्ण भरले)</option>
              <option value="PARTIALLY_PAID">Partially Paid (अंशतः)</option>
              <option value="UNPAID">Unpaid (उधारी बाकी)</option>
            </select>
            <button
              onClick={fetchPurchases}
              className="rounded-lg border border-gray-200 p-1 text-gray-500 hover:bg-gray-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Purchases Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-gray-100 bg-gray-50/80 text-gray-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Purchase Bill #</th>
                <th className="py-3 px-4">Supplier & Inv #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4 text-right">Grand Total (₹)</th>
                <th className="py-3 px-4 text-right">Balance Due (₹)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-sm text-gray-400">
                    Loading purchase inward records...
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-sm text-gray-400">
                    No purchase records found matching your filters.
                  </td>
                </tr>
              ) : (
                purchases.map((p) => {
                  const isReceived = p.status === 'RECEIVED';
                  const isDraft = p.status === 'DRAFT';
                  const isCancelled = p.status === 'CANCELLED';

                  return (
                    <tr key={p._id} className="hover:bg-gray-50/70 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900 text-sm">{p.purchaseNumber}</div>
                        <div className="text-[10px] text-gray-400">
                          Recv by: {p.receivedBy?.name || 'Staff'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">
                          {p.supplierId?.name || 'Supplier'}
                        </div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          Inv: {p.supplierInvoiceNumber}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-gray-600">
                        {new Date(p.purchaseDate).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                          {p.items?.length || 0} product(s)
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-black text-gray-900 text-sm">
                        ₹{(p.grandTotalPaise / 100).toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div
                          className={`font-bold ${
                            p.balancePaise > 0 ? 'text-red-700' : 'text-emerald-700'
                          }`}
                        >
                          ₹{(p.balancePaise / 100).toFixed(2)}
                        </div>
                        <span className="text-[10px] text-gray-400 uppercase">
                          {p.paymentStatus}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            isReceived
                              ? 'bg-green-100 text-green-800'
                              : isDraft
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedPurchase(p);
                              setViewModalOpen(true);
                            }}
                            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                            title="View Voucher"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {isDraft && (
                            <button
                              onClick={() => handleReceiveDraft(p)}
                              disabled={actionLoading}
                              className="rounded-lg bg-green-50 px-2 py-1 text-xs font-bold text-green-700 hover:bg-green-100"
                              title="Receive stock"
                            >
                              Receive
                            </button>
                          )}

                          {isReceived && (
                            <>
                              <button
                                onClick={() => {
                                  setPurchaseToReturn(p);
                                  setReturnModalOpen(true);
                                }}
                                className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50"
                                title="Purchase Return to Supplier"
                              >
                                <CornerUpLeft className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setPurchaseToCancel(p);
                                  setCancelModalOpen(true);
                                }}
                                className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                title="Cancel Bill"
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <NewPurchaseModal
        isOpen={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onCreated={fetchPurchases}
      />

      <PurchaseViewModal
        isOpen={viewModalOpen}
        onClose={() => {
          setViewModalOpen(false);
          setSelectedPurchase(null);
        }}
        purchase={selectedPurchase}
      />

      <CancelPurchaseModal
        isOpen={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false);
          setPurchaseToCancel(null);
        }}
        purchase={purchaseToCancel}
        onCancelled={fetchPurchases}
      />

      <PurchaseReturnModal
        isOpen={returnModalOpen}
        onClose={() => {
          setReturnModalOpen(false);
          setPurchaseToReturn(null);
        }}
        purchase={purchaseToReturn}
        onReturned={fetchPurchases}
      />
    </div>
  );
}
