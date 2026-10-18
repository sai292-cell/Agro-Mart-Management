import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Search,
  Plus,
  CreditCard,
  Scale,
  BookOpen,
  FileText,
  ShieldCheck,
  Edit2,
  ChevronRight,
  Phone,
  Landmark,
  RotateCcw,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import {
  getSuppliersApi,
  getSupplierDetailsApi,
} from '../../services/api';
import SupplierFormModal from '../../components/supplier/SupplierFormModal';
import RecordSupplierPaymentModal from '../../components/supplier/RecordSupplierPaymentModal';
import SupplierAdjustmentModal from '../../components/supplier/SupplierAdjustmentModal';
import SupplierOpeningBalanceModal from '../../components/supplier/SupplierOpeningBalanceModal';
import ReverseSupplierEntryModal from '../../components/supplier/ReverseSupplierEntryModal';
import SupplierStatementModal from '../../components/supplier/SupplierStatementModal';
import SupplierReconciliationModal from '../../components/supplier/SupplierReconciliationModal';

export default function SupplierManagementPage() {
  const { t } = useTranslation();

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('true');

  // Selected supplier drawer
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [supplierDetails, setSupplierDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Modals state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [activeSupplierForPayment, setActiveSupplierForPayment] = useState(null);

  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [openingBalanceModalOpen, setOpeningBalanceModalOpen] = useState(false);

  const [reversalModalOpen, setReversalModalOpen] = useState(false);
  const [selectedEntryForReversal, setSelectedEntryForReversal] = useState(null);

  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [reconciliationModalOpen, setReconciliationModalOpen] = useState(false);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await getSuppliersApi({
        search: searchTerm || undefined,
        active: activeFilter || undefined,
        limit: 100,
      });
      setSuppliers(res.data || []);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetails = async (id) => {
    setDetailsLoading(true);
    try {
      const data = await getSupplierDetailsApi(id);
      setSupplierDetails(data);
    } catch (err) {
      console.error('Error fetching supplier details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [searchTerm, activeFilter]);

  useEffect(() => {
    if (selectedSupplierId) {
      fetchDetails(selectedSupplierId);
    } else {
      setSupplierDetails(null);
    }
  }, [selectedSupplierId]);

  // Total AP calculations
  const totalPayablePaise = suppliers.reduce((sum, s) => {
    return sum + (s.outstandingBalancePaise > 0 ? s.outstandingBalancePaise : 0);
  }, 0);

  const totalAdvancePaise = suppliers.reduce((sum, s) => {
    return sum + (s.outstandingBalancePaise < 0 ? Math.abs(s.outstandingBalancePaise) : 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Supplier Management & Accounts Payable (पुरवठादार व देणी खातेवही)
          </h1>
          <p className="text-sm text-gray-500">
            Manage company distributors, purchase bills, payments, and accounts payable passbooks
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEditingSupplier(null);
              setFormModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-green-800 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Add Supplier (नवीन पुरवठादार)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Total Active Suppliers
          </div>
          <div className="mt-2 text-2xl font-black text-gray-900">{suppliers.length}</div>
          <div className="mt-1 text-xs text-gray-500">Registered distributors & agencies</div>
        </div>

        <div className="rounded-2xl border border-red-100 bg-red-50/50 p-5 shadow-xs">
          <div className="text-xs font-semibold text-red-800 uppercase tracking-wider">
            Total Accounts Payable (एकूण देय बाकी)
          </div>
          <div className="mt-2 text-2xl font-black text-red-700">
            ₹{(totalPayablePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-red-600">Pending credit purchase liability</div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 shadow-xs">
          <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
            Advance Held with Suppliers (अगाऊ जमा)
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700">
            ₹{(totalAdvancePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-emerald-600">Prepayments & unallocated credits</div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by supplier name, phone, contact person, or GSTIN..."
            className="w-full rounded-xl border border-gray-200 py-2 pr-4 pl-9 text-sm focus:border-green-600 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 focus:border-green-600 focus:outline-hidden"
          >
            <option value="true">Active Only (सक्रिय)</option>
            <option value="false">Inactive Only (निष्क्रिय)</option>
            <option value="">All Suppliers (सर्व)</option>
          </select>

          <button
            onClick={fetchSuppliers}
            className="rounded-xl border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
            title="Refresh list"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area: Table + Drawer */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Suppliers Table */}
        <div className={`overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xs ${selectedSupplierId ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-gray-100 bg-gray-50/80 text-gray-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Supplier Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4 text-right">Payable Balance (₹)</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-sm text-gray-400">
                      Loading supplier directory...
                    </td>
                  </tr>
                ) : suppliers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-sm text-gray-400">
                      No suppliers found matching criteria.
                    </td>
                  </tr>
                ) : (
                  suppliers.map((s) => {
                    const isSelected = selectedSupplierId === s._id;
                    const balance = s.outstandingBalancePaise || 0;

                    return (
                      <tr
                        key={s._id}
                        onClick={() => setSelectedSupplierId(isSelected ? null : s._id)}
                        className={`cursor-pointer transition hover:bg-gray-50/70 ${
                          isSelected ? 'bg-green-50/50' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-gray-900 text-sm">{s.name}</div>
                          {s.taxDetails?.gstin && (
                            <div className="text-[11px] text-gray-500 font-mono">
                              GST: {s.taxDetails.gstin}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700">
                            {s.supplierType || 'DISTRIBUTOR'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-gray-600">
                          <div>{s.contactPerson || '—'}</div>
                          {s.phone && <div className="text-[11px] text-gray-400">{s.phone}</div>}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div
                            className={`font-black text-sm ${
                              balance > 0
                                ? 'text-red-700'
                                : balance < 0
                                ? 'text-emerald-700'
                                : 'text-gray-500'
                            }`}
                          >
                            ₹{(Math.abs(balance) / 100).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                          {balance < 0 ? (
                            <span className="text-[10px] text-emerald-600 font-semibold">
                              (Advance Paid)
                            </span>
                          ) : balance > 0 ? (
                            <span className="text-[10px] text-red-600 font-semibold">
                              (Due Payable)
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400">Settled</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setActiveSupplierForPayment(s);
                                setPaymentModalOpen(true);
                              }}
                              className="rounded-lg bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700 hover:bg-green-100"
                              title="Make Payment"
                            >
                              Pay
                            </button>
                            <button
                              onClick={() => {
                                setEditingSupplier(s);
                                setFormModalOpen(true);
                              }}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                              title="Edit Supplier"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setSelectedSupplierId(isSelected ? null : s._id)}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
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

        {/* Selected Supplier Profile Drawer */}
        {selectedSupplierId && (
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs">
              {detailsLoading || !supplierDetails ? (
                <div className="py-12 text-center text-sm text-gray-400">Loading details...</div>
              ) : (
                <div className="space-y-4">
                  {/* Drawer Header */}
                  <div className="flex items-start justify-between border-b border-gray-100 pb-3">
                    <div>
                      <h2 className="text-lg font-black text-gray-900">{supplierDetails.name}</h2>
                      <p className="text-xs text-gray-500">
                        {supplierDetails.supplierType} | {supplierDetails.villageCity || supplierDetails.district}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedSupplierId(null)}
                      className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Financial Balance Card */}
                  <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-medium">Net Payable Balance:</span>
                      <span className="rounded-md bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-700">
                        Terms: {supplierDetails.paymentTermsDays || 30} Days
                      </span>
                    </div>
                    <div
                      className={`mt-1 text-2xl font-black ${
                        supplierDetails.outstandingBalancePaise > 0
                          ? 'text-red-700'
                          : supplierDetails.outstandingBalancePaise < 0
                          ? 'text-emerald-700'
                          : 'text-gray-700'
                      }`}
                    >
                      ₹
                      {(Math.abs(supplierDetails.outstandingBalancePaise || 0) / 100).toLocaleString(
                        'en-IN',
                        { minimumFractionDigits: 2 }
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-400">
                      Credit Limit: ₹{((supplierDetails.creditLimitPaise || 0) / 100).toFixed(2)}
                    </div>
                  </div>

                  {/* Aging Buckets */}
                  {supplierDetails.aging && (
                    <div className="rounded-xl border border-gray-100 p-3 bg-white">
                      <div className="mb-2 text-xs font-bold text-gray-700 uppercase">
                        Accounts Payable Aging (थकबाकी वर्गीकरण)
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                        <div className="rounded-lg bg-green-50 p-1.5">
                          <div className="text-gray-500">0-30 Days</div>
                          <div className="font-bold text-green-900">
                            ₹{(supplierDetails.aging.current0_30Paise / 100).toFixed(0)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-yellow-50 p-1.5">
                          <div className="text-gray-500">31-60 Days</div>
                          <div className="font-bold text-yellow-900">
                            ₹{(supplierDetails.aging.overdue31_60Paise / 100).toFixed(0)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-orange-50 p-1.5">
                          <div className="text-gray-500">61-90 Days</div>
                          <div className="font-bold text-orange-900">
                            ₹{(supplierDetails.aging.delinquent61_90Paise / 100).toFixed(0)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-red-50 p-1.5">
                          <div className="text-gray-500">90+ Days</div>
                          <div className="font-bold text-red-900">
                            ₹{(supplierDetails.aging.highlyDelinquent90PlusPaise / 100).toFixed(0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                    <button
                      onClick={() => {
                        setActiveSupplierForPayment(supplierDetails);
                        setPaymentModalOpen(true);
                      }}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-green-700 py-2.5 text-white hover:bg-green-800"
                    >
                      <CreditCard className="h-4 w-4" />
                      <span>Record Payment</span>
                    </button>

                    <button
                      onClick={() => setStatementModalOpen(true)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-gray-700 hover:bg-gray-50"
                    >
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span>View Passbook</span>
                    </button>

                    <button
                      onClick={() => setAdjustmentModalOpen(true)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2 text-gray-700 hover:bg-gray-50"
                    >
                      <Scale className="h-3.5 w-3.5 text-amber-600" />
                      <span>Adjustment</span>
                    </button>

                    <button
                      onClick={() => setReconciliationModalOpen(true)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2 text-gray-700 hover:bg-gray-50"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />
                      <span>Reconcile</span>
                    </button>
                  </div>

                  {/* Bank Details */}
                  {supplierDetails.bankDetails?.accountNumber && (
                    <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 text-xs">
                      <div className="mb-1 flex items-center gap-1 font-bold text-gray-700">
                        <Landmark className="h-3.5 w-3.5" />
                        <span>Bank Settlement Info</span>
                      </div>
                      <div className="text-gray-600">
                        {supplierDetails.bankDetails.bankName} | A/c:{' '}
                        {supplierDetails.bankDetails.accountNumber}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        IFSC: {supplierDetails.bankDetails.ifscCode} |{' '}
                        {supplierDetails.bankDetails.accountName}
                      </div>
                    </div>
                  )}

                  {/* Recent Ledger Entries Drawer Table */}
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs font-bold text-gray-700 uppercase">
                      <span>Recent Ledger Transactions</span>
                      <button
                        onClick={() => setOpeningBalanceModalOpen(true)}
                        className="text-[10px] font-semibold text-blue-600 hover:underline"
                      >
                        + Opening Balance
                      </button>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-2 border-t border-gray-100 pt-2 text-xs">
                      {supplierDetails.recentLedgerEntries?.length === 0 ? (
                        <div className="text-gray-400 py-2 text-center">No ledger entries recorded</div>
                      ) : (
                        supplierDetails.recentLedgerEntries?.map((entry) => (
                          <div
                            key={entry._id}
                            className={`flex items-center justify-between p-2 rounded-lg border border-gray-100 ${
                              entry.isReversed ? 'bg-red-50/30 opacity-60 line-through' : 'bg-gray-50/50'
                            }`}
                          >
                            <div>
                              <div className="font-semibold text-gray-900">{entry.description}</div>
                              <div className="text-[10px] text-gray-400">
                                {new Date(entry.createdAt).toLocaleDateString()} | Bal: ₹
                                {(entry.runningBalancePaise / 100).toFixed(2)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-bold ${
                                  entry.transactionType === 'DEBIT'
                                    ? 'text-emerald-700'
                                    : 'text-red-700'
                                }`}
                              >
                                {entry.transactionType === 'DEBIT' ? '-' : '+'}₹
                                {(entry.amountPaise / 100).toFixed(2)}
                              </span>
                              {!entry.isReversed && (
                                <button
                                  onClick={() => {
                                    setSelectedEntryForReversal(entry);
                                    setReversalModalOpen(true);
                                  }}
                                  className="rounded p-1 text-gray-400 hover:text-red-600"
                                  title="Reverse Entry"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <SupplierFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        supplier={editingSupplier}
        onSaved={fetchSuppliers}
      />

      <RecordSupplierPaymentModal
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setActiveSupplierForPayment(null);
        }}
        supplier={activeSupplierForPayment}
        onRecorded={() => {
          fetchSuppliers();
          if (selectedSupplierId) fetchDetails(selectedSupplierId);
        }}
      />

      {supplierDetails && (
        <>
          <SupplierAdjustmentModal
            isOpen={adjustmentModalOpen}
            onClose={() => setAdjustmentModalOpen(false)}
            supplier={supplierDetails}
            onAdjusted={() => {
              fetchSuppliers();
              fetchDetails(selectedSupplierId);
            }}
          />

          <SupplierOpeningBalanceModal
            isOpen={openingBalanceModalOpen}
            onClose={() => setOpeningBalanceModalOpen(false)}
            supplier={supplierDetails}
            onRecorded={() => {
              fetchSuppliers();
              fetchDetails(selectedSupplierId);
            }}
          />

          <ReverseSupplierEntryModal
            isOpen={reversalModalOpen}
            onClose={() => {
              setReversalModalOpen(false);
              setSelectedEntryForReversal(null);
            }}
            supplier={supplierDetails}
            entry={selectedEntryForReversal}
            onReversed={() => {
              fetchSuppliers();
              fetchDetails(selectedSupplierId);
            }}
          />

          <SupplierStatementModal
            isOpen={statementModalOpen}
            onClose={() => setStatementModalOpen(false)}
            supplier={supplierDetails}
          />

          <SupplierReconciliationModal
            isOpen={reconciliationModalOpen}
            onClose={() => setReconciliationModalOpen(false)}
            supplier={supplierDetails}
          />
        </>
      )}
    </div>
  );
}
