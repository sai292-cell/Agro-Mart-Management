import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ArrowDownToLine, AlertCircle } from 'lucide-react';
import Button from '../common/Button';

export default function StockReceiptModal({
  isOpen,
  onClose,
  onSubmit,
  products = [],
  initialProduct = null,
}) {
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    productId: '',
    batchNumber: '',
    manufacturingDate: '',
    expiryDate: '',
    purchaseCostRupees: '',
    quantityBase: '',
    referenceType: 'PURCHASE',
    referenceId: '',
    reason: '',
  });

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        productId: initialProduct?._id || products[0]?._id || '',
        batchNumber: '',
        manufacturingDate: '',
        expiryDate: '',
        purchaseCostRupees: '',
        quantityBase: '',
        referenceType: 'PURCHASE',
        referenceId: '',
        reason: '',
      });
      setError('');
    }
  }, [isOpen, initialProduct, products]);

  if (!isOpen) return null;

  const selectedProduct =
    products.find((p) => p._id === formData.productId) || initialProduct;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.productId) {
      setError('Please select a product');
      return;
    }
    if (!formData.batchNumber.trim()) {
      setError('Batch number is required');
      return;
    }

    const qty = parseFloat(formData.quantityBase);
    if (isNaN(qty) || qty <= 0) {
      setError('Inward quantity must be greater than zero');
      return;
    }

    const cost = parseFloat(formData.purchaseCostRupees);
    if (isNaN(cost) || cost < 0) {
      setError('Valid purchase cost per base unit is required');
      return;
    }

    if (!formData.reason.trim() || formData.reason.trim().length < 3) {
      setError('A reason or receipt note of at least 3 characters is required');
      return;
    }

    const payload = {
      productId: formData.productId,
      batchNumber: formData.batchNumber.trim().toUpperCase(),
      manufacturingDate: formData.manufacturingDate || undefined,
      expiryDate: formData.expiryDate || undefined,
      purchaseCostPaisePerBaseUnit: Math.round(cost * 100),
      quantityBase: qty,
      referenceType: formData.referenceType,
      referenceId: formData.referenceId.trim() || undefined,
      reason: formData.reason.trim(),
    };

    try {
      setSubmitting(true);
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record stock receipt');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-emerald-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#166534] text-white flex items-center justify-center">
              <ArrowDownToLine className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {t('inventory.actions.receiveStock')}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Record manufacturer batch & inward delivery
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Product Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('inventory.fields.category')} / Product *
            </label>
            <select
              name="productId"
              value={formData.productId}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-[#166534] focus:outline-none"
            >
              <option value="">-- Choose Product --</option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.nameEn} ({p.nameMr}) [{p.sku}]
                </option>
              ))}
            </select>
          </div>

          {/* Batch Number & Inward Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('inventory.fields.batchNumber')} *
              </label>
              <input
                type="text"
                name="batchNumber"
                value={formData.batchNumber}
                onChange={handleChange}
                placeholder="e.g. B2026-X1"
                required
                className="w-full px-3 py-2 text-sm uppercase border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#166534] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quantity in {selectedProduct?.baseUnit || 'Base Units'} *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                name="quantityBase"
                value={formData.quantityBase}
                onChange={handleChange}
                placeholder="e.g. 50"
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#166534] focus:outline-none font-bold"
              />
            </div>
          </div>

          {/* Purchase Cost & Reference Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Purchase Cost (₹ per {selectedProduct?.baseUnit || 'Base Unit'}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="purchaseCostRupees"
                value={formData.purchaseCostRupees}
                onChange={handleChange}
                placeholder="e.g. 1200.00"
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#166534] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('inventory.fields.referenceType')} *
              </label>
              <select
                name="referenceType"
                value={formData.referenceType}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-[#166534] focus:outline-none"
              >
                <option value="PURCHASE">PURCHASE (Supplier Purchase)</option>
                <option value="INITIAL_STOCK">INITIAL_STOCK (Opening Balance)</option>
              </select>
            </div>
          </div>

          {/* Mfg Date & Expiry Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('inventory.fields.mfgDate')}
              </label>
              <input
                type="date"
                name="manufacturingDate"
                value={formData.manufacturingDate}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#166534] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('inventory.fields.expiryDate')}
              </label>
              <input
                type="date"
                name="expiryDate"
                value={formData.expiryDate}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#166534] focus:outline-none"
              />
            </div>
          </div>

          {/* Reference ID (Invoice #) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('inventory.fields.referenceId')}
            </label>
            <input
              type="text"
              name="referenceId"
              value={formData.referenceId}
              onChange={handleChange}
              placeholder="e.g. INV-MAHYCO-2026-90"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#166534] focus:outline-none"
            />
          </div>

          {/* Mandatory Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('inventory.fields.reason')} *
            </label>
            <textarea
              name="reason"
              rows="2"
              value={formData.reason}
              onChange={handleChange}
              placeholder="e.g. Received seasonal seeds consignment via transport vehicle MH-12-AB-1234"
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#166534] focus:outline-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              {t('inventory.actions.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon={ArrowDownToLine}
              disabled={submitting}
            >
              {submitting ? 'Processing...' : 'Confirm Stock Receipt'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
