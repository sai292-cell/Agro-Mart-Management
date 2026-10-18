import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Building2, Phone, Mail, MapPin, FileText, Landmark } from 'lucide-react';
import { createSupplierApi, updateSupplierApi } from '../../services/api';

export default function SupplierFormModal({ isOpen, onClose, supplier, onSaved }) {
  const { t } = useTranslation();
  const isEdit = Boolean(supplier?._id);

  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    villageCity: '',
    district: 'Nashik',
    state: 'Maharashtra',
    pincode: '',
    supplierType: 'DISTRIBUTOR',
    gstin: '',
    pan: '',
    paymentTermsDays: 30,
    creditLimitPaise: 0,
    creditLimitRupees: '0',
    bankDetails: {
      accountName: '',
      accountNumber: '',
      bankName: '',
      ifscCode: '',
      branch: '',
    },
    notes: '',
    active: true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name || '',
        contactPerson: supplier.contactPerson || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
        villageCity: supplier.villageCity || '',
        district: supplier.district || 'Nashik',
        state: supplier.state || 'Maharashtra',
        pincode: supplier.pincode || '',
        supplierType: supplier.supplierType || 'DISTRIBUTOR',
        gstin: supplier.taxDetails?.gstin || '',
        pan: supplier.taxDetails?.pan || '',
        paymentTermsDays: supplier.paymentTermsDays ?? 30,
        creditLimitPaise: supplier.creditLimitPaise || 0,
        creditLimitRupees: ((supplier.creditLimitPaise || 0) / 100).toString(),
        bankDetails: {
          accountName: supplier.bankDetails?.accountName || '',
          accountNumber: supplier.bankDetails?.accountNumber || '',
          bankName: supplier.bankDetails?.bankName || '',
          ifscCode: supplier.bankDetails?.ifscCode || '',
          branch: supplier.bankDetails?.branch || '',
        },
        notes: supplier.notes || '',
        active: supplier.active ?? true,
      });
    } else {
      setFormData({
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        villageCity: '',
        district: 'Nashik',
        state: 'Maharashtra',
        pincode: '',
        supplierType: 'DISTRIBUTOR',
        gstin: '',
        pan: '',
        paymentTermsDays: 30,
        creditLimitPaise: 0,
        creditLimitRupees: '0',
        bankDetails: {
          accountName: '',
          accountNumber: '',
          bankName: '',
          ifscCode: '',
          branch: '',
        },
        notes: '',
        active: true,
      });
    }
    setError(null);
  }, [supplier, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError(t('supplier.nameRequired', 'Supplier name is required'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: formData.name.trim(),
        contactPerson: formData.contactPerson.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        villageCity: formData.villageCity.trim(),
        district: formData.district.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode.trim(),
        supplierType: formData.supplierType,
        gstin: formData.gstin.trim().toUpperCase(),
        pan: formData.pan.trim().toUpperCase(),
        paymentTermsDays: Number(formData.paymentTermsDays || 30),
        creditLimitPaise: Math.round(Number(formData.creditLimitRupees || 0) * 100),
        bankDetails: formData.bankDetails,
        notes: formData.notes.trim(),
        active: formData.active,
      };

      if (isEdit) {
        await updateSupplierApi(supplier._id, payload);
      } else {
        await createSupplierApi(payload);
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save supplier');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {isEdit
                  ? t('supplier.editSupplier', 'Edit Supplier (पुरवठादार संपादन)')
                  : t('supplier.addSupplier', 'Register New Supplier (नवीन पुरवठादार नोंद)')}
              </h2>
              <p className="text-xs text-gray-500">
                {t('supplier.subtitle', 'Agro-input company, distributor or seed agency')}
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

          <div className="space-y-4">
            {/* Business Info */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  {t('supplier.companyName', 'Business / Supplier Name (पुरवठादार नाव)')} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Mahyco Seeds Ltd / Rallis India"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  {t('supplier.contactPerson', 'Contact Person (संपर्क व्यक्ती)')}
                </label>
                <input
                  type="text"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  placeholder="e.g. Rahul Shinde"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  {t('supplier.supplierType', 'Category / Type (प्रकार)')}
                </label>
                <select
                  value={formData.supplierType}
                  onChange={(e) => setFormData({ ...formData, supplierType: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-hidden"
                >
                  <option value="DISTRIBUTOR">Distributor (वितरक)</option>
                  <option value="MANUFACTURER">Manufacturer (उत्पादक)</option>
                  <option value="WHOLESALER">Wholesaler (घाऊक विक्रेता)</option>
                  <option value="OTHER">Other (इतर)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  {t('supplier.phone', 'Phone Number (फोन नंबर)')}
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. 9822012345"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  {t('supplier.email', 'Email Address (ईमेल)')}
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="sales@supplier.com"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Tax Details */}
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
              <h3 className="mb-2 text-xs font-bold text-gray-700 uppercase">
                {t('supplier.taxDetails', 'Tax & Registration (जीएसटी व नोंदणी)')}
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-gray-600">GSTIN (जीएसटी क्रमांक)</label>
                  <input
                    type="text"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    placeholder="27ABCDE1234F1Z5"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs uppercase focus:border-green-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">PAN Number (पॅन)</label>
                  <input
                    type="text"
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                    placeholder="ABCDE1234F"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs uppercase focus:border-green-600 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  {t('supplier.address', 'Street Address (पत्ता)')}
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Plot No, Industrial Area"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">City/Village</label>
                <input
                  type="text"
                  value={formData.villageCity}
                  onChange={(e) => setFormData({ ...formData, villageCity: e.target.value })}
                  placeholder="Nashik"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">District</label>
                <input
                  type="text"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">Pincode</label>
                <input
                  type="text"
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                  placeholder="422001"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Payment & Credit Terms */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  {t('supplier.paymentTermsDays', 'Credit Terms (दिवस)')}
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.paymentTermsDays}
                  onChange={(e) => setFormData({ ...formData, paymentTermsDays: e.target.value })}
                  placeholder="30"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-hidden"
                />
                <span className="text-[10px] text-gray-400">Standard due period in days</span>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  {t('supplier.creditLimit', 'Credit Limit (क्रेडिट मर्यादा ₹)')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={formData.creditLimitRupees}
                  onChange={(e) => setFormData({ ...formData, creditLimitRupees: e.target.value })}
                  placeholder="0"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-hidden"
                />
                <span className="text-[10px] text-gray-400">Supplier allowed credit ceiling</span>
              </div>
            </div>

            {/* Bank Details */}
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase">
                <Landmark className="h-4 w-4 text-gray-500" />
                <span>{t('supplier.bankDetails', 'Bank Account Details (बँक तपशील)')}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-gray-600">Account Name</label>
                  <input
                    type="text"
                    value={formData.bankDetails.accountName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bankDetails: { ...formData.bankDetails, accountName: e.target.value },
                      })
                    }
                    placeholder="M/s Mahyco Seeds"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:border-green-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">Account Number</label>
                  <input
                    type="text"
                    value={formData.bankDetails.accountNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bankDetails: { ...formData.bankDetails, accountNumber: e.target.value },
                      })
                    }
                    placeholder="123456789012"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:border-green-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">Bank Name</label>
                  <input
                    type="text"
                    value={formData.bankDetails.bankName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bankDetails: { ...formData.bankDetails, bankName: e.target.value },
                      })
                    }
                    placeholder="State Bank of India"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:border-green-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">IFSC Code</label>
                  <input
                    type="text"
                    value={formData.bankDetails.ifscCode}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bankDetails: {
                          ...formData.bankDetails,
                          ifscCode: e.target.value.toUpperCase(),
                        },
                      })
                    }
                    placeholder="SBIN0001234"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs uppercase focus:border-green-600 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">Notes (नोंदी)</label>
              <textarea
                rows="2"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Special distributor terms, delivery schedule, etc."
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
            >
              Cancel (रद्द करा)
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-green-700 px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-green-800 disabled:opacity-50"
            >
              {loading
                ? 'Saving...'
                : isEdit
                ? 'Update Supplier (अपडेट करा)'
                : 'Save Supplier (जतन करा)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
