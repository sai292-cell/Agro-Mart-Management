import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ShoppingCart,
  Receipt,
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  UserPlus,
  CreditCard,
  QrCode,
  Banknote,
  Clock,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Printer,
  ChevronRight,
  Shield,
  Layers,
  History,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import PageContainer from '../../components/layout/PageContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';

import {
  getProductsApi,
  getInvoicesApi,
  checkoutInvoiceApi,
  getBillingCustomersApi,
} from '../../services/api';

import InvoiceReceiptModal from '../../components/pos/InvoiceReceiptModal';
import RecordPaymentModal from '../../components/pos/RecordPaymentModal';
import CancelInvoiceModal from '../../components/pos/CancelInvoiceModal';
import QuickCustomerModal from '../../components/pos/QuickCustomerModal';

export default function PosBillingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Tab State: 'counter' | 'history'
  const [activeTab, setActiveTab] = useState('counter');

  // Products & Catalog State
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchProduct, setSearchProduct] = useState('');
  const [selectedCategoryType, setSelectedCategoryType] = useState('ALL');

  // Cart State
  // item: { product, quantity, unitPricePaise, gstRate, lineTotalPaise }
  const [cart, setCart] = useState([]);
  const [discountRupees, setDiscountRupees] = useState('0');
  const [notes, setNotes] = useState('');

  // Customer State
  const [customerMode, setCustomerMode] = useState('WALK_IN'); // 'WALK_IN' | 'REGISTERED'
  const [customersList, setCustomersList] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');

  // Payment State
  const [paymentMode, setPaymentMode] = useState('CASH'); // 'CASH' | 'UPI' | 'CREDIT' | 'SPLIT'
  const [cashAmountRupees, setCashAmountRupees] = useState('');
  const [upiAmountRupees, setUpiAmountRupees] = useState('');
  const [singleAmountRupees, setSingleAmountRupees] = useState('');
  const [upiReference, setUpiReference] = useState('');

  // Invoices History State
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('ALL');

  // UI Modals
  const [selectedReceiptInvoice, setSelectedReceiptInvoice] = useState(null);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState(null);
  const [cancelModalInvoice, setCancelModalInvoice] = useState(null);
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false);

  // Status & Feedback
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }

  const barcodeInputRef = useRef(null);

  // Format currency helpers
  const formatCurrency = (paise) => '₹' + ((Number(paise) || 0) / 100).toFixed(2);
  const formatRupees = (rupees) => '₹' + (Number(rupees) || 0).toFixed(2);

  // 1. Fetch Products
  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const params = { active: 'true', limit: 80 };
      if (searchProduct.trim()) params.search = searchProduct.trim();
      if (selectedCategoryType !== 'ALL') params.categoryType = selectedCategoryType;
      const res = await getProductsApi(params);
      setProducts(res.products || []);
    } catch (err) {
      console.error('Failed to load products', err);
    } finally {
      setLoadingProducts(false);
    }
  }, [searchProduct, selectedCategoryType]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadProducts]);

  // 2. Fetch Customers for POS selector
  const loadCustomers = useCallback(async (search = '') => {
    try {
      const res = await getBillingCustomersApi({ search, limit: 30 });
      setCustomersList(res.customers || []);
    } catch (err) {
      console.error('Failed to load customers', err);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // 3. Fetch Invoices History
  const loadInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    try {
      const params = { limit: 30 };
      if (invoiceSearch.trim()) params.search = invoiceSearch.trim();
      if (invoiceStatusFilter !== 'ALL') params.status = invoiceStatusFilter;
      const res = await getInvoicesApi(params);
      setInvoices(res.invoices || []);
    } catch (err) {
      console.error('Failed to load invoices', err);
    } finally {
      setLoadingInvoices(false);
    }
  }, [invoiceSearch, invoiceStatusFilter]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadInvoices();
    }
  }, [activeTab, loadInvoices]);

  // 4. Cart Operations
  const addToCart = (product) => {
    setFeedback(null);
    if (!product.currentStock || product.currentStock <= 0) {
      setFeedback({ type: 'error', message: `Cannot add ${product.name}: Out of stock.` });
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product._id === product._id);
      if (existing) {
        if (existing.quantity >= product.currentStock) {
          setFeedback({
            type: 'error',
            message: `Only ${product.currentStock} ${product.unit} available in stock for ${product.name}.`,
          });
          return prev;
        }
        return prev.map((item) =>
          item.product._id === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [
          ...prev,
          {
            product,
            quantity: 1,
            unitSellingPricePaise: product.sellingPricePaise,
            gstRate: product.gstRate || 0,
          },
        ];
      }
    });
  };

  const updateQuantity = (productId, delta) => {
    setFeedback(null);
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product._id === productId) {
            const nextQty = item.quantity + delta;
            if (nextQty <= 0) return null;
            if (nextQty > item.product.currentStock) {
              setFeedback({
                type: 'error',
                message: `Maximum stock available for ${item.product.name} is ${item.product.currentStock} ${item.product.unit}.`,
              });
              return item;
            }
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.product._id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountRupees('0');
    setNotes('');
    setCashAmountRupees('');
    setUpiAmountRupees('');
    setSingleAmountRupees('');
    setUpiReference('');
  };

  // 5. Financial Live Calculations (Tax Inclusive)
  const cartFinancials = React.useMemo(() => {
    let grossTotalPaise = 0;
    let taxableSubtotalPaise = 0;
    let cgstTotalPaise = 0;
    let sgstTotalPaise = 0;

    cart.forEach((item) => {
      const itemGross = item.unitSellingPricePaise * item.quantity;
      grossTotalPaise += itemGross;

      const rate = item.gstRate || 0;
      let taxable = itemGross;
      let cgst = 0;
      let sgst = 0;

      if (rate > 0) {
        taxable = Math.round((itemGross * 100) / (100 + rate));
        const totalTax = itemGross - taxable;
        cgst = Math.floor(totalTax / 2);
        sgst = totalTax - cgst;
      }

      taxableSubtotalPaise += taxable;
      cgstTotalPaise += cgst;
      sgstTotalPaise += sgst;
    });

    const parsedDiscountRupees = Math.max(0, parseFloat(discountRupees) || 0);
    const discountPaise = Math.round(parsedDiscountRupees * 100);

    const netBeforeRoundPaise = Math.max(0, grossTotalPaise - discountPaise);
    const roundedRupees = Math.round(netBeforeRoundPaise / 100);
    const grandTotalPaise = roundedRupees * 100;
    const roundOffPaise = grandTotalPaise - netBeforeRoundPaise;

    return {
      grossTotalPaise,
      taxableSubtotalPaise,
      cgstTotalPaise,
      sgstTotalPaise,
      taxTotalPaise: cgstTotalPaise + sgstTotalPaise,
      discountPaise,
      roundOffPaise,
      grandTotalPaise,
    };
  }, [cart, discountRupees]);

  // Synchronize default amount received when grand total changes
  useEffect(() => {
    const totalRupees = (cartFinancials.grandTotalPaise / 100).toFixed(2);
    if (paymentMode === 'CASH' || paymentMode === 'UPI') {
      setSingleAmountRupees(totalRupees);
    } else if (paymentMode === 'CREDIT') {
      setSingleAmountRupees('0.00');
    }
  }, [cartFinancials.grandTotalPaise, paymentMode]);

  // Derived Paid & Balance for the preview
  const derivedPaymentDetails = React.useMemo(() => {
    let paidPaise = 0;
    if (paymentMode === 'CASH' || paymentMode === 'UPI') {
      const amt = parseFloat(singleAmountRupees) || 0;
      paidPaise = Math.round(amt * 100);
    } else if (paymentMode === 'SPLIT') {
      const cash = parseFloat(cashAmountRupees) || 0;
      const upi = parseFloat(upiAmountRupees) || 0;
      paidPaise = Math.round(cash * 100) + Math.round(upi * 100);
    } else if (paymentMode === 'CREDIT') {
      const partial = parseFloat(singleAmountRupees) || 0;
      paidPaise = Math.round(partial * 100);
    }

    const balancePaise = Math.max(0, cartFinancials.grandTotalPaise - paidPaise);
    return { paidPaise, balancePaise };
  }, [paymentMode, singleAmountRupees, cashAmountRupees, upiAmountRupees, cartFinancials.grandTotalPaise]);

  // 6. Finalize Sale
  const handleFinalizeSale = async () => {
    setFeedback(null);

    if (cart.length === 0) {
      setFeedback({ type: 'error', message: 'Cart is empty. Add products to finalize sale.' });
      return;
    }

    // Customer validation
    let saleType = 'CASH';
    let customerId = null;
    let customerName = walkInName.trim();
    let customerPhone = walkInPhone.trim();

    if (customerMode === 'REGISTERED') {
      if (!selectedCustomer) {
        setFeedback({ type: 'error', message: 'Please select a registered farmer or switch to Walk-in Customer.' });
        return;
      }
      customerId = selectedCustomer._id;
      customerName = selectedCustomer.name;
      customerPhone = selectedCustomer.phone;
    }

    // Credit policy verification
    if (paymentMode === 'CREDIT' || (derivedPaymentDetails.balancePaise > 0 && customerMode === 'REGISTERED')) {
      saleType = 'CREDIT';
      if (!selectedCustomer) {
        setFeedback({
          type: 'error',
          message: 'Farmer Credit (उधारी) is strictly prohibited for Walk-in customers. Select a registered farmer.',
        });
        return;
      }
      if (selectedCustomer.creditLimitPaise && derivedPaymentDetails.balancePaise > selectedCustomer.creditLimitPaise) {
        setFeedback({
          type: 'error',
          message: `Sale exceeds farmer credit limit of ${formatCurrency(selectedCustomer.creditLimitPaise)}. Approval required.`,
        });
        return;
      }
    } else if (paymentMode === 'UPI') {
      saleType = 'UPI';
    } else if (paymentMode === 'SPLIT') {
      saleType = 'MIXED';
    }

    // Payment validation
    const paymentsPayload = [];
    if (paymentMode === 'CASH') {
      const cashAmt = Math.round((parseFloat(singleAmountRupees) || 0) * 100);
      if (cashAmt > 0) {
        paymentsPayload.push({
          paymentMode: 'CASH',
          amountPaise: cashAmt,
        });
      }
    } else if (paymentMode === 'UPI') {
      const upiAmt = Math.round((parseFloat(singleAmountRupees) || 0) * 100);
      if (upiAmt > 0) {
        if (!upiReference.trim()) {
          setFeedback({ type: 'error', message: 'UPI Reference ID / UTR Number is mandatory for UPI payments.' });
          return;
        }
        paymentsPayload.push({
          paymentMode: 'UPI',
          amountPaise: upiAmt,
          transactionReference: upiReference.trim(),
        });
      }
    } else if (paymentMode === 'SPLIT') {
      const cashAmt = Math.round((parseFloat(cashAmountRupees) || 0) * 100);
      const upiAmt = Math.round((parseFloat(upiAmountRupees) || 0) * 100);
      if (cashAmt > 0) {
        paymentsPayload.push({ paymentMode: 'CASH', amountPaise: cashAmt });
      }
      if (upiAmt > 0) {
        if (!upiReference.trim()) {
          setFeedback({ type: 'error', message: 'UPI Reference ID / UTR Number is required for the UPI portion.' });
          return;
        }
        paymentsPayload.push({
          paymentMode: 'UPI',
          amountPaise: upiAmt,
          transactionReference: upiReference.trim(),
        });
      }
    } else if (paymentMode === 'CREDIT') {
      const partialCash = Math.round((parseFloat(singleAmountRupees) || 0) * 100);
      if (partialCash > 0) {
        paymentsPayload.push({
          paymentMode: 'CASH',
          amountPaise: partialCash,
        });
      }
    }

    // Checkout payload
    const payload = {
      customerId: customerId || undefined,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      saleType,
      items: cart.map((item) => ({
        productId: item.product._id,
        quantity: item.quantity,
      })),
      discountPaise: cartFinancials.discountPaise,
      payments: paymentsPayload,
      notes: notes.trim() || undefined,
    };

    setSubmitting(true);
    try {
      const idempotencyKey = 'pos_sale_' + crypto.randomUUID();
      const res = await checkoutInvoiceApi(payload, idempotencyKey);

      setFeedback({
        type: 'success',
        message: `Invoice ${res.invoice.invoiceNumber} finalized successfully!`,
      });

      // Clear Cart and Open Invoice Print Receipt
      clearCart();
      setSelectedCustomer(null);
      setWalkInName('');
      setWalkInPhone('');
      setSelectedReceiptInvoice(res.invoice);

      // Refresh product stock
      loadProducts();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Checkout failed. Please check stock and batch availability.',
      });
    } finally {
      setSubmitting(false);
    }
  };

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
                {t('pos.title', 'Point-of-Sale Billing & Invoice Counter')}
              </h1>
              <Badge variant="primary" size="sm">
                POS v1.0
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              Shivshree Agro Mart — Maharashtra Certified Agro-Retail Billing System
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('counter')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'counter'
                ? 'bg-white text-[#166534] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>{t('pos.tabs.counter', 'Billing Counter')}</span>
            {cart.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#166534] text-white text-[10px] flex items-center justify-center font-mono">
                {cart.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-white text-[#166534] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>{t('pos.tabs.history', 'Invoice History & Audit')}</span>
          </button>
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

      {/* TAB 1: POS COUNTER BILLING */}
      {activeTab === 'counter' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Product Catalog & Search (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="border-slate-200 shadow-xs p-4">
              {/* Product Search & Category Bar */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    value={searchProduct}
                    onChange={(e) => setSearchProduct(e.target.value)}
                    placeholder="Search fertilizer, seed, pesticide by name, SKU or barcode..."
                    className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] bg-slate-50/50"
                  />
                </div>

                {/* Category Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  {['ALL', 'FERTILIZER', 'SEED', 'PESTICIDE', 'EQUIPMENT', 'OTHER'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategoryType(cat)}
                      className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors text-[11px] ${
                        selectedCategoryType === cat
                          ? 'bg-[#166534] text-white font-bold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat === 'ALL' ? 'All Products / सर्व' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Products Grid */}
              <div className="mt-4 border-t border-slate-100 pt-3">
                {loadingProducts ? (
                  <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#166534]" />
                    <span>Loading verified agro inventory...</span>
                  </div>
                ) : products.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No available products found matching your search.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[550px] overflow-y-auto pr-1">
                    {products.map((p) => {
                      const isOutOfStock = !p.currentStock || p.currentStock <= 0;
                      return (
                        <div
                          key={p._id}
                          onClick={() => !isOutOfStock && addToCart(p)}
                          className={`p-3 rounded-xl border text-xs transition-all flex flex-col justify-between ${
                            isOutOfStock
                              ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                              : 'bg-white border-slate-200 hover:border-emerald-500 hover:shadow-xs cursor-pointer'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <span className="font-bold text-slate-900 leading-snug line-clamp-1">
                                {p.name}
                              </span>
                              <Badge
                                variant={isOutOfStock ? 'danger' : p.currentStock <= p.reorderLevel ? 'warning' : 'success'}
                                size="sm"
                              >
                                {isOutOfStock ? 'Out of Stock' : `${p.currentStock} ${p.unit}`}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                              <span className="font-mono">SKU: {p.sku}</span>
                              {p.hsnCode && <span>HSN: {p.hsnCode}</span>}
                              <span>GST: {p.gstRate}%</span>
                            </div>
                          </div>

                          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="font-mono font-bold text-sm text-[#166534]">
                              {formatCurrency(p.sellingPricePaise)}
                            </span>
                            <button
                              disabled={isOutOfStock}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors ${
                                isOutOfStock
                                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                  : 'bg-emerald-50 text-[#166534] hover:bg-[#166534] hover:text-white'
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* RIGHT COLUMN: Active Cart, Customer Selector & Checkout (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="border-slate-200 shadow-xs p-4">
              {/* Customer Selector Section */}
              <div className="mb-4 pb-4 border-b border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-[#166534]" />
                    {t('pos.customer.heading', 'Customer & Billing Type')}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowQuickCustomerModal(true)}
                    className="text-[11px] font-bold text-[#166534] hover:underline flex items-center gap-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    + New Farmer
                  </button>
                </div>

                {/* Customer Mode Radio Tabs */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerMode('WALK_IN');
                      setSelectedCustomer(null);
                      if (paymentMode === 'CREDIT') setPaymentMode('CASH');
                    }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                      customerMode === 'WALK_IN'
                        ? 'border-[#166534] bg-emerald-50 text-[#166534] ring-1 ring-[#166534]'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🚶 Walk-in (रोख/UPI)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerMode('REGISTERED')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                      customerMode === 'REGISTERED'
                        ? 'border-[#166534] bg-emerald-50 text-[#166534] ring-1 ring-[#166534]'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🚜 Registered Farmer (खाते)
                  </button>
                </div>

                {customerMode === 'WALK_IN' ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <input
                      type="text"
                      placeholder="Name (Optional)"
                      value={walkInName}
                      onChange={(e) => setWalkInName(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#166534]"
                    />
                    <input
                      type="tel"
                      placeholder="Phone (Optional)"
                      value={walkInPhone}
                      onChange={(e) => setWalkInPhone(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#166534]"
                    />
                  </div>
                ) : (
                  <div>
                    <select
                      value={selectedCustomer?._id || ''}
                      onChange={(e) => {
                        const cust = customersList.find((c) => c._id === e.target.value);
                        setSelectedCustomer(cust || null);
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#166534] bg-white font-medium text-slate-800"
                    >
                      <option value="">-- Select Farmer from List --</option>
                      {customersList.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name} {c.phone ? `(${c.phone})` : ''} - {c.village || 'राहुरी'} [Limit: ₹{(c.creditLimitPaise / 100).toFixed(0)}]
                        </option>
                      ))}
                    </select>
                    {selectedCustomer && (
                      <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] flex justify-between text-emerald-900">
                        <span>गाव: {selectedCustomer.village || 'N/A'}</span>
                        <span className="font-bold">
                          उधारी मर्यादा: {formatCurrency(selectedCustomer.creditLimitPaise)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Cart Items List */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ShoppingCart className="w-4 h-4 text-[#166534]" />
                    {t('pos.cart.heading', 'Cart Items')} ({cart.length})
                  </h3>
                  {cart.length > 0 && (
                    <button
                      onClick={clearCart}
                      className="text-[11px] text-rose-600 hover:underline font-semibold"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {cart.length === 0 ? (
                  <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                    Cart is empty. Click items on the left to add.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div
                        key={item.product._id}
                        className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs"
                      >
                        <div className="flex-1 mr-2">
                          <p className="font-bold text-slate-900 line-clamp-1">{item.product.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {formatCurrency(item.unitSellingPricePaise)} × {item.quantity} {item.product.unit}
                          </p>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-1 mr-3">
                          <button
                            onClick={() => updateQuantity(item.product._id, -1)}
                            className="w-6 h-6 rounded bg-white border border-slate-300 text-slate-700 flex items-center justify-center font-bold hover:bg-slate-100"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-7 text-center font-mono font-bold">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product._id, 1)}
                            className="w-6 h-6 rounded bg-white border border-slate-300 text-slate-700 flex items-center justify-center font-bold hover:bg-slate-100"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="text-right">
                          <p className="font-mono font-bold text-slate-900">
                            {formatCurrency(item.unitSellingPricePaise * item.quantity)}
                          </p>
                          <button
                            onClick={() => removeFromCart(item.product._id)}
                            className="text-[10px] text-rose-500 hover:text-rose-700 mt-0.5 inline-block"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Financial Calculation Summary */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5 mb-4">
                <div className="flex justify-between text-slate-600">
                  <span>Taxable Subtotal:</span>
                  <span className="font-mono">{formatCurrency(cartFinancials.taxableSubtotalPaise)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>CGST (Intrastate 50%):</span>
                  <span className="font-mono">{formatCurrency(cartFinancials.cgstTotalPaise)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>SGST (Intrastate 50%):</span>
                  <span className="font-mono">{formatCurrency(cartFinancials.sgstTotalPaise)}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-700 font-medium">Bill Discount (₹):</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={discountRupees}
                    onChange={(e) => setDiscountRupees(e.target.value)}
                    className="w-20 px-2 py-0.5 text-right font-mono text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#166534]"
                  />
                </div>
                {cartFinancials.roundOffPaise !== 0 && (
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>Round-off:</span>
                    <span className="font-mono">
                      {cartFinancials.roundOffPaise > 0 ? '+' : ''}
                      {formatCurrency(cartFinancials.roundOffPaise)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t-2 border-[#166534] font-bold text-sm text-[#166534]">
                  <span>Grand Total Due:</span>
                  <span className="font-mono text-base">
                    {formatCurrency(cartFinancials.grandTotalPaise)}
                  </span>
                </div>
              </div>

              {/* Payment Settlement Panel */}
              <div className="space-y-3 mb-4">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-[#166534]" />
                  {t('pos.payment.heading', 'Payment Mode & Settlement')}
                </h3>

                {/* Payment Mode Selector */}
                <div className="grid grid-cols-4 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('CASH')}
                    className={`py-1.5 rounded-lg border font-semibold text-center transition-all ${
                      paymentMode === 'CASH'
                        ? 'border-[#166534] bg-emerald-50 text-[#166534] ring-1 ring-[#166534]'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    💵 Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('UPI')}
                    className={`py-1.5 rounded-lg border font-semibold text-center transition-all ${
                      paymentMode === 'UPI'
                        ? 'border-[#166534] bg-emerald-50 text-[#166534] ring-1 ring-[#166534]'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    📱 UPI
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (customerMode !== 'REGISTERED') {
                        setFeedback({
                          type: 'error',
                          message: 'Farmer Credit requires a registered customer account.',
                        });
                        return;
                      }
                      setPaymentMode('CREDIT');
                    }}
                    className={`py-1.5 rounded-lg border font-semibold text-center transition-all ${
                      paymentMode === 'CREDIT'
                        ? 'border-[#166534] bg-emerald-50 text-[#166534] ring-1 ring-[#166534]'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🌾 Credit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('SPLIT')}
                    className={`py-1.5 rounded-lg border font-semibold text-center transition-all ${
                      paymentMode === 'SPLIT'
                        ? 'border-[#166534] bg-emerald-50 text-[#166534] ring-1 ring-[#166534]'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    ⚖️ Split
                  </button>
                </div>

                {/* Payment Mode Specific Inputs */}
                {paymentMode === 'CASH' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Cash Received (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={singleAmountRupees}
                      onChange={(e) => setSingleAmountRupees(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#166534]"
                    />
                  </div>
                )}

                {paymentMode === 'UPI' && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        UPI Received (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={singleAmountRupees}
                        onChange={(e) => setSingleAmountRupees(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#166534]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        UPI Reference / UTR Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="12-digit UTR ID"
                        value={upiReference}
                        onChange={(e) => setUpiReference(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#166534]"
                      />
                    </div>
                  </div>
                )}

                {paymentMode === 'SPLIT' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Cash Amount (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={cashAmountRupees}
                          onChange={(e) => setCashAmountRupees(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#166534]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          UPI Amount (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={upiAmountRupees}
                          onChange={(e) => setUpiAmountRupees(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#166534]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        UPI Reference / UTR Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="12-digit UTR ID"
                        value={upiReference}
                        onChange={(e) => setUpiReference(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#166534]"
                      />
                    </div>
                  </div>
                )}

                {paymentMode === 'CREDIT' && (
                  <div className="space-y-2 bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-xs text-amber-900">
                    <p className="font-bold flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                      Farmer Credit Sale (उधारी विक्री)
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      Outstanding balance will be debited to {selectedCustomer?.name || 'Customer'}&apos;s credit account.
                    </p>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Immediate Partial Payment at Counter (₹, if any):
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={singleAmountRupees}
                        onChange={(e) => setSingleAmountRupees(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#166534]"
                      />
                    </div>
                  </div>
                )}

                {/* Remaining Balance Indicator */}
                <div className="flex justify-between items-center text-xs p-2 rounded-lg bg-slate-100 font-semibold">
                  <span className="text-slate-600">Balance Outstanding:</span>
                  <span
                    className={`font-mono text-sm ${
                      derivedPaymentDetails.balancePaise > 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    {formatCurrency(derivedPaymentDetails.balancePaise)}
                  </span>
                </div>
              </div>

              {/* Finalize Button */}
              <Button
                variant="primary"
                size="md"
                disabled={submitting || cart.length === 0}
                onClick={handleFinalizeSale}
                className="w-full py-3 bg-[#166534] hover:bg-[#14532d] font-bold text-sm shadow-md"
              >
                {submitting ? 'Atomic Stock Deduction in Progress...' : 'Finalize Sale & Generate Bill (बिल पूर्ण करा)'}
              </Button>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: INVOICE HISTORY & AUDIT */}
      {activeTab === 'history' && (
        <Card className="border-slate-200 shadow-xs p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {t('pos.invoices.history', 'Tax Invoice Records & Payment Audit')}
              </h2>
              <p className="text-xs text-slate-500">
                Audited point-of-sale invoices with atomic stock ledger traces
              </p>
            </div>

            {/* History Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Invoice # or Customer name..."
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#166534]"
                />
              </div>

              <select
                value={invoiceStatusFilter}
                onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#166534] bg-white text-slate-700"
              >
                <option value="ALL">All Statuses / सर्व</option>
                <option value="PAID">PAID (पूर्ण जमा)</option>
                <option value="PARTIAL">PARTIAL (अंशतः बाकी)</option>
                <option value="UNPAID">UNPAID (थकबाकी)</option>
                <option value="CANCELLED">CANCELLED (रद्द)</option>
              </select>

              <Button
                variant="outline"
                size="sm"
                icon={RefreshCw}
                onClick={loadInvoices}
                className="text-slate-600"
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* Invoices Table */}
          {loadingInvoices ? (
            <div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#166534]" />
              <span>Loading invoice audit history...</span>
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              No invoices found matching criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Sale Type</th>
                    <th className="py-3 px-4 text-right">Grand Total</th>
                    <th className="py-3 px-4 text-right">Paid</th>
                    <th className="py-3 px-4 text-right">Balance</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <tr key={inv._id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(inv.invoiceDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">
                          {inv.customerSnapshot?.name || 'Walk-in'}
                        </span>
                        {inv.customerSnapshot?.village && (
                          <span className="text-[10px] text-slate-400 block">
                            {inv.customerSnapshot.village}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="default" size="sm">
                          {inv.saleType}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(inv.grandTotalPaise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700">
                        {formatCurrency(inv.paidPaise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span className={inv.balancePaise > 0 ? 'text-rose-600' : 'text-slate-400'}>
                          {formatCurrency(inv.balancePaise)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
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
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View / Print Receipt */}
                          <button
                            onClick={() => setSelectedReceiptInvoice(inv)}
                            title="View / Print Receipt"
                            className="p-1.5 text-slate-600 hover:text-[#166534] hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Record Payment against Outstanding */}
                          {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                            <button
                              onClick={() => setPaymentModalInvoice(inv)}
                              title="Collect Payment"
                              className="px-2 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
                            >
                              Pay
                            </button>
                          )}

                          {/* Cancel Invoice (OWNER and MANAGER only) */}
                          {(user?.role === 'OWNER' || user?.role === 'MANAGER') &&
                            inv.status !== 'CANCELLED' && (
                              <button
                                onClick={() => setCancelModalInvoice(inv)}
                                title="Cancel Invoice"
                                className="px-2 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors"
                              >
                                Cancel
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
        </Card>
      )}

      {/* MODAL 1: Tax Invoice Receipt Preview & Print */}
      {selectedReceiptInvoice && (
        <InvoiceReceiptModal
          invoice={selectedReceiptInvoice}
          onClose={() => setSelectedReceiptInvoice(null)}
        />
      )}

      {/* MODAL 2: Record Payment against Outstanding Invoice */}
      {paymentModalInvoice && (
        <RecordPaymentModal
          invoice={paymentModalInvoice}
          onClose={() => setPaymentModalInvoice(null)}
          onSuccess={(updatedInvoice) => {
            setPaymentModalInvoice(null);
            setFeedback({
              type: 'success',
              message: `Payment recorded against ${updatedInvoice.invoiceNumber}. Remaining balance: ${formatCurrency(updatedInvoice.balancePaise)}`,
            });
            loadInvoices();
          }}
        />
      )}

      {/* MODAL 3: Cancel Invoice & Reverse Stock Movements */}
      {cancelModalInvoice && (
        <CancelInvoiceModal
          invoice={cancelModalInvoice}
          onClose={() => setCancelModalInvoice(null)}
          onSuccess={(cancelledInvoice) => {
            setCancelModalInvoice(null);
            setFeedback({
              type: 'success',
              message: `Invoice ${cancelledInvoice.invoiceNumber} cancelled and stock reversed successfully.`,
            });
            loadInvoices();
            loadProducts();
          }}
        />
      )}

      {/* MODAL 4: Quick Customer Registration */}
      {showQuickCustomerModal && (
        <QuickCustomerModal
          userRole={user?.role}
          onClose={() => setShowQuickCustomerModal(false)}
          onSuccess={(newCustomer) => {
            setShowQuickCustomerModal(false);
            setFeedback({
              type: 'success',
              message: `Farmer ${newCustomer.name} registered successfully.`,
            });
            loadCustomers();
            setSelectedCustomer(newCustomer);
            setCustomerMode('REGISTERED');
          }}
        />
      )}
    </PageContainer>
  );
}
