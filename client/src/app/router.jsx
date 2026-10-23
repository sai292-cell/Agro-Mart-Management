import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import RootLayout from '../layouts/RootLayout';
import HomePage from '../pages/HomePage';
import OwnerLoginPage from '../pages/OwnerLoginPage';
import CustomerLoginPage from '../pages/CustomerLoginPage';
import CustomerRegisterPage from '../pages/CustomerRegisterPage';
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import InventoryDashboardPage from '../pages/admin/InventoryDashboardPage';
import PosBillingPage from '../pages/admin/PosBillingPage';
import CreditLedgerPage from '../pages/admin/CreditLedgerPage';
import SupplierManagementPage from '../pages/admin/SupplierManagementPage';
import PurchaseInwardPage from '../pages/admin/PurchaseInwardPage';
import ExpenseManagementPage from '../pages/admin/ExpenseManagementPage';
import CashbookPage from '../pages/admin/CashbookPage';
import DailyClosingPage from '../pages/admin/DailyClosingPage';
import ReportsPage from '../pages/admin/ReportsPage';
import CustomerDashboardPage from '../pages/customer/CustomerDashboardPage';
import NotFoundPage from '../pages/NotFoundPage';
import ProtectedRoute from '../components/auth/ProtectedRoute';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'owner/login',
        element: <OwnerLoginPage />,
      },
      {
        path: 'customer/login',
        element: <CustomerLoginPage />,
      },
      {
        path: 'customer/register',
        element: <CustomerRegisterPage />,
      },
      {
        path: 'admin/dashboard',
        element: (
          <ProtectedRoute allowedRoles={['OWNER', 'MANAGER', 'CASHIER']} redirectTo="/owner/login">
            <AdminDashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/inventory',
        element: (
          <ProtectedRoute allowedRoles={['OWNER', 'MANAGER', 'CASHIER']} redirectTo="/owner/login">
            <InventoryDashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/pos',
        element: (
          <ProtectedRoute allowedRoles={['OWNER', 'MANAGER', 'CASHIER']} redirectTo="/owner/login">
            <PosBillingPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/credit',
        element: (
          <ProtectedRoute allowedRoles={['OWNER', 'MANAGER', 'CASHIER']} redirectTo="/owner/login">
            <CreditLedgerPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/suppliers',
        element: (
          <ProtectedRoute allowedRoles={['OWNER', 'MANAGER']} redirectTo="/owner/login">
            <SupplierManagementPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/purchases',
        element: (
          <ProtectedRoute allowedRoles={['OWNER', 'MANAGER']} redirectTo="/owner/login">
            <PurchaseInwardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/expenses',
        element: (
          <ProtectedRoute allowedRoles={['OWNER', 'MANAGER', 'CASHIER']} redirectTo="/owner/login">
            <ExpenseManagementPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/cashbook',
        element: (
          <ProtectedRoute allowedRoles={['OWNER', 'MANAGER', 'CASHIER']} redirectTo="/owner/login">
            <CashbookPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/daily-closing',
        element: (
          <ProtectedRoute allowedRoles={['OWNER', 'MANAGER']} redirectTo="/owner/login">
            <DailyClosingPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/reports',
        element: (
          <ProtectedRoute allowedRoles={['OWNER', 'MANAGER']} redirectTo="/owner/login">
            <ReportsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'customer/dashboard',
        element: (
          <ProtectedRoute allowedRoles={['CUSTOMER']} redirectTo="/customer/login">
            <CustomerDashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
