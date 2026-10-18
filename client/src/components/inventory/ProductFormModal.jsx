import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertCircle, Save } from 'lucide-react';
import Button from '../common/Button';

const PRODUCT_TYPES = [
  'SEED',
  'FERTILIZER',
  'PESTICIDE',
  'FUNGICIDE',
  'HERBICIDE',
  'EQUIPMENT',
  'OTHER',
];

const BASE_UNITS = ['KG', 'G', 'LITER', 'ML', 'PIECE', 'BAG', 'PACK'];

export default function ProductFormModal({
  isOpen,
  onClose,
  onSubmit,
  categories = [],
  product = null, // If passed, edit mode; else create mode
}) {
  const { t } = useTranslation();
  const isEdit = Boolean(product);

  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    nameEn: '',
    nameMr: '',
    categoryId: '',
    brand: '',
    productType: 'SEED',
    baseUnit: 'KG',
    packSize: 1,
    sellingPriceRupees: '',
    reorderLevelBase: 0,
    hsnCode: '',
    gstRatePercent: 0,
    isExempt: false,
    active: true,
  });

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        sku: product.sku || '',
        barcode: product.barcode || '',
        nameEn: product.nameEn || '',
        nameMr: product.nameMr || '',
        categoryId: typeof product.categoryId === 'object' ? product.categoryId?._id : (product.categoryId || ''),
        brand: product.brand || '',
        productType: product.productType || 'SEED',
        baseUnit: product.baseUnit || 'KG',
        packSize: product.packSize || 1,
        sellingPriceRupees: product.defaultSellingPricePaise ? (product.defaultSellingPricePaise / 100).toString() : '0',
        reorderLevelBase: product.reorderLevelBase || 0,
        hsnCode: product.taxClassification?.hsnCode || '',
        gstRatePercent: product.taxClassification?.gstRatePercent || 0,
        isExempt: Boolean(product.taxClassification?.isExempt),
        active: product.active !== undefined ? product.active : true,
      });
    } else {
      setFormData({
        sku: '',
        barcode: '',
        nameEn: '',
        nameMr: '',
        categoryId: categories[0]?._id || '',
        brand: '',
        productType: 'SEED',
        baseUnit: 'KG',
        packSize: 1,
        sellingPriceRupees: '',
        reorderLevelBase: 0,
        hsnCode: '',
        gstRatePercent: 0,
        isExempt: false,
        active: true,
      });
    }
    setError('');
  }, [product, categories, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.sku.trim()) {
      setError('SKU is required');
      return;
    }
    if (!formData.nameEn.trim()) {
      setError('English product name is required');
      return;
    }
    if (!formData.nameMr.trim()) {
      setError('Marathi product name is required');
      return;
    }
    if (!formData.categoryId) {
      setError('Please select a category');
      return;
    }

    const priceRupees = parseFloat(formData.sellingPriceRupees);
    if (isNaN(priceRupees) || priceRupees < 0) {
      setError('Valid selling price in rupees is required');
      return;
    }

    const payload = {
      sku: formData.sku.trim().toUpperCase(),
      barcode: formData.barcode.trim() || undefined,
      nameEn: formData.nameEn.trim(),
      nameMr: formData.nameMr.trim(),
      categoryId: formData.categoryId,
      brand: formData.brand.trim(),
      productType: formData.productType,
      baseUnit: formData.baseUnit,
      packSize: Number(formData.packSize) || 1,
      reorderLevelBase: Number(formData.reorderLevelBase) || 0,
      defaultSellingPricePaise: Math.round(priceRupees * 100),
      taxClassification: {
        hsnCode: formData.hsnCode.trim(),
        gstRatePercent: Number(formData.gstRatePercent) || 0,
        isExempt: formData.isExempt,
      },
      active: formData.active,
    };

    try {
      setSubmitting(true);
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit ? t('inventory.actions.edit') : t('inventory.actions.addProduct')}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Bilingual Names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('inventory.fields.nameEn')} *
              </label>
              <input
                type="text"
                name="nameEn"
                value={formData.nameEn}
                onChange={handleChange}
                placeholder="e.g. Mahyco Bollgard Cotton Seeds"
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#166534] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('inventory.fields.nameMr')} *
              </label>
              <input
                type="text"
                name="nameMr"
                value={formData.nameMr}
                onChange={handleChange}
                placeholder="उदा. माहिको बोलगार्ड कापूस बियाणे"
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#166534] focus:outline-none"
              />
            </div>
          </div>

          {/* SKU, Barcode, Brand */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('inventory.fields.sku')} *
              </label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                placeholder="e.g. MAHYCO-COT-501"
                required
                className="w-full px-3 py-2 text-sm uppercase border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#166534] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('inventory.fields.barcode')}
              </label>
              <input
                type="text"
                name="barcode"
                value={formData.barcode}
                onChange={handleChange}
                placeholder="Optional scanner code"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#166534] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('inventory.fields.brand')}
              </label>
              <input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                placeholder="e.g. Mahyco, Bayer, IFFCO"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#166534] focus:outline-none"
              />
            </div>
          </div>

          {/* Category, Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('inventory.fields.category')} *
              </label>
              <select
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-[#166534] focus:outline-none"
              >
                <option value="">-- Select Category --</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.nameEn} ({c.nameMr})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('inventory.fields.productType')} *
              </label>
              <select
                name="productType"
                value={formData.productType}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-[#166534] focus:outline-none"
              >
                {PRODUCT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`inventory.types.${type}`)} ({type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Base Unit, Pack Size, Selling Price */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('inventory.fields.baseUnit')} *
              </label>
              <select
                name="baseUnit"
                value={formData.baseUnit}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-[#166534] focus:outline-none"
              >
                {BASE_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {t(`inventory.units.${unit}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('inventory.fields.packSize')} *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                name="packSize"
                value={formData.packSize}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#166534] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('inventory.fields.sellingPrice')} *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="sellingPriceRupees"
                value={formData.sellingPriceRupees}
                onChange={handleChange}
                placeholder="e.g. 850.00"
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#166534] focus:outline-none font-medium"
              />
            </div>
          </div>

          {/* Reorder Level, HSN Code, GST Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('inventory.fields.reorderLevel')} *
              </label>
              <input
                type="number"
                min="0"
                name="reorderLevelBase"
                value={formData.reorderLevelBase}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#166534] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('inventory.fields.hsnCode')}
              </label>
              <input
                type="text"
                name="hsnCode"
                value={formData.hsnCode}
                onChange={handleChange}
                placeholder="e.g. 120999"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#166534] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('inventory.fields.gstRate')}
              </label>
              <select
                name="gstRatePercent"
                value={formData.gstRatePercent}
                onChange={handleChange}
                disabled={formData.isExempt}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-[#166534] focus:outline-none disabled:bg-slate-100"
              >
                <option value="0">0% (Nil)</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </div>
          </div>

          {/* Checkboxes: GST Exempt, Active */}
          <div className="flex flex-wrap items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                name="isExempt"
                checked={formData.isExempt}
                onChange={handleChange}
                className="rounded text-[#166534] focus:ring-[#166534]"
              />
              <span>{t('inventory.fields.isExempt')}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                name="active"
                checked={formData.active}
                onChange={handleChange}
                className="rounded text-[#166534] focus:ring-[#166534]"
              />
              <span>Active in Store</span>
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              {t('inventory.actions.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon={Save}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : t('inventory.actions.save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
