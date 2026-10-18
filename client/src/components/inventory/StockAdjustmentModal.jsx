import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, SlidersHorizontal, AlertCircle, AlertTriangle } from 'lucide-react';
import Button from '../common/Button';

export default function StockAdjustmentModal({
  isOpen,
  onClose,
  onSubmit,
  products = [],
  initialProduct = null,
}) {
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    productId: '',
    batchId: '',
    movementType: 'ADJUSTMENT_SUBTRACT',
    quantityBase: '',
    reason: '',
    allowNegative: false,
  });

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        productId: initialProduct?._id || products[0]?._id || '',
        batchId: '',
        movementType: 'ADJUSTMENT_SUBTRACT',
        quantityBase: '',
        reason: '',
        allowNegative: false,
      });
      setError('');
    }
  }, [isOpen, initialProduct, products]);

  if (!isOpen) return null;

  const selectedProduct =
    products.find((p) => p._id === formData.productId) || initialProduct;

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

    if (!formData.productId) {
      setError('Please select a product');
      return;
    }

    const qty = parseFloat(formData.quantityBase);
    if (isNaN(qty) || qty <= 0) {
      setError('Quantity must be greater than zero');
      return;
    }

    if (!formData.reason.trim() || formData.reason.trim().length < 3) {
      setError('A mandatory reason of at least 3 characters is required for stock adjustment');
      return;
    }

    const payload = {
      productId: formData.productId,
      batchId: formData.batchId || undefined,
      movementType: formData.movementType,
      quantityBase: qty,
      reason: formData.reason.trim(),
      allowNegative: formData.allowNegative,
    };

    try {
      setSubmitting(true);
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record stock adjustment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-amber-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {t('inventory.actions.adjustStock')}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Mandatory audit justification required
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Product */}
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
                  {p.nameEn} ({p.nameMr}) [Stock: {p.currentStockBase || 0} {p.baseUnit}]
                </option>
              ))}
            </select>
          </div>

          {/* Movement Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('inventory.fields.movementType')} *
            </label>
            <select
              name="movementType"
              value={formData.movementType}
              onChange={handleChange}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-[#166534] focus:outline-none"
            >
              <option value="ADJUSTMENT_SUBTRACT">ADJUSTMENT_SUBTRACT (Damage / Physical Deficit)</option>
              <option value="ADJUSTMENT_ADD">ADJUSTMENT_ADD (Surplus Count / Physical Audit Addition)</option>
              <option value="SCRAP">SCRAP (Disposal of Expired / Ruined Stock)</option>
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Quantity to Adjust ({selectedProduct?.baseUnit || 'Base Units'}) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              name="quantityBase"
              value={formData.quantityBase}
              onChange={handleChange}
              placeholder="e.g. 5"
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#166534] focus:outline-none font-bold"
            />
          </div>

          {/* Mandatory Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('inventory.fields.reason')} *
            </label>
            <textarea
              name="reason"
              rows="3"
              value={formData.reason}
              onChange={handleChange}
              placeholder="e.g. Physical inventory verification detected moisture damage on 5 bags during godown inspection."
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#166534] focus:outline-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Reason is permanently logged to the immutable StockMovement ledger.
            </p>
          </div>

          {/* Negative Stock Override Checkbox */}
          {formData.movementType !== 'ADJUSTMENT_ADD' && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <label className="flex items-start gap-2 cursor-pointer text-xs text-amber-900 font-medium">
                <input
                  type="checkbox"
                  name="allowNegative"
                  checked={formData.allowNegative}
                  onChange={handleChange}
                  className="rounded text-amber-600 focus:ring-amber-500 mt-0.5"
                />
                <div>
                  <span className="font-bold block">
                    {t('inventory.fields.allowNegative')}
                  </span>
                  <span className="text-[11px] text-amber-700">
                    Strict shop policy forbids negative stock. Check this box only if this deduction was explicitly authorized by the store owner.
                  </span>
                </div>
              </label>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              {t('inventory.actions.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon={SlidersHorizontal}
              disabled={submitting}
              className="bg-amber-700 hover:bg-amber-800 focus-visible:ring-amber-700"
            >
              {submitting ? 'Applying...' : 'Apply Stock Adjustment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
