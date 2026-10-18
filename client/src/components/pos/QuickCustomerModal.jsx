import React, { useState } from 'react';
import { X, UserPlus, AlertCircle } from 'lucide-react';
import Button from '../common/Button';
import { quickCreateCustomerApi } from '../../services/api';

export default function QuickCustomerModal({ userRole, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [taluka, setTaluka] = useState('राहुरी');
  const [creditLimitRupees, setCreditLimitRupees] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isCashier = userRole === 'CASHIER';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Customer name is required.');
      return;
    }

    const limitRupees = parseFloat(creditLimitRupees) || 0;
    const creditLimitPaise = Math.round(limitRupees * 100);

    setLoading(true);
    try {
      const res = await quickCreateCustomerApi({
        name: name.trim(),
        phone: phone.trim() || undefined,
        village: village.trim() || undefined,
        taluka: taluka.trim() || undefined,
        creditLimitPaise: isCashier ? 0 : creditLimitPaise,
      });

      onSuccess(res.customer);
    } catch (err) {
      setError(err.message || 'Failed to create customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#166534]" />
            <h2 className="text-base font-bold text-slate-800">
              Quick Register Farmer / नवीन शेतकरी नोंदणी
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Farmer Full Name / शेतकऱ्याचे नाव <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ramesh Baburao Patil / रमेश बाबुराव पाटील"
              required
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone / मोबाईल नंबर
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Village / गाव
              </label>
              <input
                type="text"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                placeholder="e.g. वांबोरी / राहुरी"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Taluka / तालुका
            </label>
            <input
              type="text"
              value={taluka}
              onChange={(e) => setTaluka(e.target.value)}
              placeholder="e.g. राहुरी"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534]"
            />
          </div>

          {!isCashier ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Credit Limit / उधारी मर्यादा (₹)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={creditLimitRupees}
                onChange={(e) => setCreditLimitRupees(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534]"
              />
              <p className="text-[10px] text-slate-400 mt-1">Authorized for OWNER and MANAGER roles.</p>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded">
              Note: Cashiers can register farmers with default ₹0 credit limit. Owner/Manager can increase limits later.
            </p>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={loading}
              className="bg-[#166534] hover:bg-[#14532d]"
            >
              {loading ? 'Registering...' : 'Save Farmer / जतन करा'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
