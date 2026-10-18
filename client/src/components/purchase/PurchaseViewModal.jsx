import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Printer, PackageCheck, AlertCircle, FileText } from 'lucide-react';

export default function PurchaseViewModal({ isOpen, onClose, purchase }) {
  const { t } = useTranslation();

  if (!isOpen || !purchase) return null;

  const handlePrint = () => {
    window.print();
  };

  const isReceived = purchase.status === 'RECEIVED';
  const isCancelled = purchase.status === 'CANCELLED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[95vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header - Screen only */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700">
              <PackageCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">{purchase.purchaseNumber}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    isReceived
                      ? 'bg-green-100 text-green-800'
                      : isCancelled
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {purchase.status}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Supplier Inv: {purchase.supplierInvoiceNumber} | Date:{' '}
                {new Date(purchase.purchaseDate).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-gray-800"
            >
              <Printer className="h-4 w-4" />
              <span>Print Voucher (व्हाउचर प्रिंट करा)</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Voucher Content */}
        <div className="flex-1 overflow-y-auto p-6 printable-area">
          {/* Mart Header for Print */}
          <div className="mb-6 border-b border-gray-200 pb-4 text-center">
            <h1 className="text-xl font-black text-gray-900 uppercase">
              Shivshree Agro Mart (शिवश्री ॲग्रो मार्ट)
            </h1>
            <p className="text-xs text-gray-600">
              Pimpalgaon Baswant, Nashik, Maharashtra | GSTIN: 27AABCS1234F1Z9
            </p>
            <div className="mt-2 inline-block rounded-md border border-gray-300 bg-gray-50 px-3 py-1 text-xs font-bold text-gray-800 uppercase">
              GOODS INWARD PURCHASE VOUCHER (खरेदी आवक पावती)
            </div>
          </div>

          {/* Supplier & Bill Metadata */}
          <div className="mb-4 grid grid-cols-2 gap-4 rounded-xl border border-gray-200 p-4 text-xs">
            <div>
              <div className="text-[11px] font-bold text-gray-400 uppercase">Supplier Details:</div>
              <div className="text-sm font-bold text-gray-900">
                {purchase.supplierId?.name || 'Supplier'}
              </div>
              <div className="text-gray-600">
                {purchase.supplierId?.address}
                {purchase.supplierId?.villageCity && `, ${purchase.supplierId.villageCity}`}
              </div>
              {purchase.supplierId?.phone && (
                <div className="text-gray-600">Phone: {purchase.supplierId.phone}</div>
              )}
              {purchase.supplierId?.taxDetails?.gstin && (
                <div className="font-semibold text-gray-800">
                  GSTIN: {purchase.supplierId.taxDetails.gstin}
                </div>
              )}
            </div>

            <div className="space-y-1 text-right">
              <div>
                <span className="text-gray-500">Purchase Voucher #:</span>{' '}
                <span className="font-bold text-gray-900">{purchase.purchaseNumber}</span>
              </div>
              <div>
                <span className="text-gray-500">Supplier Invoice #:</span>{' '}
                <span className="font-bold text-gray-900">{purchase.supplierInvoiceNumber}</span>
              </div>
              <div>
                <span className="text-gray-500">Invoice Date:</span>{' '}
                <span className="font-semibold">
                  {new Date(purchase.supplierInvoiceDate).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Entry / Inward Date:</span>{' '}
                <span className="font-semibold">
                  {new Date(purchase.purchaseDate).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Received By:</span>{' '}
                <span className="font-semibold">{purchase.receivedBy?.name || 'Staff'}</span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <table className="mb-4 w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-gray-300 bg-gray-100 text-gray-700">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Product Description</th>
                <th className="py-2.5 px-2">Batch #</th>
                <th className="py-2.5 px-2">Expiry</th>
                <th className="py-2.5 px-2 text-right">Qty</th>
                <th className="py-2.5 px-2 text-right">Rate ₹</th>
                <th className="py-2.5 px-2 text-right">Taxable ₹</th>
                <th className="py-2.5 px-2 text-right">GST</th>
                <th className="py-2.5 px-3 text-right">Total ₹</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {purchase.items?.map((it, idx) => (
                <tr key={it._id || idx}>
                  <td className="py-2.5 px-3 text-gray-500">{idx + 1}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-gray-900">{it.nameSnapshot}</div>
                    <div className="text-[10px] text-gray-500">
                      SKU: {it.skuSnapshot} | Unit: {it.unitSnapshot}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 font-mono text-gray-700">{it.batchNumber || '—'}</td>
                  <td className="py-2.5 px-2 text-gray-600">
                    {it.expiryDate ? new Date(it.expiryDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-2.5 px-2 text-right font-semibold">
                    {it.quantity} {it.freeQuantity > 0 && `(+${it.freeQuantity})`}
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    ₹{(it.purchaseRatePaise / 100).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    ₹{(it.taxableAmountPaise / 100).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    {it.gstRate}% (₹{((it.cgstPaise + it.sgstPaise + it.igstPaise) / 100).toFixed(2)})
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                    ₹{(it.lineTotalPaise / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals & Financial Summary */}
          <div className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-3 text-xs">
            <div>
              {purchase.notes && (
                <div className="rounded-lg bg-gray-50 p-2.5 text-gray-700">
                  <span className="font-semibold">Notes:</span> {purchase.notes}
                </div>
              )}
              {isCancelled && (
                <div className="mt-2 rounded-lg bg-red-50 p-2.5 text-red-800">
                  <span className="font-bold">Cancelled:</span> {purchase.cancellationReason}
                </div>
              )}
            </div>

            <div className="space-y-1 text-right">
              <div className="flex justify-between text-gray-600">
                <span>Taxable Subtotal:</span>
                <span>₹{(purchase.subtotalPaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Tax Total:</span>
                <span>₹{(purchase.taxTotalPaise / 100).toFixed(2)}</span>
              </div>
              {purchase.additionalChargesPaise > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Additional Charges:</span>
                  <span>₹{(purchase.additionalChargesPaise / 100).toFixed(2)}</span>
                </div>
              )}
              {purchase.roundOffPaise !== 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Round-off:</span>
                  <span>₹{(purchase.roundOffPaise / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-300 pt-1 text-sm font-black text-gray-900">
                <span>Grand Total:</span>
                <span className="text-green-800">
                  ₹{(purchase.grandTotalPaise / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Paid Amount:</span>
                <span>₹{(purchase.paidPaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-red-700">
                <span>Remaining Balance Payable:</span>
                <span>₹{(purchase.balancePaise / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Signatures for Print */}
          <div className="mt-12 hidden grid-cols-2 pt-8 text-xs text-gray-600 print:grid">
            <div>
              <div className="border-t border-gray-400 pt-2 w-48">Store Keeper / Receiver</div>
            </div>
            <div className="text-right">
              <div className="border-t border-gray-400 pt-2 w-48 ml-auto">
                Authorized Signatory
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
