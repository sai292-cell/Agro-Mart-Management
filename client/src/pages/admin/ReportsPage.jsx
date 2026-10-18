import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  TrendingUp,
  Receipt,
  DollarSign,
  PieChart,
  Calendar,
  Download,
  Printer,
  AlertCircle,
  Package,
  Users,
  Building,
  RefreshCw,
  Info,
  CheckCircle,
} from 'lucide-react';
import {
  getSalesReportApi,
  getProfitabilityReportApi,
  getExpensesReportApi,
  getReceivablesAndPayablesApi,
  getInventoryValuationApi,
} from '../../services/api';

export default function ReportsPage() {
  const { t, i18n } = useTranslation();
  const isMr = i18n.language === 'mr';

  // Date range presets
  const [rangePreset, setRangePreset] = useState('THIS_MONTH');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  // Active tab
  const [activeTab, setActiveTab] = useState('PROFITABILITY'); // PROFITABILITY, SALES, EXPENSES, DEBT, VALUATION

  // Report data states
  const [salesReport, setSalesReport] = useState(null);
  const [profitReport, setProfitReport] = useState(null);
  const [expenseReport, setExpenseReport] = useState(null);
  const [debtReport, setDebtReport] = useState(null);
  const [valuationReport, setValuationReport] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const applyPreset = (preset) => {
    setRangePreset(preset);
    const today = new Date();
    const endStr = today.toISOString().slice(0, 10);
    let startD = new Date();

    if (preset === 'TODAY') {
      // today
    } else if (preset === 'YESTERDAY') {
      startD.setDate(startD.getDate() - 1);
      const startStr = startD.toISOString().slice(0, 10);
      setStartDate(startStr);
      setEndDate(startStr);
      return;
    } else if (preset === 'THIS_WEEK') {
      startD.setDate(startD.getDate() - 7);
    } else if (preset === 'THIS_MONTH') {
      startD.setDate(startD.getDate() - 30);
    }

    setStartDate(startD.toISOString().slice(0, 10));
    setEndDate(endStr);
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        startDate: new Date(`${startDate}T00:00:00.000Z`).toISOString(),
        endDate: new Date(`${endDate}T23:59:59.999Z`).toISOString(),
      };

      const [sales, profit, expenses, debt, valuation] = await Promise.all([
        getSalesReportApi(params),
        getProfitabilityReportApi(params),
        getExpensesReportApi(params),
        getReceivablesAndPayablesApi(),
        getInventoryValuationApi(),
      ]);

      setSalesReport(sales);
      setProfitReport(profit);
      setExpenseReport(expenses);
      setDebtReport(debt);
      setValuationReport(valuation);
    } catch (err) {
      setError(err.message || 'Failed to generate financial reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  const exportSalesCsv = () => {
    if (!salesReport?.topProducts) return;
    const headers = ['SKU', 'Product Name', 'Base Unit', 'Qty Sold', 'Gross Revenue (INR)', 'Net Revenue (INR)'];
    const rows = salesReport.topProducts.map((p) => [
      `"${p.sku}"`,
      `"${p.nameEn}"`,
      `"${p.baseUnit}"`,
      p.quantitySold,
      (p.grossRevenuePaise / 100).toFixed(2),
      (p.netRevenuePaise / 100).toFixed(2),
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sales_report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-text-main flex items-center space-x-2 text-2xl font-black">
            <BarChart3 className="text-primary h-7 w-7" />
            <span>{isMr ? 'व्यवसाय नफा-तोटा व वित्तीय अहवाल' : 'Profitability & Financial Reports'}</span>
          </h1>
          <p className="text-text-muted text-sm">
            {isMr
              ? 'बॅच-आधारित माल खरेदी खर्च (COGS), नफा मार्जिन, दुकान खर्च, येणे-देणे आणि साठा मूल्यांकन'
              : 'Batch-based COGS, gross and operating profit estimates, operating expenses, and inventory valuation'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportSalesCsv}
            className="border-border text-text-main hover:bg-surface-alt flex items-center space-x-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors shadow-xs"
          >
            <Download className="h-4 w-4" />
            <span>{isMr ? 'CSV निर्यात' : 'Export CSV'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="border-border text-text-main hover:bg-surface-alt flex items-center space-x-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors shadow-xs"
          >
            <Printer className="h-4 w-4" />
            <span>{isMr ? 'प्रिंट काढा' : 'Print'}</span>
          </button>
        </div>
      </div>

      {/* Date Filters & Presets Bar */}
      <div className="bg-surface border-border flex flex-col gap-4 rounded-xl border p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {['TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH'].map((preset) => (
            <button
              key={preset}
              onClick={() => applyPreset(preset)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                rangePreset === preset
                  ? 'bg-primary text-white'
                  : 'bg-surface-alt text-text-muted hover:text-text-main border border-border'
              }`}
            >
              {preset === 'TODAY' && (isMr ? 'आज' : 'Today')}
              {preset === 'YESTERDAY' && (isMr ? 'काल' : 'Yesterday')}
              {preset === 'THIS_WEEK' && (isMr ? 'चालू आठवडा (7D)' : 'Last 7 Days')}
              {preset === 'THIS_MONTH' && (isMr ? 'चालू महिना (30D)' : 'Last 30 Days')}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <Calendar className="text-text-muted h-4 w-4" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setRangePreset('CUSTOM');
            }}
            className="bg-surface-alt border-border text-text-main rounded-lg border px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
          />
          <span className="text-text-muted">{isMr ? 'ते' : 'to'}</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setRangePreset('CUSTOM');
            }}
            className="bg-surface-alt border-border text-text-main rounded-lg border px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
          />
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="border-border flex overflow-x-auto border-b text-sm font-bold">
        {[
          { id: 'PROFITABILITY', labelEn: 'Profitability & COGS', labelMr: 'नफा व तोटा (Profitability)' },
          { id: 'SALES', labelEn: 'Sales & Revenue', labelMr: 'विक्री व महसूल (Sales)' },
          { id: 'EXPENSES', labelEn: 'Operating Expenses', labelMr: 'दुकान खर्च (Expenses)' },
          { id: 'DEBT', labelEn: 'Receivables & Payables', labelMr: 'उधारी व देणे (Khata & AP)' },
          { id: 'VALUATION', labelEn: 'Inventory Valuation', labelMr: 'साठा मूल्यांकन (Stock Value)' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`border-b-2 px-4 py-3 whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            {isMr ? tab.labelMr : tab.labelEn}
          </button>
        ))}
      </div>

      {/* Content Rendering */}
      {loading ? (
        <div className="flex h-64 items-center justify-center text-text-muted">
          <span>{isMr ? 'वित्तीय आकडेमोड सुरू आहे...' : 'Computing financial metrics...'}</span>
        </div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center space-y-2 text-red-500">
          <AlertCircle className="h-8 w-8" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* TAB 1: PROFITABILITY & COGS */}
          {activeTab === 'PROFITABILITY' && profitReport && (
            <div className="space-y-6">
              {/* Disclosure Notice */}
              <div className="flex items-start space-x-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-xs text-blue-700 dark:text-blue-400">
                <Info className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold">{isMr ? 'लेखापाल टीप (Managerial Accounting Disclaimer):' : 'Managerial Accounting Disclaimer:'}</div>
                  <div>
                    {isMr
                      ? 'हा नफा अंदाज आवक बिलांवर नोंदवलेल्या बॅच खरेदी दरांवर (Batch Purchase Cost) आधारित आहे. हे वैधानिक सीए ऑडिट किंवा जीएसटी रिटर्न फाइलिंग नाही.'
                      : 'COGS is derived from batch purchase costs recorded at stock inward. This report is for managerial operational analysis and does not constitute a statutory tax audit or audited financial filing.'}
                  </div>
                </div>
              </div>

              {/* Profitability KPI Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="bg-surface border-border rounded-xl border p-4 shadow-xs">
                  <span className="text-text-muted text-xs font-semibold uppercase">
                    {isMr ? 'निव्वळ विक्री महसूल' : 'Net Sales Revenue'}
                  </span>
                  <div className="text-text-main mt-2 text-2xl font-black">
                    ₹{((profitReport.revenue.netSalesPaise || 0) / 100).toFixed(2)}
                  </div>
                  <div className="text-text-muted mt-1 text-xs">
                    {isMr ? 'सूट वजा करून' : 'after recorded discounts'}
                  </div>
                </div>

                <div className="bg-surface border-border rounded-xl border p-4 shadow-xs">
                  <span className="text-text-muted text-xs font-semibold uppercase">
                    - {isMr ? 'विकलेल्या मालाचा खर्च (COGS)' : 'Cost of Goods Sold (COGS)'}
                  </span>
                  <div className="mt-2 text-2xl font-black text-amber-600">
                    ₹{((profitReport.cogs.totalCogsPaise || 0) / 100).toFixed(2)}
                  </div>
                  <div className="text-text-muted mt-1 text-xs">
                    {profitReport.cogs.reliableItemsCount} {isMr ? 'बॅच-पडताळणी वस्तू' : 'verified batch items'}
                  </div>
                </div>

                <div className="bg-surface border-border rounded-xl border p-4 shadow-xs">
                  <span className="text-text-muted text-xs font-semibold uppercase">
                    = {isMr ? 'एकूण नफा (Gross Profit)' : 'Gross Profit'}
                  </span>
                  <div className="mt-2 text-2xl font-black text-emerald-600">
                    ₹{((profitReport.grossProfit.amountPaise || 0) / 100).toFixed(2)}
                  </div>
                  <div className="mt-1 text-xs font-bold text-emerald-600">
                    {profitReport.grossProfit.marginPercent}% {isMr ? 'सकल नफा मार्जिन' : 'gross margin'}
                  </div>
                </div>

                <div className="bg-surface border-border rounded-xl border p-4 shadow-xs">
                  <span className="text-text-muted text-xs font-semibold uppercase">
                    = {isMr ? 'निव्वळ कार्यचालन नफा' : 'Operating Net Profit'}
                  </span>
                  <div className={`mt-2 text-2xl font-black ${profitReport.operatingProfit.amountPaise >= 0 ? 'text-primary' : 'text-red-600'}`}>
                    ₹{((profitReport.operatingProfit.amountPaise || 0) / 100).toFixed(2)}
                  </div>
                  <div className="text-text-muted mt-1 text-xs font-semibold">
                    {profitReport.operatingProfit.marginPercent}% {isMr ? 'खर्च वजा जाता नफा' : 'after shop expenses'}
                  </div>
                </div>
              </div>

              {/* Profitability Waterfall */}
              <div className="bg-surface border-border rounded-xl border p-6 shadow-xs space-y-4">
                <h3 className="text-text-main font-bold border-b border-border pb-3">
                  {isMr ? 'नफा-तोटा विवरण (Profit & Loss Breakdown)' : 'Profit & Loss Statement Waterfall'}
                </h3>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-text-muted font-medium">{isMr ? 'सकल विक्री (Gross Invoice Sales):' : 'Gross Sales:'}</span>
                    <span className="font-semibold text-text-main">₹{((profitReport.revenue.grossSalesPaise || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-red-600">
                    <span>- {isMr ? 'नोंदवलेली बिल सूट (Discounts):' : 'Line Discounts:'}</span>
                    <span>-₹{((profitReport.revenue.discountsPaise || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-t border-border font-bold">
                    <span>= {isMr ? 'निव्वळ विक्री महसूल (Net Sales):' : 'Net Sales:'}</span>
                    <span>₹{((profitReport.revenue.netSalesPaise || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-amber-600">
                    <span>- {isMr ? 'विकलेल्या मालाचा खरेदी खर्च (COGS via Batches):' : 'Cost of Goods Sold (COGS):'}</span>
                    <span>-₹{((profitReport.cogs.totalCogsPaise || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-t border-border font-black text-emerald-600 text-base">
                    <span>= {isMr ? 'सकल नफा (Gross Profit):' : 'Gross Profit:'}</span>
                    <span>₹{((profitReport.grossProfit.amountPaise || 0) / 100).toFixed(2)} ({profitReport.grossProfit.marginPercent}%)</span>
                  </div>
                  <div className="flex justify-between py-1 text-red-600">
                    <span>- {isMr ? 'मंजूर दुकान खर्च (Operating Expenses):' : 'Store Operating Expenses:'}</span>
                    <span>-₹{((profitReport.operatingExpenses.totalAmountPaise || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-3 border-t-2 border-border font-black text-lg text-primary">
                    <span>= {isMr ? 'निव्वळ कार्यचालन नफा (Operating Profit):' : 'Operating Net Profit:'}</span>
                    <span>₹{((profitReport.operatingProfit.amountPaise || 0) / 100).toFixed(2)} ({profitReport.operatingProfit.marginPercent}%)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SALES & REVENUE */}
          {activeTab === 'SALES' && salesReport && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="bg-surface border-border rounded-xl border p-4 shadow-xs">
                  <span className="text-text-muted text-xs font-semibold uppercase">{isMr ? 'एकूण बिले' : 'Invoices'}</span>
                  <div className="text-text-main mt-1 text-2xl font-black">{salesReport.invoiceCount}</div>
                  <div className="text-text-muted mt-1 text-xs">
                    {salesReport.cancelledInvoiceCount} {isMr ? 'रद्द बिले वगळली' : 'cancelled invoices excluded'}
                  </div>
                </div>
                <div className="bg-surface border-border rounded-xl border p-4 shadow-xs">
                  <span className="text-text-muted text-xs font-semibold uppercase">{isMr ? 'एकूण कर (GST)' : 'Total Tax (CGST + SGST)'}</span>
                  <div className="text-text-main mt-1 text-2xl font-black">
                    ₹{((salesReport.totals.totalTaxPaise || 0) / 100).toFixed(2)}
                  </div>
                  <div className="text-text-muted mt-1 text-xs">
                    CGST: ₹{((salesReport.totals.totalCgstPaise || 0) / 100).toFixed(2)} • SGST: ₹{((salesReport.totals.totalSgstPaise || 0) / 100).toFixed(2)}
                  </div>
                </div>
                <div className="bg-surface border-border rounded-xl border p-4 shadow-xs">
                  <span className="text-text-muted text-xs font-semibold uppercase">{isMr ? 'उधारी शिल्लक' : 'Credit Balance'}</span>
                  <div className="text-amber-600 mt-1 text-2xl font-black">
                    ₹{((salesReport.totals.totalCreditBalancePaise || 0) / 100).toFixed(2)}
                  </div>
                  <div className="text-text-muted mt-1 text-xs">{isMr ? 'शेतकऱ्यांकडे बाकी' : 'receivable from credit sales'}</div>
                </div>
              </div>

              {/* Top Products Table */}
              <div className="bg-surface border-border overflow-hidden rounded-xl border shadow-xs">
                <div className="border-border border-b p-4">
                  <h3 className="text-text-main font-bold">{isMr ? 'सर्वाधिक खपाची उत्पादने (Top Products by Sales)' : 'Top Selling Products'}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface-alt border-border text-text-muted border-b text-xs uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-3">SKU</th>
                        <th className="px-4 py-3">{isMr ? 'उत्पादन नाव' : 'Product Name'}</th>
                        <th className="px-4 py-3 text-right">{isMr ? 'विक्री नग / प्रमाण' : 'Quantity Sold'}</th>
                        <th className="px-4 py-3 text-right">{isMr ? 'निव्वळ महसूल' : 'Net Revenue'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border divide-y">
                      {(salesReport.topProducts || []).map((p) => (
                        <tr key={p.productId} className="hover:bg-surface-alt/50">
                          <td className="text-text-muted px-4 py-3 font-mono text-xs">{p.sku}</td>
                          <td className="text-text-main px-4 py-3 font-semibold">{isMr ? p.nameMr : p.nameEn}</td>
                          <td className="text-text-main px-4 py-3 text-right">
                            {p.quantitySold} {p.baseUnit}
                          </td>
                          <td className="text-primary px-4 py-3 text-right font-bold">
                            ₹{((p.netRevenuePaise || 0) / 100).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OPERATING EXPENSES */}
          {activeTab === 'EXPENSES' && expenseReport && (
            <div className="space-y-6">
              <div className="bg-surface border-border rounded-xl border p-6 shadow-xs">
                <div className="flex justify-between items-center border-b border-border pb-3">
                  <h3 className="text-text-main font-bold">{isMr ? 'खर्च वर्गवारीनुसार विश्लेषण' : 'Operating Expenses by Category'}</h3>
                  <span className="text-lg font-black text-red-600">
                    एकूण: ₹{((expenseReport.totalExpensesPaise || 0) / 100).toFixed(2)}
                  </span>
                </div>

                <div className="divide-border divide-y mt-4">
                  {(expenseReport.byCategory || []).map((cat) => {
                    const pct = expenseReport.totalExpensesPaise > 0
                      ? ((cat.totalAmountPaise / expenseReport.totalExpensesPaise) * 100).toFixed(1)
                      : '0.0';
                    return (
                      <div key={cat._id} className="flex justify-between items-center py-3 text-sm">
                        <div>
                          <span className="text-text-main font-semibold">{cat._id}</span>
                          <span className="text-text-muted text-xs ml-2">({cat.count} {isMr ? 'नोंदी' : 'vouchers'})</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-text-main">₹{((cat.totalAmountPaise || 0) / 100).toFixed(2)}</div>
                          <div className="text-text-muted text-xs">{pct}% {isMr ? 'एकूण खर्च्यापैकी' : 'of total'}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RECEIVABLES & PAYABLES */}
          {activeTab === 'DEBT' && debtReport && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="bg-surface border-border rounded-xl border p-6 shadow-xs space-y-4">
                <div className="flex items-center space-x-2 border-b border-border pb-3">
                  <Users className="text-amber-600 h-5 w-5" />
                  <h3 className="text-text-main font-bold">{isMr ? 'शेतकरी उधारी येणे (Accounts Receivable)' : 'Customer Khata Receivables'}</h3>
                </div>
                <div className="text-3xl font-black text-amber-600">
                  ₹{((debtReport.receivables.totalReceivablesPaise || 0) / 100).toFixed(2)}
                </div>
                <p className="text-text-muted text-xs">
                  {debtReport.receivables.customerCount} {isMr ? 'नोंदणीकृत शेतकरी ग्राहक' : 'registered farmer accounts'}
                </p>
                <div className="text-xs text-text-muted border-t border-border pt-3">
                  {isMr ? 'शेतकऱ्यांकडे अगाऊ जमा (Advance):' : 'Advance credit balance held:'} ₹{((debtReport.receivables.totalAdvancesPaise || 0) / 100).toFixed(2)}
                </div>
              </div>

              <div className="bg-surface border-border rounded-xl border p-6 shadow-xs space-y-4">
                <div className="flex items-center space-x-2 border-b border-border pb-3">
                  <Building className="text-purple-600 h-5 w-5" />
                  <h3 className="text-text-main font-bold">{isMr ? 'सप्लायर देय बाकी (Accounts Payable)' : 'Supplier Accounts Payable'}</h3>
                </div>
                <div className="text-3xl font-black text-purple-600">
                  ₹{((debtReport.payables.totalPayablesPaise || 0) / 100).toFixed(2)}
                </div>
                <p className="text-text-muted text-xs">
                  {debtReport.payables.supplierCount} {isMr ? 'सप्लायर / कंपनी खाती' : 'active suppliers'}
                </p>
                <div className="text-xs text-text-muted border-t border-border pt-3">
                  {isMr ? 'सप्लायरकडे अगाऊ जमा (Advance Paid):' : 'Advance paid to suppliers:'} ₹{((debtReport.payables.totalAdvancesPaise || 0) / 100).toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: INVENTORY VALUATION */}
          {activeTab === 'VALUATION' && valuationReport && (
            <div className="space-y-6">
              <div className="bg-surface border-border rounded-xl border p-6 shadow-xs flex justify-between items-center">
                <div>
                  <h3 className="text-text-main font-bold">{isMr ? 'एकूण साठा मूल्यांकन (At Batch Purchase Cost)' : 'Physical Inventory Valuation'}</h3>
                  <p className="text-text-muted text-xs">{valuationReport.batchesCount} {isMr ? 'सक्रिय बॅचेस' : 'active batches in stock'}</p>
                </div>
                <div className="text-3xl font-black text-primary">
                  ₹{((valuationReport.totalValuationPaise || 0) / 100).toFixed(2)}
                </div>
              </div>

              <div className="bg-surface border-border overflow-hidden rounded-xl border shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface-alt border-border text-text-muted border-b text-xs uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-3">SKU</th>
                        <th className="px-4 py-3">{isMr ? 'उत्पादन नाव' : 'Product Name'}</th>
                        <th className="px-4 py-3">{isMr ? 'बॅच क्र.' : 'Batch #'}</th>
                        <th className="px-4 py-3 text-right">{isMr ? 'शिल्लक साठा' : 'Available Stock'}</th>
                        <th className="px-4 py-3 text-right">{isMr ? 'खरेदी दर' : 'Unit Cost'}</th>
                        <th className="px-4 py-3 text-right">{isMr ? 'एकूण मूल्य' : 'Total Value'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border divide-y">
                      {(valuationReport.batches || []).map((b) => (
                        <tr key={b.batchId} className="hover:bg-surface-alt/50">
                          <td className="text-text-muted px-4 py-3 font-mono text-xs">{b.sku}</td>
                          <td className="text-text-main px-4 py-3 font-semibold">{isMr ? b.productNameMr : b.productNameEn}</td>
                          <td className="text-text-muted px-4 py-3 text-xs">{b.batchNumber}</td>
                          <td className="text-text-main px-4 py-3 text-right">{b.availableStock} {b.baseUnit}</td>
                          <td className="text-text-muted px-4 py-3 text-right">₹{((b.purchaseCostPaisePerUnit || 0) / 100).toFixed(2)}</td>
                          <td className="text-primary px-4 py-3 text-right font-bold">₹{((b.totalValuePaise || 0) / 100).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
