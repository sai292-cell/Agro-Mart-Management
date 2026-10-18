import React, { useRef } from 'react';
import { Printer, X, CheckCircle, AlertCircle, Calendar, User, Phone, MapPin, Receipt, CreditCard } from 'lucide-react';
import Button from '../common/Button';
import Badge from '../common/Badge';

export default function InvoiceReceiptModal({ invoice, onClose }) {
  const printRef = useRef(null);

  if (!invoice) return null;

  const formatCurrency = (paise) => '₹' + ((Number(paise) || 0) / 100).toFixed(2);
  const formatDate = (date) => new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'PAID': return 'success';
      case 'PARTIAL': return 'warning';
      case 'UNPAID': return 'danger';
      case 'CANCELLED': return 'default';
      default: return 'primary';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Action Header (Hidden on print) */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#166534]" />
            <h2 className="text-base font-bold text-slate-800">
              Tax Invoice Preview / कर पावती ({invoice.invoiceNumber})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={Printer}
              onClick={handlePrint}
              className="bg-[#166534] hover:bg-[#14532d]"
            >
              Print Receipt / छापा
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="p-6 md:p-8 overflow-y-auto text-slate-800" ref={printRef} id="printable-tax-invoice">
          {/* Shop Header */}
          <div className="border-b-2 border-[#166534] pb-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-black text-[#166534] tracking-tight">
                शिवश्री ॲग्रो मार्ट / SHIVSHREE AGRO MART
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                दुकान नं. ४, कृषी उत्पन्न बाजार समिती, राहुरी, जि. अहिल्यानगर (महाराष्ट्र)
              </p>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                GSTIN: 27AAACS1234F1Z5 | Lic: FERT-413722 / SEED-88219 / PEST-2041
              </p>
              <p className="text-xs font-semibold text-emerald-800 mt-0.5">
                मोबाईल: ९८७६५४३२१० / 9876543210
              </p>
            </div>
            <div className="sm:text-right">
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">
                TAX INVOICE / कर पावती
              </span>
              <p className="text-lg font-black text-slate-900 font-mono">{invoice.invoiceNumber}</p>
              <p className="text-xs text-slate-500 mt-0.5">{formatDate(invoice.invoiceDate)}</p>
              <div className="mt-2">
                <Badge variant={getStatusBadgeVariant(invoice.status)}>
                  {invoice.status}
                </Badge>
              </div>
            </div>
          </div>

          {/* Customer & Staff Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <p className="font-bold text-slate-700 uppercase tracking-wide text-[10px] mb-1">
                Billed To (Customer / शेतकरी):
              </p>
              <p className="font-bold text-sm text-slate-900">
                {invoice.customerSnapshot?.name || 'Walk-in Customer (रोख/UPI ग्राहक)'}
              </p>
              {invoice.customerSnapshot?.phone && (
                <p className="text-slate-600 mt-0.5">फोन: {invoice.customerSnapshot.phone}</p>
              )}
              {invoice.customerSnapshot?.village && (
                <p className="text-slate-600 mt-0.5">
                  गाव: {invoice.customerSnapshot.village} {invoice.customerSnapshot.taluka ? `(${invoice.customerSnapshot.taluka})` : ''}
                </p>
              )}
              <p className="text-slate-500 mt-1">विक्री प्रकार: <span className="font-semibold">{invoice.saleType}</span></p>
            </div>
            <div className="sm:text-right">
              <p className="font-bold text-slate-700 uppercase tracking-wide text-[10px] mb-1">
                Counter Details:
              </p>
              <p className="text-slate-700">कॅशियर / नोंदणी: <span className="font-semibold text-slate-900">{invoice.createdBy?.name || 'Authorized Staff'}</span></p>
              <p className="text-slate-700 mt-1">देय रक्कम: <span className="font-bold font-mono text-slate-900">{formatCurrency(invoice.grandTotalPaise)}</span></p>
              <p className="text-emerald-700 mt-0.5">जमा रक्कम: <span className="font-bold font-mono">{formatCurrency(invoice.paidPaise)}</span></p>
              <p className={`mt-0.5 font-bold ${invoice.balancePaise > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                बाकी शिल्लक: {formatCurrency(invoice.balancePaise)}
              </p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-slate-700 font-semibold uppercase text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Product / तपशील</th>
                  <th className="py-2.5 px-3">Batch & Expiry</th>
                  <th className="py-2.5 px-3">HSN</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Rate</th>
                  <th className="py-2.5 px-3 text-right">Taxable</th>
                  <th className="py-2.5 px-3 text-right">GST %</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.items?.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 text-slate-500">{idx + 1}</td>
                    <td className="py-2 px-3">
                      <p className="font-bold text-slate-900">{item.nameSnapshot}</p>
                      <p className="text-[10px] text-slate-500 font-mono">SKU: {item.skuSnapshot}</p>
                    </td>
                    <td className="py-2 px-3">
                      <p className="font-mono text-slate-800">{item.batchNumberSnapshot || 'N/A'}</p>
                      {item.expiryDateSnapshot && (
                        <p className="text-[10px] text-slate-500">
                          Exp: {new Date(item.expiryDateSnapshot).toLocaleDateString()}
                        </p>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-600">{item.hsnCodeSnapshot || '-'}</td>
                    <td className="py-2 px-3 text-right font-semibold">
                      {item.quantity} {item.unitSnapshot}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">
                      {formatCurrency(item.unitSellingPricePaise)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">
                      {formatCurrency(item.taxableAmountPaise)}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-700">
                      {item.gstRate}%
                    </td>
                    <td className="py-2 px-3 text-right font-bold font-mono text-slate-900">
                      {formatCurrency(item.lineTotalPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Breakdown & Totals */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-6">
            <div className="text-xs text-slate-500 max-w-sm">
              <p className="font-bold text-slate-700 mb-1">नियम व अटी (Terms & Conditions):</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                <li>मूळ बिलाशिवाय विकलेला माल परत अथवा बदलून मिळणार नाही.</li>
                <li>बियाणे व रासायनिक खतांचा वापर कृषी तज्ज्ञांच्या सल्ल्यानेच करावा.</li>
                <li>सर्व वाद राहुरी न्यायालयाच्या अधिकारक्षेत्रात राहतील.</li>
              </ul>
              {invoice.notes && (
                <p className="mt-2 text-slate-700 italic">
                  <strong>नोंद:</strong> {invoice.notes}
                </p>
              )}
              {invoice.cancellationReason && (
                <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded text-rose-800">
                  <strong>रद्द करण्याचे कारण:</strong> {invoice.cancellationReason}
                </div>
              )}
            </div>

            <div className="w-full sm:w-72 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div className="flex justify-between py-1 text-slate-600">
                <span>करपात्र उपएकूण (Taxable):</span>
                <span className="font-mono font-medium">{formatCurrency(invoice.taxableSubtotalPaise)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>CGST (2.5% / 9% / 14%):</span>
                <span className="font-mono font-medium">{formatCurrency(invoice.cgstTotalPaise)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>SGST (2.5% / 9% / 14%):</span>
                <span className="font-mono font-medium">{formatCurrency(invoice.sgstTotalPaise)}</span>
              </div>
              {invoice.discountPaise > 0 && (
                <div className="flex justify-between py-1 text-emerald-700 font-semibold">
                  <span>सूट (Discount):</span>
                  <span className="font-mono">-{formatCurrency(invoice.discountPaise)}</span>
                </div>
              )}
              {invoice.roundOffPaise !== 0 && (
                <div className="flex justify-between py-1 text-slate-500">
                  <span>राउंड-ऑफ (Round-off):</span>
                  <span className="font-mono">
                    {invoice.roundOffPaise > 0 ? '+' : ''}{formatCurrency(invoice.roundOffPaise)}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2 border-t-2 border-[#166534] mt-2 font-bold text-sm text-[#166534]">
                <span>एकूण देय (Grand Total):</span>
                <span className="font-mono text-base">{formatCurrency(invoice.grandTotalPaise)}</span>
              </div>
              <div className="flex justify-between py-1 text-emerald-800 font-bold border-t border-slate-200 mt-1">
                <span>एकूण जमा (Paid):</span>
                <span className="font-mono">{formatCurrency(invoice.paidPaise)}</span>
              </div>
              <div className={`flex justify-between py-1 font-bold ${invoice.balancePaise > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                <span>बाकी (Balance Due):</span>
                <span className="font-mono">{formatCurrency(invoice.balancePaise)}</span>
              </div>
            </div>
          </div>

          {/* Payment Receipts Audit Section */}
          {invoice.payments && invoice.payments.length > 0 && (
            <div className="border-t border-dashed border-slate-300 pt-4 text-xs">
              <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-[#166534]" />
                जमा व्यवहार तपशील / Recorded Payment Receipts
              </h3>
              <div className="space-y-1.5">
                {invoice.payments.map((p, pIdx) => (
                  <div key={pIdx} className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-900">{p.paymentMode}</span>
                      {p.transactionReference && (
                        <span className="text-[11px] text-slate-500 font-mono ml-2">Ref: {p.transactionReference}</span>
                      )}
                      <span className="text-[10px] text-slate-400 ml-2">
                        {p.paymentDate ? new Date(p.paymentDate).toLocaleString() : ''}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-emerald-800">{formatCurrency(p.amountPaise)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Signature */}
          <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
            <div>
              <p>शिवश्री ॲग्रो मार्ट, राहुरी येथे भेट दिल्याबद्दल धन्यवाद!</p>
              <p className="text-[10px]">शेतकरी समृद्धी हेच आमचे ध्येय! / Committed to Farmer Prosperity</p>
            </div>
            <div className="text-right">
              <div className="w-36 border-b border-slate-400 mb-1"></div>
              <p className="font-semibold text-slate-700">अधिकृत स्वाक्षरी / Authorized Signatory</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
