import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  UserCheck,
  LogOut,
  BookOpen,
  Receipt,
  ShieldCheck,
  Printer,
  RefreshCw,
  AlertCircle,
  FileText,
  Calendar,
  CreditCard,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import PageContainer from '../../components/layout/PageContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import {
  getMyCreditProfileApi,
  getMyPassbookApi,
  getInvoicesApi,
} from '../../services/api';
import InvoiceReceiptModal from '../../components/pos/InvoiceReceiptModal';

export default function CustomerDashboardPage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Active Tab: 'passbook' | 'invoices'
  const [activeTab, setActiveTab] = useState('passbook');

  const [creditProfile, setCreditProfile] = useState(null);
  const [passbookEntries, setPassbookEntries] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const formatCurrency = (paise) => '₹' + ((Number(paise) || 0) / 100).toFixed(2);
  const formatDate = (date) => new Date(date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  useEffect(() => {
    async function loadFarmerData() {
      setLoading(true);
      try {
        const [profileRes, passbookRes, invoicesRes] = await Promise.all([
          getMyCreditProfileApi().catch(() => null),
          getMyPassbookApi({ limit: 100 }).catch(() => null),
          getInvoicesApi({ limit: 30 }).catch(() => null),
        ]);

        if (profileRes?.customer) setCreditProfile(profileRes.customer);
        if (passbookRes?.entries) setPassbookEntries(passbookRes.entries);
        if (invoicesRes?.invoices) setInvoices(invoicesRes.invoices);
      } catch (err) {
        console.error('Failed to load farmer customer portal data', err);
      } finally {
        setLoading(false);
      }
    }
    loadFarmerData();
  }, []);

  const handlePrintPassbook = () => {
    window.print();
  };

  return (
    <PageContainer className="py-8 max-w-6xl">
      {/* Farmer Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#166534] text-white flex items-center justify-center shadow-xs">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{user?.name}</h1>
              <Badge variant="primary" size="sm">
                शेतकरी खाते
              </Badge>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              नोंदणीकृत मोबाईल: {user?.phone || 'N/A'} {creditProfile?.village ? `| गाव: ${creditProfile.village}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={Printer}
            onClick={handlePrintPassbook}
            className="text-slate-700"
          >
            पासबुक प्रत छापा (Print)
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={LogOut}
            onClick={handleLogout}
            className="text-slate-700 hover:bg-slate-100"
          >
            बाहेर पडा
          </Button>
        </div>
      </div>

      {/* Security Privacy Notice */}
      <div className="p-3.5 rounded-xl bg-slate-100/90 border border-slate-200 text-slate-800 mb-6 flex items-start gap-3 text-xs">
        <ShieldCheck className="w-5 h-5 text-[#166534] shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block uppercase tracking-wide text-[11px]">
            सुरक्षित डिजिटल खातेवही (Data-Sandboxed)
          </span>
          <p className="text-slate-600 mt-0.5 leading-relaxed text-[11px]">
            हे पोर्टल केवळ आपल्या खात्याशी संबंधित अधिकृत खरेदी बिले, जमा पावत्या व शिल्लक रकमेसाठी सुरक्षित आहे.
          </p>
        </div>
      </div>

      {/* Credit Summary Cards (3 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="border-rose-200 bg-rose-50/50 p-4">
          <span className="text-[11px] font-bold text-rose-800 block uppercase">
            माझी चालू बाकी शिल्लक (Outstanding Debt)
          </span>
          <span className="text-2xl font-black font-mono text-rose-700 block mt-1">
            {formatCurrency(creditProfile?.outstandingBalancePaise || 0)}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">
            {creditProfile?.outstandingBalancePaise > 0
              ? 'दुकानाकडे देय असलेली एकूण उधारी रक्कम'
              : 'हिशोब पूर्ण / कोणतीही बाकी नाही'}
          </span>
        </Card>

        <Card className="border-slate-200 bg-slate-50/70 p-4">
          <span className="text-[11px] font-bold text-slate-600 block uppercase">
            मंजूर उधारी मर्यादा (Credit Limit)
          </span>
          <span className="text-2xl font-black font-mono text-slate-800 block mt-1">
            {formatCurrency(creditProfile?.creditLimitPaise || 0)}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">
            हंगामासाठी मंजूर केलेली कमाल उधारी मर्यादा
          </span>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/50 p-4">
          <span className="text-[11px] font-bold text-emerald-800 block uppercase">
            उपलब्ध उधारी (Available Credit)
          </span>
          <span className="text-2xl font-black font-mono text-emerald-700 block mt-1">
            {formatCurrency(creditProfile?.availableCreditPaise || 0)}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">
            नवीन खरेदीसाठी शिल्लक उधारी मर्यादा
          </span>
        </Card>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('passbook')}
          className={`flex items-center gap-2 py-2 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'passbook'
              ? 'border-[#166534] text-[#166534]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>माझे पासबुक (Khaata Passbook)</span>
          <span className="px-1.5 py-0.5 text-[10px] bg-slate-100 rounded-full font-mono">
            {passbookEntries.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 py-2 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'invoices'
              ? 'border-[#166534] text-[#166534]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>खरेदी बिले व पावत्या (Invoices)</span>
          <span className="px-1.5 py-0.5 text-[10px] bg-slate-100 rounded-full font-mono">
            {invoices.length}
          </span>
        </button>
      </div>

      {/* TAB 1: PASSBOOK TABLE */}
      {activeTab === 'passbook' && (
        <Card className="border-slate-200 p-5 shadow-xs" id="customer-passbook-print">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                खातेवही पासबुक नोंदी (Passbook Transactions)
              </h2>
              <p className="text-xs text-slate-500">
                नावे (Debit) = उधारी खरेदी | जमा (Credit) = रोख/UPI द्वारे भरलेली रक्कम
              </p>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              शिवश्री ॲग्रो मार्ट, राहुरी
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#166534]" />
              <span>पासबुक लोड होत आहे...</span>
            </div>
          ) : passbookEntries.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              अजून कोणतीही खातेवही नोंद उपलब्ध नाही.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">तारीख (Date)</th>
                    <th className="py-2.5 px-3">प्रकार (Type)</th>
                    <th className="py-2.5 px-3">बिल / पावती क्र.</th>
                    <th className="py-2.5 px-3">तपशील (Description)</th>
                    <th className="py-2.5 px-3 text-right">नावे / Debit (₹)</th>
                    <th className="py-2.5 px-3 text-right">जमा / Credit (₹)</th>
                    <th className="py-2.5 px-3 text-right">शिल्लक / Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {passbookEntries.map((e) => (
                    <tr
                      key={e._id}
                      className={`hover:bg-slate-50/60 ${e.isReversed ? 'text-slate-400 line-through' : ''}`}
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                        {formatDate(e.createdAt)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-700">
                          {e.entryType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                        {e.referenceId || '-'}
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-slate-900">{e.description}</p>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: INVOICES LIST */}
      {activeTab === 'invoices' && (
        <Card className="border-slate-200 p-5 shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                खरेदी बिले व GST पावत्या
              </h2>
              <p className="text-xs text-slate-500">
                पावती पाहण्यासाठी व छापण्यासाठी उजव्या बाजूच्या प्रिंट चिन्हावर क्लिक करा.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#166534]" />
              <span>बिले लोड होत आहेत...</span>
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              कोणतीही बिले आढळली नाहीत.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">बिल क्रमांक</th>
                    <th className="py-2.5 px-3">तारीख</th>
                    <th className="py-2.5 px-3 text-right">एकूण रक्कम</th>
                    <th className="py-2.5 px-3 text-right">जमा रक्कम</th>
                    <th className="py-2.5 px-3 text-right">बाकी शिल्लक</th>
                    <th className="py-2.5 px-3">स्थिती</th>
                    <th className="py-2.5 px-3 text-right">पावती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <tr key={inv._id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{formatDate(inv.invoiceDate)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {formatCurrency(inv.grandTotalPaise)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold">
                        {formatCurrency(inv.paidAmountPaise || inv.paidPaise)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        <span className={(inv.balanceDuePaise || inv.balancePaise) > 0 ? 'text-rose-600' : 'text-slate-400'}>
                          {formatCurrency(inv.balanceDuePaise || inv.balancePaise)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={
                            inv.status === 'PAID'
                              ? 'success'
                              : inv.status === 'PARTIAL'
                              ? 'warning'
                              : inv.status === 'CANCELLED'
                              ? 'default'
                              : 'danger'
                          }
                          size="sm"
                        >
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="p-1 text-slate-500 hover:text-[#166534] hover:bg-emerald-50 rounded"
                          title="कर पावती पहा"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Invoice Receipt Modal */}
      {selectedInvoice && (
        <InvoiceReceiptModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </PageContainer>
  );
}
