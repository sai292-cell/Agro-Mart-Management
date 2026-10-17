import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Shield,
  LogOut,
  Store,
  Users,
  Package,
  Receipt,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import PageContainer from '../../components/layout/PageContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';

export default function AdminDashboardPage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <PageContainer className="py-8">
      {/* Portal Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#166534] text-white flex items-center justify-center shadow-xs">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{user?.name}</h1>
              <Badge variant="primary" size="sm">
                {user?.role}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Shivshree Agro Mart — Internal Management Portal
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          icon={LogOut}
          onClick={handleLogout}
          className="text-rose-700 hover:bg-rose-50 border-rose-200"
        >
          Logout Session
        </Button>
      </div>

      {/* Security Status Banner */}
      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 mb-8 flex items-start gap-3">
        <Shield className="w-5 h-5 text-[#166534] shrink-0 mt-0.5" />
        <div className="text-xs">
          <span className="font-bold block uppercase tracking-wide">
            Authenticated Session Active (RBAC: {user?.role})
          </span>
          <p className="text-slate-600 mt-0.5">
            You are securely logged into Shivshree Agro Mart OS. Tokens are short-lived in memory and refreshed securely via HTTP-only cookies.
          </p>
        </div>
      </div>

      {/* Feature Modules Overview (Phase 5-9 Preview) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card hoverEffect className="border-slate-200">
          <Receipt className="w-6 h-6 text-[#166534] mb-3" />
          <h2 className="text-sm font-bold text-slate-900 mb-1">POS Billing</h2>
          <p className="text-xs text-slate-500 mb-4">
            Counter invoice creation, barcode lookup, and split payments.
          </p>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Scheduled for Phase 7
          </span>
        </Card>

        <Card hoverEffect className="border-slate-200">
          <Package className="w-6 h-6 text-amber-600 mb-3" />
          <h2 className="text-sm font-bold text-slate-900 mb-1">Batch Inventory</h2>
          <p className="text-xs text-slate-500 mb-4">
            FEFO expiry alerts, seeds, fertilizers, and pesticide stock tracking.
          </p>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Scheduled for Phase 5
          </span>
        </Card>

        <Card hoverEffect className="border-slate-200">
          <Users className="w-6 h-6 text-blue-600 mb-3" />
          <h2 className="text-sm font-bold text-slate-900 mb-1">Credit Ledger (Khaata)</h2>
          <p className="text-xs text-slate-500 mb-4">
            Farmer udhaari balance, partial payments, and ledger passbooks.
          </p>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Scheduled for Phase 6
          </span>
        </Card>

        <Card hoverEffect className="border-slate-200">
          <Shield className="w-6 h-6 text-emerald-700 mb-3" />
          <h2 className="text-sm font-bold text-slate-900 mb-1">Staff Management</h2>
          <p className="text-xs text-slate-500 mb-4">
            Manager and Cashier account provisioning and activity audits.
          </p>
          <span className="text-[10px] font-bold text-[#166534] uppercase tracking-wider">
            Active in Phase 4
          </span>
        </Card>
      </div>
    </PageContainer>
  );
}
