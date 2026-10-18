import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Trash2, ShoppingCart, Calculator, AlertCircle } from 'lucide-react';
import {
  getSuppliersApi,
  getProductsApi,
  createPurchaseApi,
} from '../../services/api';
import { calculatePurchaseTotals } from '../../../../server/src/utils/purchaseUtils.js';

export default function NewPurchaseModal({ isOpen, onClose, onCreated }) {
  const { t } = useTranslation();

  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [supplierId, setSupplierId] = useState('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [isInterstate, setIsInterstate] = useState(false);
  const [additionalChargesRupees, setAdditionalChargesRupees] = useState('0');
  const [paymentMode, setPaymentMode] = useState('CREDIT');
  const [paidRupees, setPaidRupees] = useState('0');
  const [paymentReferenceId, setPaymentReferenceId] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('RECEIVED'); // 'RECEIVED' or 'DRAFT'

  // Items
  const [items, setItems] = useState([
    {
      productId: '',
      batchNumber: '',
      manufacturingDate: '',
      expiryDate: '',
      quantity: 1,
      freeQuantity: 0,
      purchaseRateRupees: '0',
      discountRupees: '0',
      gstRate: 18,
      sellingPriceRupees: '',
    },
  ]);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(null);
      Promise.all([
        getSuppliersApi({ active: 'true', limit: 100 }),
        getProductsApi({ active: 'true', limit: 200 }),
      ])
        .then(([supRes, prodRes]) => {
          setSuppliers(supRes.data || []);
          setProducts(prodRes.data?.products || prodRes.data || []);
        })
        .catch((err) => setError(err.message || 'Failed to load options'))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        productId: '',
        batchNumber: '',
        manufacturingDate: '',
        expiryDate: '',
        quantity: 1,
        freeQuantity: 0,
        purchaseRateRupees: '0',
        discountRupees: '0',
        gstRate: 18,
        sellingPriceRupees: '',
      },
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // Auto-populate default GST and selling price when product selected
      if (field === 'productId') {
        const prod = products.find((p) => p._id === value);
        if (prod) {
          updated[index].gstRate = prod.gstRate ?? 18;
          if (prod.sellingPricePaise) {
            updated[index].sellingPriceRupees = (prod.sellingPricePaise / 100).toString();
          }
        }
      }
      return updated;
    });
  };

  // Live total calculations
  const calculateLiveTotals = () => {
    try {
      const prepared = items
        .filter((it) => it.productId && Number(it.quantity) > 0)
        .map((it) => {
          const prod = products.find((p) => p._id === it.productId);
          return {
            productId: it.productId,
            nameSnapshot: prod?.name || 'Product',
            skuSnapshot: prod?.sku || 'SKU',
            unitSnapshot: prod?.baseUnit || 'UNIT',
            batchNumber: it.batchNumber,
            quantity: Number(it.quantity || 1),
            freeQuantity: Number(it.freeQuantity || 0),
            purchaseRatePaise: Math.round(Number(it.purchaseRateRupees || 0) * 100),
            discountPaise: Math.round(Number(it.discountRupees || 0) * 100),
            gstRate: Number(it.gstRate || 0),
          };
        });

      if (prepared.length === 0) {
        return {
          subtotalPaise: 0,
          taxTotalPaise: 0,
          grandTotalPaise: 0,
          balancePaise: 0,
        };
      }

      return calculatePurchaseTotals(prepared, {
        additionalChargesPaise: Math.round(Number(additionalChargesRupees || 0) * 100),
        paidPaise: Math.round(Number(paidRupees || 0) * 100),
        isInterstate,
      });
    } catch {
      return {
        subtotalPaise: 0,
        taxTotalPaise: 0,
        grandTotalPaise: 0,
        balancePaise: 0,
      };
    }
  };

  const liveTotals = calculateLiveTotals();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!supplierId) {
      setError('Please select a supplier');
      return;
    }
    if (!supplierInvoiceNumber.trim()) {
      setError('Supplier Invoice / Challan number is required');
      return;
    }

    const validItems = items.filter((it) => it.productId && Number(it.quantity) > 0);
    if (validItems.length === 0) {
      setError('Please add at least one valid product line with positive quantity');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        supplierId,
        supplierInvoiceNumber: supplierInvoiceNumber.trim(),
        supplierInvoiceDate,
        purchaseDate,
        status,
        isInterstate,
        additionalChargesPaise: Math.round(Number(additionalChargesRupees || 0) * 100),
        paidPaise: Math.round(Number(paidRupees || 0) * 100),
        paymentMode,
        paymentReferenceId: paymentReferenceId.trim(),
        notes: notes.trim(),
        items: validItems.map((it) => ({
          productId: it.productId,
          batchNumber: it.batchNumber.trim().toUpperCase(),
          manufacturingDate: it.manufacturingDate || undefined,
          expiryDate: it.expiryDate || undefined,
          quantity: Number(it.quantity),
          freeQuantity: Number(it.freeQuantity || 0),
          purchaseRatePaise: Math.round(Number(it.purchaseRateRupees || 0) * 100),
          discountPaise: Math.round(Number(it.discountRupees || 0) * 100),
          gstRate: Number(it.gstRate || 0),
          sellingPricePaise: it.sellingPriceRupees
            ? Math.round(Number(it.sellingPriceRupees) * 100)
            : undefined,
        })),
      };

      await createPurchaseApi(payload);
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create purchase');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Inward Purchase Bill (खरेदी आवक नोंद)
              </h2>
              <p className="text-xs text-gray-500">
                Receive physical stock and update supplier accounts payable
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Supplier & Bill Metadata */}
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-gray-50/70 p-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Supplier (पुरवठादार) *
              </label>
              <select
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-green-600 focus:outline-hidden"
              >
                <option value="">Select Supplier...</option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.villageCity || s.district || 'Supplier'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Supplier Inv # (बिल क्रमांक) *
              </label>
              <input
                type="text"
                required
                value={supplierInvoiceNumber}
                onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-2026-99"
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-green-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Invoice Date (बिल तारीख)
              </label>
              <input
                type="date"
                value={supplierInvoiceDate}
                onChange={(e) => setSupplierInvoiceDate(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-green-600 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Items Table */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-gray-700 uppercase">
                Product Line Items (उत्पादने व बॅच तपशील)
              </h3>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInterstate}
                    onChange={(e) => setIsInterstate(e.target.checked)}
                    className="rounded text-green-600 focus:ring-green-500"
                  />
                  <span>Interstate (IGST Applicable)</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1 rounded-lg bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700 hover:bg-green-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Line (नवीन ओळ)</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="py-2 px-2.5 min-w-[160px]">Product (उत्पादन)</th>
                    <th className="py-2 px-2 min-w-[100px]">Batch No</th>
                    <th className="py-2 px-2 min-w-[100px]">Expiry</th>
                    <th className="py-2 px-2 w-16 text-right">Qty</th>
                    <th className="py-2 px-2 w-16 text-right">Free</th>
                    <th className="py-2 px-2 w-20 text-right">Rate ₹</th>
                    <th className="py-2 px-2 w-16 text-right">Disc ₹</th>
                    <th className="py-2 px-2 w-16">GST%</th>
                    <th className="py-2 px-2 w-20 text-right">MRP ₹</th>
                    <th className="py-2 px-2 w-24 text-right">Total ₹</th>
                    <th className="py-2 px-1 text-center w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {items.map((item, idx) => {
                    const prod = products.find((p) => p._id === item.productId);
                    const gross =
                      Number(item.quantity || 0) * Number(item.purchaseRateRupees || 0) -
                      Number(item.discountRupees || 0);
                    const tax = gross * (Number(item.gstRate || 0) / 100);
                    const lineTotal = Math.max(0, gross + tax);

                    return (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="p-1.5">
                          <select
                            required
                            value={item.productId}
                            onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                            className="w-full rounded border border-gray-300 p-1 text-xs focus:border-green-600 focus:outline-hidden"
                          >
                            <option value="">Select Product...</option>
                            {products.map((p) => (
                              <option key={p._id} value={p._id}>
                                {p.name} ({p.baseUnit})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            placeholder="Batch #"
                            value={item.batchNumber}
                            onChange={(e) => handleItemChange(idx, 'batchNumber', e.target.value.toUpperCase())}
                            className="w-full rounded border border-gray-300 p-1 text-xs uppercase focus:border-green-600 focus:outline-hidden"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="date"
                            value={item.expiryDate}
                            onChange={(e) => handleItemChange(idx, 'expiryDate', e.target.value)}
                            className="w-full rounded border border-gray-300 p-1 text-xs focus:border-green-600 focus:outline-hidden"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            required
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            className="w-full rounded border border-gray-300 p-1 text-right text-xs focus:border-green-600 focus:outline-hidden"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.freeQuantity}
                            onChange={(e) => handleItemChange(idx, 'freeQuantity', e.target.value)}
                            className="w-full rounded border border-gray-300 p-1 text-right text-xs focus:border-green-600 focus:outline-hidden"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={item.purchaseRateRupees}
                            onChange={(e) => handleItemChange(idx, 'purchaseRateRupees', e.target.value)}
                            className="w-full rounded border border-gray-300 p-1 text-right text-xs font-semibold focus:border-green-600 focus:outline-hidden"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.discountRupees}
                            onChange={(e) => handleItemChange(idx, 'discountRupees', e.target.value)}
                            className="w-full rounded border border-gray-300 p-1 text-right text-xs focus:border-green-600 focus:outline-hidden"
                          />
                        </td>
                        <td className="p-1.5">
                          <select
                            value={item.gstRate}
                            onChange={(e) => handleItemChange(idx, 'gstRate', e.target.value)}
                            className="w-full rounded border border-gray-300 p-1 text-xs focus:border-green-600 focus:outline-hidden"
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                          </select>
                        </td>
                        <td className="p-1.5">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="MRP"
                            value={item.sellingPriceRupees}
                            onChange={(e) => handleItemChange(idx, 'sellingPriceRupees', e.target.value)}
                            className="w-full rounded border border-gray-300 p-1 text-right text-xs focus:border-green-600 focus:outline-hidden"
                          />
                        </td>
                        <td className="p-1.5 text-right font-bold text-gray-900">
                          ₹{lineTotal.toFixed(2)}
                        </td>
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            disabled={items.length === 1}
                            className="text-gray-400 hover:text-red-600 disabled:opacity-20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bill Aggregations & Payment Summary */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Payment & Status Controls */}
            <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/50 p-4">
              <h4 className="text-xs font-bold text-gray-700 uppercase">
                Action & Payment Terms (पेमेंट अटी)
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
                    Receipt Status (स्थिती)
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold focus:border-green-600 focus:outline-hidden"
                  >
                    <option value="RECEIVED">RECEIVED (थेट साठा वाढवा व नोंदवा)</option>
                    <option value="DRAFT">DRAFT (मसुदा - साठा बदलणार नाही)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
                    Payment Mode (पेमेंट प्रकार)
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs focus:border-green-600 focus:outline-hidden"
                  >
                    <option value="CREDIT">Full Credit (पूर्ण उधारी)</option>
                    <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="CASH">Cash (रोख)</option>
                    <option value="CHEQUE">Cheque (धनादेश)</option>
                    <option value="SPLIT">Split Payment</option>
                  </select>
                </div>
              </div>

              {paymentMode !== 'CREDIT' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      Immediate Paid Amount (दिलेली रक्कम ₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={paidRupees}
                      onChange={(e) => setPaidRupees(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 focus:border-green-600 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      Payment Ref / UTR #
                    </label>
                    <input
                      type="text"
                      value={paymentReferenceId}
                      onChange={(e) => setPaymentReferenceId(e.target.value)}
                      placeholder="Transaction ID / Chq #"
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs focus:border-green-600 focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">Notes / Remarks</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Transport name / LR number / terms..."
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs focus:border-green-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Taxable Subtotal (करपात्र मूल्य):</span>
                <span className="font-semibold text-gray-900">
                  ₹{(liveTotals.subtotalPaise / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Total GST ({isInterstate ? 'IGST' : 'CGST + SGST'}):</span>
                <span className="font-semibold text-gray-900">
                  ₹{(liveTotals.taxTotalPaise / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <span>Freight / Loading Charges (भाडे ₹):</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={additionalChargesRupees}
                  onChange={(e) => setAdditionalChargesRupees(e.target.value)}
                  className="w-24 rounded border border-gray-300 bg-white px-2 py-0.5 text-right text-xs focus:border-green-600 focus:outline-hidden"
                />
              </div>
              {liveTotals.roundOffPaise !== 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Round-off (सूट):</span>
                  <span>₹{(liveTotals.roundOffPaise / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-300 pt-2 text-base font-black text-gray-900">
                <span>Grand Total (एकूण बिल):</span>
                <span className="text-green-800">
                  ₹{(liveTotals.grandTotalPaise / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Immediate Paid (दिलेली रक्कम):</span>
                <span>₹{(liveTotals.paidPaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-red-700">
                <span>Remaining Payable (बाकी देय रक्कम):</span>
                <span>₹{(liveTotals.balancePaise / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-green-700 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-green-800 disabled:opacity-50"
            >
              {submitting
                ? 'Processing...'
                : status === 'RECEIVED'
                ? 'Receive Purchase & Add Stock (आवक साठा नोंदवा)'
                : 'Save as Draft (मसुदा साठवा)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
