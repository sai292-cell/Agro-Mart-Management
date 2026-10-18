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
  Building2,
  Truck,
  AlertCircle,
  Wallet,
  CheckCircle,
  BarChart3,
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

  const role = user?.role;
  const isManagerOrOwner = role === 'OWNER' || role === 'MANAGER';
  const isOwner = role === 'OWNER';

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

      {/* Feature Modules Overview (Filtered by Role) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* POS Billing - Accessible to OWNER, MANAGER, CASHIER */}
        <Card
          hoverEffect
          className="border-emerald-300 bg-emerald-50/20 cursor-pointer hover:shadow-md transition-all"
          onClick={() => navigate('/admin/pos')}
        >
          <div className="flex items-center justify-between mb-3">
            <Receipt className="w-6 h-6 text-[#166534]" />
            <Badge variant="success" size="sm">
              Active Module
            </Badge>
          </div>
          <h2 className="text-sm font-bold text-slate-900 mb-1">POS Billing & Invoicing</h2>
          <p className="text-xs text-slate-600 mb-4">
            Counter sales, barcode/SKU checkout, cash/UPI/credit payments, and tax invoices.
          </p>
          <span className="text-xs font-bold text-[#166534] inline-flex items-center gap-1">
            Open POS Counter &rarr;
          </span>
        </Card>

        {/* Product Catalog & Inventory - Accessible to OWNER, MANAGER, CASHIER */}
        <Card
          hoverEffect
          className="border-emerald-300 bg-emerald-50/20 cursor-pointer hover:shadow-md transition-all"
          onClick={() => navigate('/admin/inventory')}
        >
          <div className="flex items-center justify-between mb-3">
            <Package className="w-6 h-6 text-[#166534]" />
            <Badge variant="success" size="sm">
              Active Module
            </Badge>
          </div>
          <h2 className="text-sm font-bold text-slate-900 mb-1">Product Catalog & Inventory</h2>
          <p className="text-xs text-slate-600 mb-4">
            FEFO expiry alerts, seeds, fertilizers, pesticide stock tracking, and inward receipts.
          </p>
          <span className="text-xs font-bold text-[#166534] inline-flex items-center gap-1">
            Open Inventory Hub &rarr;
          </span>
        </Card>

        {/* Farmer Credit Ledger - Accessible to OWNER, MANAGER, CASHIER */}
        <Card
          hoverEffect
          className="border-emerald-300 bg-emerald-50/20 cursor-pointer hover:shadow-md transition-all"
          onClick={() => navigate('/admin/credit')}
        >
          <div className="flex items-center justify-between mb-3">
            <Users className="w-6 h-6 text-[#166534]" />
            <Badge variant="success" size="sm">
              Active Module
            </Badge>
          </div>
          <h2 className="text-sm font-bold text-slate-900 mb-1">Farmer Credit Ledger (खातेवही)</h2>
          <p className="text-xs text-slate-600 mb-4">
            Farmer udhaari balance, digital passbooks, payment collections, and statements.
          </p>
          <span className="text-xs font-bold text-[#166534] inline-flex items-center gap-1">
            Open Credit Ledger &rarr;
          </span>
        </Card>

        {/* Supplier Management - Accessible to OWNER, MANAGER only */}
        {isManagerOrOwner && (
          <Card
            hoverEffect
            className="border-emerald-300 bg-emerald-50/20 cursor-pointer hover:shadow-md transition-all"
            onClick={() => navigate('/admin/suppliers')}
          >
            <div className="flex items-center justify-between mb-3">
              <Building2 className="w-6 h-6 text-[#166534]" />
              <Badge variant="success" size="sm">
                Active Module
              </Badge>
            </div>
            <h2 className="text-sm font-bold text-slate-900 mb-1">Supplier Management & AP (पुरवठादार)</h2>
            <p className="text-xs text-slate-600 mb-4">
              Company distributors, accounts payable passbooks, outward payments, and statements.
            </p>
            <span className="text-xs font-bold text-[#166534] inline-flex items-center gap-1">
              Open Suppliers &rarr;
            </span>
          </Card>
        )}

        {/* Purchases Inward - Accessible to OWNER, MANAGER only */}
        {isManagerOrOwner && (
          <Card
            hoverEffect
            className="border-emerald-300 bg-emerald-50/20 cursor-pointer hover:shadow-md transition-all"
            onClick={() => navigate('/admin/purchases')}
          >
            <div className="flex items-center justify-between mb-3">
              <Truck className="w-6 h-6 text-[#166534]" />
              <Badge variant="success" size="sm">
                Active Module
              </Badge>
            </div>
            <h2 className="text-sm font-bold text-slate-900 mb-1">Purchase Inward Bills (खरेदी नोंद)</h2>
            <p className="text-xs text-slate-600 mb-4">
              Record supplier stock receipts, batch manufacturing/expiry, and purchase vouchers.
            </p>
            <span className="text-xs font-bold text-[#166534] inline-flex items-center gap-1">
              Open Purchase Inward &rarr;
            </span>
          </Card>
        )}

        {/* Operating Expenses - Accessible to OWNER, MANAGER, CASHIER */}
        <Card
          hoverEffect
          className="border-emerald-300 bg-emerald-50/20 cursor-pointer hover:shadow-md transition-all"
          onClick={() => navigate('/admin/expenses')}
        >
          <div className="flex items-center justify-between mb-3">
            <Receipt className="w-6 h-6 text-[#166534]" />
            <Badge variant="success" size="sm">
              Active Module
            </Badge>
          </div>
          <h2 className="text-sm font-bold text-slate-900 mb-1">Operating Expenses (दुकान खर्च)</h2>
          <p className="text-xs text-slate-600 mb-4">
            Rent, electricity, wages, freight, maintenance, and manager approval workflows.
          </p>
          <span className="text-xs font-bold text-[#166534] inline-flex items-center gap-1">
            Open Expenses &rarr;
          </span>
        </Card>

        {/* Cashbook & Drawer - Accessible to OWNER, MANAGER, CASHIER */}
        <Card
          hoverEffect
          className="border-emerald-300 bg-emerald-50/20 cursor-pointer hover:shadow-md transition-all"
          onClick={() => navigate('/admin/cashbook')}
        >
          <div className="flex items-center justify-between mb-3">
            <Wallet className="w-6 h-6 text-[#166534]" />
            <Badge variant="success" size="sm">
              Active Module
            </Badge>
          </div>
          <h2 className="text-sm font-bold text-slate-900 mb-1">Cashbook & Drawer (रोखवही)</h2>
          <p className="text-xs text-slate-600 mb-4">
            Physical drawer float, live expected cash, counted cash, and variance detection.
          </p>
          <span className="text-xs font-bold text-[#166534] inline-flex items-center gap-1">
            Open Cashbook &rarr;
          </span>
        </Card>

        {/* Daily Closing - Accessible to OWNER, MANAGER only */}
        {isManagerOrOwner && (
          <Card
            hoverEffect
            className="border-emerald-300 bg-emerald-50/20 cursor-pointer hover:shadow-md transition-all"
            onClick={() => navigate('/admin/daily-closing')}
          >
            <div className="flex items-center justify-between mb-3">
              <CheckCircle className="w-6 h-6 text-[#166534]" />
              <Badge variant="success" size="sm">
                Active Module
              </Badge>
            </div>
            <h2 className="text-sm font-bold text-slate-900 mb-1">Daily Closing (दिवसअखेर ताळेबंद)</h2>
            <p className="text-xs text-slate-600 mb-4">
              End-of-day reconciliation, cash float versus counted drawer cash, and voucher print.
            </p>
            <span className="text-xs font-bold text-[#166534] inline-flex items-center gap-1">
              Open Daily Closing &rarr;
            </span>
          </Card>
        )}

        {/* Profitability Reports - Accessible to OWNER, MANAGER only */}
        {isManagerOrOwner && (
          <Card
            hoverEffect
            className="border-emerald-300 bg-emerald-50/20 cursor-pointer hover:shadow-md transition-all"
            onClick={() => navigate('/admin/reports')}
          >
            <div className="flex items-center justify-between mb-3">
              <BarChart3 className="w-6 h-6 text-[#166534]" />
              <Badge variant="success" size="sm">
                Active Module
              </Badge>
            </div>
            <h2 className="text-sm font-bold text-slate-900 mb-1">Profitability Reports (नफा-तोटा)</h2>
            <p className="text-xs text-slate-600 mb-4">
              Batch-based COGS, gross and operating profit margins, receivables, payables, and stock value.
            </p>
            <span className="text-xs font-bold text-[#166534] inline-flex items-center gap-1">
              Open Financial Reports &rarr;
            </span>
          </Card>
        )}

        {/* Staff Management - Accessible to OWNER only */}
        {isOwner && (
          <Card hoverEffect className="border-slate-200">
            <Shield className="w-6 h-6 text-emerald-700 mb-3" />
            <h2 className="text-sm font-bold text-slate-900 mb-1">Staff Management</h2>
            <p className="text-xs text-slate-500 mb-4">
              Manager and Cashier account provisioning and activity audits.
            </p>
            <span className="text-[10px] font-bold text-[#166534] uppercase tracking-wider">
              Protected (Owner Only)
            </span>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}

