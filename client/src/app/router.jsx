import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import RootLayout from '../layouts/RootLayout';
import HomePage from '../pages/HomePage';
import OwnerLoginPage from '../pages/OwnerLoginPage';
import CustomerLoginPage from '../pages/CustomerLoginPage';
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
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
        path: 'admin/dashboard',
        element: (
          <ProtectedRoute allowedRoles={['OWNER', 'MANAGER', 'CASHIER']} redirectTo="/owner/login">
            <AdminDashboardPage />
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
