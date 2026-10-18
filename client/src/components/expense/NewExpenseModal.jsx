import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Receipt, CheckCircle, AlertCircle } from 'lucide-react';
import { createExpenseApi } from '../../services/api';

const CATEGORIES = [
  { value: 'RENT', labelEn: 'Shop / Godown Rent', labelMr: 'दुकान / गोदाम भाडे' },
  { value: 'ELECTRICITY', labelEn: 'Electricity Bill', labelMr: 'वीज बिल' },
  { value: 'WATER', labelEn: 'Water Charges', labelMr: 'पाणीपट्टी' },
  { value: 'INTERNET_PHONE', labelEn: 'Internet & Mobile', labelMr: 'इंटरनेट / फोन बिल' },
  { value: 'SALARIES_WAGES', labelEn: 'Salaries, Wages & Labor', labelMr: 'पगार आणि हमाली' },
  { value: 'TRANSPORT_FUEL', labelEn: 'Transport, Fuel & Freight', labelMr: 'वाहतूक / डिझेल / हमाली' },
  { value: 'MAINTENANCE', labelEn: 'Maintenance & Repairs', labelMr: 'दुकान दुरुस्ती आणि देखभाल' },
  { value: 'STATIONERY_PACKAGING', labelEn: 'Stationery & Packaging Bags', labelMr: 'स्टेशनरी आणि बॅग्स' },
  { value: 'BANK_CHARGES', labelEn: 'Bank Charges & Fees', labelMr: 'बँक व व्यवहार शुल्क' },
  { value: 'TEA_REFRESHMENT', labelEn: 'Tea & Refreshment', labelMr: 'चहा आणि नाश्ता' },
  { value: 'MISCELLANEOUS', labelEn: 'Miscellaneous / Other', labelMr: 'इतर किरकोळ खर्च' },
];

export default function NewExpenseModal({ isOpen, onClose, onSuccess }) {
  const { t, i18n } = useTranslation();
  const isMr = i18n.language === 'mr';

  const [formData, setFormData] = useState({
    amountRupees: '',
    category: 'MISCELLANEOUS',
    description: '',
    paymentMode: 'CASH',
    referenceNumber: '',
    payee: '',
    receiptDocumentRef: '',
    expenseDate: new Date().toISOString().slice(0, 10),
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const amountRupeesNum = parseFloat(formData.amountRupees);
    if (isNaN(amountRupeesNum) || amountRupeesNum <= 0) {
      setError(isMr ? 'कृपया वैध रक्कम प्रविष्ट करा.' : 'Please enter a valid expense amount.');
      return;
    }

    if (!formData.payee.trim()) {
      setError(isMr ? 'कृपया खर्च प्राप्तकर्त्याचे नाव प्रविष्ट करा.' : 'Please enter the payee name.');
      return;
    }

    if (!formData.description.trim() || formData.description.trim().length < 3) {
      setError(isMr ? 'तपशील किमान ३ अक्षरांचा असावा.' : 'Description must be at least 3 characters.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        amountPaise: Math.round(amountRupeesNum * 100),
        category: formData.category,
        description: formData.description.trim(),
        paymentMode: formData.paymentMode,
        referenceNumber: formData.referenceNumber.trim(),
        payee: formData.payee.trim(),
        receiptDocumentRef: formData.receiptDocumentRef.trim(),
        expenseDate: formData.expenseDate ? new Date(formData.expenseDate).toISOString() : new Date().toISOString(),
      };

      await createExpenseApi(payload);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-surface border-border flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border shadow-2xl">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center space-x-2">
            <Receipt className="text-primary h-5 w-5" />
            <h2 className="text-text-main text-lg font-bold">
              {isMr ? 'नवीन दुकान खर्च नोंदवा' : 'Record Operating Expense'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-main rounded-lg p-1.5 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-6">
          {error && (
            <div className="flex items-center space-x-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-text-main mb-1.5 block text-xs font-semibold">
                {isMr ? 'रक्कम (₹)*' : 'Amount (₹)*'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                name="amountRupees"
                value={formData.amountRupees}
                onChange={handleChange}
                placeholder="0.00"
                required
                className="bg-surface border-border text-text-main focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm font-semibold focus:ring-2 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-text-main mb-1.5 block text-xs font-semibold">
                {isMr ? 'खर्च दिनांक*' : 'Expense Date*'}
              </label>
              <input
                type="date"
                name="expenseDate"
                value={formData.expenseDate}
                onChange={handleChange}
                required
                className="bg-surface border-border text-text-main focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-text-main mb-1.5 block text-xs font-semibold">
              {isMr ? 'खर्च प्रकार / वर्गवारी*' : 'Expense Category*'}
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              className="bg-surface border-border text-text-main focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {isMr ? cat.labelMr : cat.labelEn}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-text-main mb-1.5 block text-xs font-semibold">
                {isMr ? 'पेमेंट प्रकार*' : 'Payment Mode*'}
              </label>
              <select
                name="paymentMode"
                value={formData.paymentMode}
                onChange={handleChange}
                className="bg-surface border-border text-text-main focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              >
                <option value="CASH">{isMr ? 'रोख (Cash)' : 'Cash'}</option>
                <option value="UPI">{isMr ? 'यूपीआय (UPI)' : 'UPI'}</option>
                <option value="BANK_TRANSFER">{isMr ? 'बँक ट्रान्सफर (Bank)' : 'Bank Transfer'}</option>
                <option value="CHEQUE">{isMr ? 'धनादेश (Cheque)' : 'Cheque'}</option>
              </select>
            </div>

            <div>
              <label className="text-text-main mb-1.5 block text-xs font-semibold">
                {isMr ? 'संदर्भ / UTR क्रमांक' : 'Ref / UTR Number'}
              </label>
              <input
                type="text"
                name="referenceNumber"
                value={formData.referenceNumber}
                onChange={handleChange}
                placeholder="e.g. UTR12345678"
                className="bg-surface border-border text-text-main focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-text-main mb-1.5 block text-xs font-semibold">
              {isMr ? 'प्राप्तकर्ता / व्यक्ती किंवा संस्था*' : 'Payee / Recipient*' }
            </label>
            <input
              type="text"
              name="payee"
              value={formData.payee}
              onChange={handleChange}
              placeholder="e.g. MSEB, Transporter, Landlord"
              required
              className="bg-surface border-border text-text-main focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-text-main mb-1.5 block text-xs font-semibold">
              {isMr ? 'खर्चाचा तपशील / कारण*' : 'Description / Purpose*'}
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="e.g. Paid shop rent for October 2026"
              rows={2}
              required
              className="bg-surface border-border text-text-main focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-text-main mb-1.5 block text-xs font-semibold">
              {isMr ? 'पावती / बिल संदर्भ क्रमांक' : 'Receipt / Document Reference'}
            </label>
            <input
              type="text"
              name="receiptDocumentRef"
              value={formData.receiptDocumentRef}
              onChange={handleChange}
              placeholder="e.g. Bill #849302"
              className="bg-surface border-border text-text-main focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>

          <div className="border-border flex justify-end space-x-3 border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="border-border text-text-muted hover:bg-surface-alt rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
            >
              {isMr ? 'रद्द करा' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-primary hover:bg-primary-hover flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50"
            >
              {loading ? (
                <span>{isMr ? 'जतन होत आहे...' : 'Saving...'}</span>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span>{isMr ? 'खर्च नोंदवा' : 'Save Expense'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
