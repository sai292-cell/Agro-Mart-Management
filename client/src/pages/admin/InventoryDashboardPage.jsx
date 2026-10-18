import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Package,
  Layers,
  AlertTriangle,
  History,
  FolderTree,
  Plus,
  ArrowDownToLine,
  SlidersHorizontal,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Edit2,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldAlert,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import PageContainer from '../../components/layout/PageContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import ProductFormModal from '../../components/inventory/ProductFormModal';
import ProductDetailsModal from '../../components/inventory/ProductDetailsModal';
import StockReceiptModal from '../../components/inventory/StockReceiptModal';
import StockAdjustmentModal from '../../components/inventory/StockAdjustmentModal';
import CategoryModal from '../../components/inventory/CategoryModal';

import {
  getProductsApi,
  getProductDetailsApi,
  createProductApi,
  updateProductApi,
  toggleProductStatusApi,
  getLowStockProductsApi,
  getCategoriesApi,
  createCategoryApi,
  updateCategoryApi,
  getBatchesApi,
  updateBatchStatusApi,
  recordStockReceiptApi,
  recordStockAdjustmentApi,
  getStockMovementsApi,
} from '../../services/api';

export default function InventoryDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const canManage = user?.role === 'OWNER' || user?.role === 'MANAGER';

  // Active Tab: 'products' | 'batches' | 'lowStock' | 'movements' | 'categories'
  const [activeTab, setActiveTab] = useState('products');

  // Shared Data
  const [categories, setCategories] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProductType, setSelectedProductType] = useState('');
  const [activeStatusFilter, setActiveStatusFilter] = useState('all');

  // Batches View
  const [batches, setBatches] = useState([]);
  const [batchExpiringDays, setBatchExpiringDays] = useState('');
  const [batchStatusFilter, setBatchStatusFilter] = useState('');

  // Low Stock View
  const [lowStockProducts, setLowStockProducts] = useState([]);

  // Stock Movement History View
  const [movements, setMovements] = useState([]);
  const [movementTypeFilter, setMovementTypeFilter] = useState('');
  const [movementPagination, setMovementPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  // Modal States
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsProduct, setDetailsProduct] = useState(null);

  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptInitialProduct, setReceiptInitialProduct] = useState(null);

  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [adjustmentInitialProduct, setAdjustmentInitialProduct] = useState(null);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  // 1. Load Categories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await getCategoriesApi();
      setCategories(res.categories || []);
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  }, []);

  // 2. Load Products Catalog
  const fetchProducts = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError('');
      const params = {
        page,
        limit: 15,
      };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (selectedCategory) params.categoryId = selectedCategory;
      if (selectedProductType) params.productType = selectedProductType;
      if (activeStatusFilter !== 'all') params.active = activeStatusFilter;

      const res = await getProductsApi(params);
      setProductsList(res.products || []);
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCategory, selectedProductType, activeStatusFilter]);

  // 3. Load Batches
  const fetchBatches = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (batchExpiringDays) params.expiringDays = batchExpiringDays;
      if (batchStatusFilter) params.status = batchStatusFilter;

      const res = await getBatchesApi(params);
      setBatches(res.batches || []);
    } catch (err) {
      setError(err.message || 'Failed to load batches');
    } finally {
      setLoading(false);
    }
  }, [batchExpiringDays, batchStatusFilter]);

  // 4. Load Low Stock
  const fetchLowStock = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getLowStockProductsApi();
      setLowStockProducts(res.lowStockProducts || []);
    } catch (err) {
      setError(err.message || 'Failed to load low-stock items');
    } finally {
      setLoading(false);
    }
  }, []);

  // 5. Load Stock Movements
  const fetchMovements = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (movementTypeFilter) params.movementType = movementTypeFilter;

      const res = await getStockMovementsApi(params);
      setMovements(res.movements || []);
      setMovementPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Failed to load stock movements');
    } finally {
      setLoading(false);
    }
  }, [movementTypeFilter]);

  // Initial load
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Tab switch effect
  useEffect(() => {
    if (activeTab === 'products') {
      fetchProducts(1);
    } else if (activeTab === 'batches') {
      fetchBatches();
    } else if (activeTab === 'lowStock') {
      fetchLowStock();
    } else if (activeTab === 'movements') {
      fetchMovements(1);
    }
  }, [activeTab, fetchProducts, fetchBatches, fetchLowStock, fetchMovements]);

  // Search debounce
  useEffect(() => {
    if (activeTab === 'products') {
      const timer = setTimeout(() => {
        fetchProducts(1);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [searchTerm, selectedCategory, selectedProductType, activeStatusFilter, fetchProducts, activeTab]);

  const showFeedback = (msg) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(''), 4000);
  };

  // Product Operations
  const handleCreateOrUpdateProduct = async (payload) => {
    if (editingProduct) {
      await updateProductApi(editingProduct._id, payload);
      showFeedback(`Product ${payload.nameEn} updated successfully.`);
    } else {
      await createProductApi(payload);
      showFeedback(`Product ${payload.nameEn} created successfully.`);
    }
    fetchProducts(pagination.page);
  };

  const handleToggleStatus = async (productId, currentStatus) => {
    try {
      await toggleProductStatusApi(productId, !currentStatus);
      showFeedback(`Product status changed to ${!currentStatus ? 'Active' : 'Inactive'}.`);
      fetchProducts(pagination.page);
    } catch (err) {
      setError(err.message || 'Failed to toggle product status');
    }
  };

  const handleViewDetails = async (productId) => {
    try {
      const res = await getProductDetailsApi(productId);
      setDetailsProduct(res.product);
      setIsDetailsOpen(true);
    } catch (err) {
      setError(err.message || 'Failed to load product details');
    }
  };

  // Stock Receipt Operation
  const handleStockReceipt = async (payload) => {
    await recordStockReceiptApi(payload);
    showFeedback(`Stock inward of ${payload.quantityBase} recorded successfully.`);
    if (activeTab === 'products') fetchProducts(pagination.page);
    if (activeTab === 'batches') fetchBatches();
    if (activeTab === 'lowStock') fetchLowStock();
    if (activeTab === 'movements') fetchMovements(1);
  };

  // Stock Adjustment Operation
  const handleStockAdjustment = async (payload) => {
    await recordStockAdjustmentApi(payload);
    showFeedback(`Stock adjustment (${payload.movementType}) recorded.`);
    if (activeTab === 'products') fetchProducts(pagination.page);
    if (activeTab === 'batches') fetchBatches();
    if (activeTab === 'lowStock') fetchLowStock();
    if (activeTab === 'movements') fetchMovements(1);
  };

  // Category Operation
  const handleCreateOrUpdateCategory = async (payload) => {
    if (editingCategory) {
      await updateCategoryApi(editingCategory._id, payload);
      showFeedback(`Category ${payload.nameEn} updated.`);
    } else {
      await createCategoryApi(payload);
      showFeedback(`Category ${payload.nameEn} created.`);
    }
    fetchCategories();
  };

  // Change batch status
  const handleToggleBatchStatus = async (batchId, newStatus) => {
    const reason = prompt(`Enter mandatory reason for setting batch status to ${newStatus}:`);
    if (!reason || reason.trim().length < 3) {
      alert('A valid reason of at least 3 characters is required.');
      return;
    }

    try {
      await updateBatchStatusApi(batchId, { status: newStatus, reason: reason.trim() });
      showFeedback(`Batch status updated to ${newStatus}.`);
      fetchBatches();
    } catch (err) {
      alert(err.message || 'Failed to update batch status');
    }
  };

  return (
    <PageContainer className="py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={ArrowLeft}
            onClick={() => navigate('/admin/dashboard')}
            className="text-slate-600"
          >
            {t('inventory.backToDashboard')}
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              {t('inventory.title')}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {t('inventory.subtitle')}
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => {
                  setEditingProduct(null);
                  setIsProductFormOpen(true);
                }}
              >
                {t('inventory.actions.addProduct')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={ArrowDownToLine}
                onClick={() => {
                  setReceiptInitialProduct(null);
                  setIsReceiptOpen(true);
                }}
                className="bg-emerald-50 text-[#166534] border-emerald-300 hover:bg-emerald-100"
              >
                {t('inventory.actions.receiveStock')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={SlidersHorizontal}
                onClick={() => {
                  setAdjustmentInitialProduct(null);
                  setIsAdjustmentOpen(true);
                }}
                className="text-amber-800 border-amber-300 hover:bg-amber-50"
              >
                {t('inventory.actions.adjustStock')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Feedback & Error Alerts */}
      {feedbackMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('inventory.kpis.totalProducts')}
            </span>
            <Package className="w-5 h-5 text-[#166534]" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {pagination.total || productsList.length}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Active & Archived catalog</span>
        </Card>

        <Card className="border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('inventory.tabs.categories')}
            </span>
            <FolderTree className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {categories.length}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Agro product classifications</span>
        </Card>

        <Card
          className="border-slate-200 p-4 cursor-pointer hover:border-amber-400 transition-colors"
          onClick={() => setActiveTab('lowStock')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
              {t('inventory.kpis.lowStockAlerts')}
            </span>
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-800 mt-2">
            {lowStockProducts.length > 0 ? lowStockProducts.length : 'Check Alerts'}
          </div>
          <span className="text-[11px] text-amber-600 font-medium mt-1 block">
            Click to view reorder thresholds &rarr;
          </span>
        </Card>

        <Card
          className="border-slate-200 p-4 cursor-pointer hover:border-purple-400 transition-colors"
          onClick={() => setActiveTab('batches')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
              {t('inventory.tabs.batches')}
            </span>
            <Clock className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-900 mt-2">
            FEFO Tracking
          </div>
          <span className="text-[11px] text-purple-700 font-medium mt-1 block">
            Expiry & quarantine audit &rarr;
          </span>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'products'
              ? 'border-[#166534] text-[#166534]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>{t('inventory.tabs.products')}</span>
        </button>

        <button
          onClick={() => setActiveTab('batches')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'batches'
              ? 'border-[#166534] text-[#166534]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{t('inventory.tabs.batches')}</span>
        </button>

        <button
          onClick={() => setActiveTab('lowStock')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'lowStock'
              ? 'border-amber-600 text-amber-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>{t('inventory.tabs.lowStock')}</span>
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'movements'
              ? 'border-[#166534] text-[#166534]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>{t('inventory.tabs.movements')}</span>
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'categories'
              ? 'border-[#166534] text-[#166534]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          <span>{t('inventory.tabs.categories')}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PRODUCT CATALOG                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={t('inventory.filters.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
              >
                <option value="">{t('inventory.filters.allCategories')}</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.nameEn} ({c.nameMr})
                  </option>
                ))}
              </select>

              <select
                value={selectedProductType}
                onChange={(e) => setSelectedProductType(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
              >
                <option value="">{t('inventory.filters.allTypes')}</option>
                <option value="SEED">Seeds (बियाणे)</option>
                <option value="FERTILIZER">Fertilizers (खते)</option>
                <option value="PESTICIDE">Pesticides (कीटकनाशके)</option>
                <option value="FUNGICIDE">Fungicides (बुरशीनाशके)</option>
                <option value="HERBICIDE">Herbicides (तणनाशके)</option>
                <option value="EQUIPMENT">Equipment (अवजारे)</option>
                <option value="OTHER">Other Supplies</option>
              </select>

              <select
                value={activeStatusFilter}
                onChange={(e) => setActiveStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
              >
                <option value="all">{t('inventory.filters.allStatuses')}</option>
                <option value="true">{t('inventory.filters.activeOnly')}</option>
                <option value="false">{t('inventory.filters.inactiveOnly')}</option>
              </select>

              <Button
                variant="outline"
                size="sm"
                icon={RefreshCw}
                onClick={() => fetchProducts(pagination.page)}
                title={t('inventory.actions.refresh')}
              />
            </div>
          </div>

          {/* Products Table (Desktop) & Cards (Mobile) */}
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-sm font-medium">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#166534] mb-2" />
              Loading products catalog...
            </div>
          ) : productsList.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 text-slate-500 text-sm">
              <Package className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p>{t('inventory.empty.noProducts')}</p>
              {canManage && (
                <Button
                  size="sm"
                  variant="primary"
                  icon={Plus}
                  className="mt-4"
                  onClick={() => {
                    setEditingProduct(null);
                    setIsProductFormOpen(true);
                  }}
                >
                  {t('inventory.actions.addProduct')}
                </Button>
              )}
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="px-4 py-3">Product Name & SKU</th>
                      <th className="px-4 py-3">{t('inventory.fields.category')}</th>
                      <th className="px-4 py-3">{t('inventory.fields.packSize')}</th>
                      <th className="px-4 py-3">{t('inventory.fields.sellingPrice')}</th>
                      <th className="px-4 py-3">{t('inventory.fields.currentStock')}</th>
                      <th className="px-4 py-3">{t('inventory.fields.status')}</th>
                      <th className="px-4 py-3 text-right">{t('inventory.fields.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productsList.map((product) => {
                      const priceRupees = (product.defaultSellingPricePaise / 100).toFixed(2);
                      const currentStock = product.currentStockBase || 0;

                      return (
                        <tr key={product._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3">
                            <div>
                              <span className="font-bold text-slate-900 block text-sm">
                                {product.nameEn}
                              </span>
                              <span className="text-xs text-emerald-800 font-medium block">
                                {product.nameMr}
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                  SKU: {product.sku}
                                </span>
                                {product.barcode && (
                                  <span className="text-[10px] text-slate-400">
                                    • Barcode: {product.barcode}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-700 block">
                              {product.categoryId?.nameEn || '—'}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {product.categoryId?.nameMr}
                            </span>
                          </td>

                          <td className="px-4 py-3 font-medium text-slate-700">
                            {product.packSize} {product.baseUnit}
                          </td>

                          <td className="px-4 py-3 font-bold text-[#166534] text-sm">
                            ₹{priceRupees}
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">
                                {currentStock} {product.baseUnit}
                              </span>
                              {product.isLowStock && (
                                <Badge variant="warning" size="sm" icon={AlertTriangle}>
                                  Low Stock
                                </Badge>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 block">
                              Reorder at: {product.reorderLevelBase} {product.baseUnit}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <Badge variant={product.active ? 'success' : 'default'} size="sm">
                              {product.active ? t('inventory.badges.active') : t('inventory.badges.inactive')}
                            </Badge>
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleViewDetails(product._id)}
                                title={t('inventory.actions.viewDetails')}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {canManage && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingProduct(product);
                                      setIsProductFormOpen(true);
                                    }}
                                    title={t('inventory.actions.edit')}
                                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => handleToggleStatus(product._id, product.active)}
                                    title={product.active ? t('inventory.actions.deactivate') : t('inventory.actions.activate')}
                                    className={`text-[10px] font-semibold px-2 py-1 rounded-md border ${
                                      product.active
                                        ? 'border-slate-200 text-slate-500 hover:bg-slate-100'
                                        : 'border-emerald-200 bg-emerald-50 text-[#166534] hover:bg-emerald-100'
                                    }`}
                                  >
                                    {product.active ? 'Deactivate' : 'Activate'}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
                <span>
                  Showing {productsList.length} of {pagination.total} products
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={ChevronLeft}
                    disabled={pagination.page <= 1}
                    onClick={() => fetchProducts(pagination.page - 1)}
                  >
                    Prev
                  </Button>
                  <span className="font-semibold text-slate-800">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={ChevronRight}
                    iconPosition="right"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchProducts(pagination.page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BATCHES & EXPIRY (FEFO)                                            */}
      {/* ========================================================================= */}
      {activeTab === 'batches' && (
        <div className="space-y-4">
          {/* Batches Filter Toolbar */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={batchExpiringDays}
                onChange={(e) => setBatchExpiringDays(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
              >
                <option value="">All Expiry Ranges</option>
                <option value="30">Expiring in 30 Days (Urgent)</option>
                <option value="60">Expiring in 60 Days</option>
                <option value="90">Expiring in 90 Days</option>
              </select>

              <select
                value={batchStatusFilter}
                onChange={(e) => setBatchStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
              >
                <option value="">All Batch Statuses</option>
                <option value="ACTIVE">ACTIVE (Valid for sale)</option>
                <option value="QUARANTINED">QUARANTINED (Damaged/Hold)</option>
                <option value="EXPIRED">EXPIRED (Defunct)</option>
              </select>

              <Button
                variant="outline"
                size="sm"
                icon={RefreshCw}
                onClick={fetchBatches}
              />
            </div>

            <span className="text-xs text-slate-500 font-medium">
              FEFO Priority: Nearest expiry dates are listed first
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500 text-sm">Loading batches...</div>
          ) : batches.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 text-slate-500 text-sm">
              <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p>{t('inventory.empty.noBatches')}</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="px-4 py-3">{t('inventory.fields.batchNumber')}</th>
                      <th className="px-4 py-3">Product Name & SKU</th>
                      <th className="px-4 py-3">{t('inventory.fields.expiryDate')}</th>
                      <th className="px-4 py-3">Remaining Days</th>
                      <th className="px-4 py-3">{t('inventory.fields.currentStock')}</th>
                      {canManage && <th className="px-4 py-3">{t('inventory.fields.purchaseCost')}</th>}
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Sale Status</th>
                      {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batches.map((batch) => {
                      const costStr = batch.purchaseCostPaisePerBaseUnit
                        ? `₹${(batch.purchaseCostPaisePerBaseUnit / 100).toFixed(2)}`
                        : '—';
                      const expiryFormatted = batch.expiryDate
                        ? new Date(batch.expiryDate).toLocaleDateString()
                        : 'No Expiry';

                      let badgeEl = (
                        <Badge variant="success" size="sm">
                          ACTIVE
                        </Badge>
                      );
                      if (batch.status === 'QUARANTINED') {
                        badgeEl = (
                          <Badge variant="danger" size="sm" icon={ShieldAlert}>
                            QUARANTINED
                          </Badge>
                        );
                      } else if (batch.isExpired || batch.status === 'EXPIRED') {
                        badgeEl = (
                          <Badge variant="danger" size="sm">
                            EXPIRED
                          </Badge>
                        );
                      } else if (batch.daysUntilExpiry !== null && batch.daysUntilExpiry <= 60) {
                        badgeEl = (
                          <Badge variant="warning" size="sm">
                            Expiring Soon
                          </Badge>
                        );
                      }

                      return (
                        <tr key={batch._id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-bold text-slate-900">
                            {batch.batchNumber}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-800 block">
                              {batch.productId?.nameEn}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {batch.productId?.sku} ({batch.productId?.nameMr})
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-700">
                            {expiryFormatted}
                          </td>
                          <td className="px-4 py-3">
                            {batch.daysUntilExpiry !== null ? (
                              <span
                                className={`font-bold ${
                                  batch.daysUntilExpiry <= 0
                                    ? 'text-rose-600'
                                    : batch.daysUntilExpiry <= 60
                                    ? 'text-amber-600'
                                    : 'text-slate-700'
                                }`}
                              >
                                {batch.daysUntilExpiry <= 0 ? 'Expired' : `${batch.daysUntilExpiry} days`}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900">
                            {batch.currentStockBase || 0} {batch.productId?.baseUnit}
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 font-medium text-slate-700">{costStr}</td>
                          )}
                          <td className="px-4 py-3">{badgeEl}</td>
                          <td className="px-4 py-3">
                            {batch.isAvailableForSale ? (
                              <span className="text-emerald-700 font-bold flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" /> For Sale
                              </span>
                            ) : (
                              <span className="text-rose-600 font-bold flex items-center gap-1">
                                <ShieldAlert className="w-3.5 h-3.5" /> Blocked
                              </span>
                            )}
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 text-right">
                              {batch.status !== 'QUARANTINED' ? (
                                <button
                                  onClick={() => handleToggleBatchStatus(batch._id, 'QUARANTINED')}
                                  className="text-[10px] font-semibold text-rose-700 border border-rose-200 px-2 py-1 rounded hover:bg-rose-50"
                                >
                                  Quarantine
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleToggleBatchStatus(batch._id, 'ACTIVE')}
                                  className="text-[10px] font-semibold text-emerald-700 border border-emerald-200 px-2 py-1 rounded hover:bg-emerald-50"
                                >
                                  Release
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: LOW STOCK ALERTS                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'lowStock' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
              <div>
                <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                  Reorder Threshold Alerts
                </h3>
                <p className="text-xs text-amber-800">
                  Products whose current net stock is at or below defined reorder level.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchLowStock} />
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500 text-sm">Checking low stock items...</div>
          ) : lowStockProducts.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/20 text-emerald-800 text-sm">
              <CheckCircle className="w-8 h-8 text-[#166534] mx-auto mb-2" />
              <p className="font-bold">{t('inventory.empty.noLowStock')}</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Product Name & SKU</th>
                    <th className="px-4 py-3">{t('inventory.fields.category')}</th>
                    <th className="px-4 py-3">{t('inventory.fields.currentStock')}</th>
                    <th className="px-4 py-3">{t('inventory.fields.reorderLevel')}</th>
                    <th className="px-4 py-3">{t('inventory.fields.deficit')}</th>
                    {canManage && <th className="px-4 py-3 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lowStockProducts.map((p) => (
                    <tr key={p._id} className="hover:bg-amber-50/40">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {p.nameEn}
                        <span className="text-[11px] text-slate-400 block font-normal">
                          {p.sku} ({p.nameMr})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.categoryId?.nameEn || '—'}
                      </td>
                      <td className="px-4 py-3 font-bold text-rose-700">
                        {p.currentStockBase || 0} {p.baseUnit}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {p.reorderLevelBase} {p.baseUnit}
                      </td>
                      <td className="px-4 py-3 font-bold text-amber-700">
                        {p.deficitBase} {p.baseUnit}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="primary"
                            icon={ArrowDownToLine}
                            onClick={() => {
                              setReceiptInitialProduct(p);
                              setIsReceiptOpen(true);
                            }}
                          >
                            Receive Stock
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: STOCK MOVEMENT LEDGER (AUDIT HISTORY)                              */}
      {/* ========================================================================= */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <select
                value={movementTypeFilter}
                onChange={(e) => setMovementTypeFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
              >
                <option value="">All Movement Types</option>
                <option value="INWARD">INWARD (Receipt from Supplier)</option>
                <option value="ADJUSTMENT_ADD">ADJUSTMENT_ADD (Surplus Addition)</option>
                <option value="ADJUSTMENT_SUBTRACT">ADJUSTMENT_SUBTRACT (Damage/Deficit)</option>
                <option value="SCRAP">SCRAP (Disposal)</option>
                <option value="OUTWARD_SALE">OUTWARD_SALE (Counter POS Bill)</option>
              </select>

              <Button
                variant="outline"
                size="sm"
                icon={RefreshCw}
                onClick={() => fetchMovements(movementPagination.page)}
              />
            </div>

            <span className="text-xs text-slate-500 font-medium">
              Authoritative append-only financial stock ledger
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500 text-sm">Loading movement history...</div>
          ) : movements.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 text-slate-500 text-sm">
              <History className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p>{t('inventory.empty.noMovements')}</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Product & SKU</th>
                      <th className="px-4 py-3">Batch Number</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Quantity</th>
                      <th className="px-4 py-3">Ref ID</th>
                      <th className="px-4 py-3">Actor</th>
                      <th className="px-4 py-3">Reason / Audit Justification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movements.map((m) => {
                      const isPositive = m.quantityBase > 0;
                      const dateStr = new Date(m.createdAt).toLocaleString();

                      return (
                        <tr key={m._id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                            {dateStr}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900">
                            {m.productId?.nameEn}
                            <span className="text-[10px] text-slate-400 block font-normal">
                              {m.productId?.sku}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-700">
                            {m.batchId?.batchNumber || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                m.movementType === 'INWARD'
                                  ? 'success'
                                  : m.movementType.includes('ADD')
                                  ? 'info'
                                  : 'warning'
                              }
                              size="sm"
                            >
                              {m.movementType}
                            </Badge>
                          </td>
                          <td
                            className={`px-4 py-3 font-black ${
                              isPositive ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {isPositive ? `+${m.quantityBase}` : m.quantityBase} {m.productId?.baseUnit}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600">
                            {m.referenceId || '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-700 font-medium">
                            {m.createdBy?.name || 'Staff'} ({m.createdBy?.role || 'USER'})
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={m.reason}>
                            {m.reason}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
                <span>
                  Showing {movements.length} of {movementPagination.total} ledger entries
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={movementPagination.page <= 1}
                    onClick={() => fetchMovements(movementPagination.page - 1)}
                  >
                    Prev
                  </Button>
                  <span className="font-semibold text-slate-800">
                    Page {movementPagination.page} of {movementPagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={movementPagination.page >= movementPagination.totalPages}
                    onClick={() => fetchMovements(movementPagination.page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: CATEGORY MANAGEMENT                                                */}
      {/* ========================================================================= */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              Product Categories ({categories.length})
            </h2>
            {canManage && (
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => {
                  setEditingCategory(null);
                  setIsCategoryModalOpen(true);
                }}
              >
                {t('inventory.actions.addCategory')}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((c) => (
              <Card key={c._id} className="border-slate-200 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{c.nameEn}</h3>
                    <p className="text-xs font-semibold text-emerald-800 mt-0.5">{c.nameMr}</p>
                    <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                      slug: {c.slug}
                    </span>
                  </div>
                  <Badge variant={c.active ? 'success' : 'default'} size="sm">
                    {c.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                {c.parentId && (
                  <div className="mt-3 text-[11px] text-slate-500 font-medium bg-slate-50 p-2 rounded-lg">
                    Parent: {c.parentId?.nameEn} ({c.parentId?.nameMr})
                  </div>
                )}

                {canManage && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Edit2}
                      onClick={() => {
                        setEditingCategory(c);
                        setIsCategoryModalOpen(true);
                      }}
                    >
                      {t('inventory.actions.edit')}
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <ProductFormModal
        isOpen={isProductFormOpen}
        onClose={() => setIsProductFormOpen(false)}
        onSubmit={handleCreateOrUpdateProduct}
        product={editingProduct}
        categories={categories}
      />

      <ProductDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        product={detailsProduct}
        userRole={user?.role}
        onOpenReceipt={(prod) => {
          setReceiptInitialProduct(prod);
          setIsReceiptOpen(true);
        }}
        onOpenAdjustment={(prod) => {
          setAdjustmentInitialProduct(prod);
          setIsAdjustmentOpen(true);
        }}
      />

      <StockReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        onSubmit={handleStockReceipt}
        products={productsList}
        initialProduct={receiptInitialProduct}
      />

      <StockAdjustmentModal
        isOpen={isAdjustmentOpen}
        onClose={() => setIsAdjustmentOpen(false)}
        onSubmit={handleStockAdjustment}
        products={productsList}
        initialProduct={adjustmentInitialProduct}
      />

      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSubmit={handleCreateOrUpdateCategory}
        category={editingCategory}
        categories={categories}
      />
    </PageContainer>
  );
}
