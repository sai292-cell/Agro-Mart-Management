import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Package,
  Calendar,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  ArrowDownToLine,
  SlidersHorizontal,
} from 'lucide-react';
import Badge from '../common/Badge';
import Button from '../common/Button';

export default function ProductDetailsModal({
  isOpen,
  onClose,
  product,
  userRole,
  onOpenReceipt,
  onOpenAdjustment,
}) {
  const { t } = useTranslation();

  if (!isOpen || !product) return null;

  const canManage = userRole === 'OWNER' || userRole === 'MANAGER';
  const sellingPrice = (product.defaultSellingPricePaise / 100).toFixed(2);
  const currentStock = product.currentStockBase || 0;
  const packsCount = product.packSize ? (currentStock / product.packSize).toFixed(1) : currentStock;

  const batches = product.batches || [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200 bg-emerald-50/40">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{product.nameEn}</h2>
              <Badge variant={product.active ? 'success' : 'default'} size="sm">
                {product.active ? t('inventory.badges.active') : t('inventory.badges.inactive')}
              </Badge>
            </div>
            <p className="text-sm font-medium text-emerald-800">{product.nameMr}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                {t('inventory.fields.sku')}
              </span>
              <span className="text-sm font-bold text-slate-800">{product.sku}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                {t('inventory.fields.sellingPrice')}
              </span>
              <span className="text-sm font-bold text-[#166534]">₹{sellingPrice}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                {t('inventory.fields.currentStock')}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-base font-bold text-slate-900">
                  {currentStock} {product.baseUnit}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  ({packsCount} packs)
                </span>
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                {t('inventory.fields.reorderLevel')}
              </span>
              <div className="mt-0.5">
                {product.isLowStock ? (
                  <Badge variant="warning" size="sm" icon={AlertTriangle}>
                    Low ({product.reorderLevelBase} {product.baseUnit})
                  </Badge>
                ) : (
                  <Badge variant="success" size="sm" icon={CheckCircle}>
                    Normal ({product.reorderLevelBase} {product.baseUnit})
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Product Specifications */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Specifications & Tax
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-6 text-xs text-slate-700">
              <div>
                <span className="text-slate-400 block">{t('inventory.fields.category')}</span>
                <span className="font-semibold text-slate-900">
                  {typeof product.categoryId === 'object'
                    ? `${product.categoryId?.nameEn} (${product.categoryId?.nameMr})`
                    : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">{t('inventory.fields.productType')}</span>
                <span className="font-semibold text-slate-900">
                  {t(`inventory.types.${product.productType}`, product.productType)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">{t('inventory.fields.brand')}</span>
                <span className="font-semibold text-slate-900">{product.brand || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{t('inventory.fields.packSize')}</span>
                <span className="font-semibold text-slate-900">
                  {product.packSize} {product.baseUnit} / pack
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">{t('inventory.fields.barcode')}</span>
                <span className="font-semibold text-slate-900">{product.barcode || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">GST / HSN</span>
                <span className="font-semibold text-slate-900">
                  {product.taxClassification?.isExempt
                    ? 'Exempt (करमुक्त)'
                    : `${product.taxClassification?.gstRatePercent || 0}% (HSN: ${product.taxClassification?.hsnCode || '—'})`}
                </span>
              </div>
            </div>
          </div>

          {/* Batches & Expiry (FEFO) Breakdown */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Tracked Batches (FEFO Expiry Breakdown)
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {batches.length} {batches.length === 1 ? 'batch' : 'batches'} on record
              </span>
            </div>

            {batches.length === 0 ? (
              <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                No batches recorded for this product yet. Click 'Receive Stock' to add the first batch.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="px-3 py-2.5">{t('inventory.fields.batchNumber')}</th>
                      <th className="px-3 py-2.5">{t('inventory.fields.expiryDate')}</th>
                      <th className="px-3 py-2.5">{t('inventory.fields.currentStock')}</th>
                      {canManage && <th className="px-3 py-2.5">{t('inventory.fields.purchaseCost')}</th>}
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Sale Eligibility</th>
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

                      let statusBadge = (
                        <Badge variant="success" size="sm">
                          {t('inventory.badges.active')}
                        </Badge>
                      );
                      if (batch.status === 'QUARANTINED') {
                        statusBadge = (
                          <Badge variant="danger" size="sm" icon={ShieldAlert}>
                            {t('inventory.badges.quarantined')}
                          </Badge>
                        );
                      } else if (batch.isExpired || batch.status === 'EXPIRED') {
                        statusBadge = (
                          <Badge variant="danger" size="sm">
                            {t('inventory.badges.expired')}
                          </Badge>
                        );
                      } else if (batch.daysUntilExpiry !== null && batch.daysUntilExpiry <= 60) {
                        statusBadge = (
                          <Badge variant="warning" size="sm">
                            {t('inventory.badges.expiringSoon')} ({batch.daysUntilExpiry}d)
                          </Badge>
                        );
                      }

                      return (
                        <tr key={batch._id} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-bold text-slate-800">
                            {batch.batchNumber}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {expiryFormatted}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-900">
                            {batch.currentStockBase || 0} {product.baseUnit}
                          </td>
                          {canManage && (
                            <td className="px-3 py-2.5 text-slate-700 font-medium">
                              {costStr}
                            </td>
                          )}
                          <td className="px-3 py-2.5">{statusBadge}</td>
                          <td className="px-3 py-2.5">
                            {batch.isAvailableForSale ? (
                              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" /> For Sale
                              </span>
                            ) : (
                              <span className="text-rose-600 font-semibold flex items-center gap-1">
                                <ShieldAlert className="w-3.5 h-3.5" /> Blocked
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            {canManage && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  icon={ArrowDownToLine}
                  onClick={() => {
                    onClose();
                    onOpenReceipt(product);
                  }}
                >
                  Receive Stock
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={SlidersHorizontal}
                  onClick={() => {
                    onClose();
                    onOpenAdjustment(product);
                  }}
                >
                  Adjust Stock
                </Button>
              </>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={onClose}>
            {t('inventory.actions.close')}
          </Button>
        </div>
      </div>
    </div>
  );
}
