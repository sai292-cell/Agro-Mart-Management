import { createBrowserRouter } from 'react-router-dom';
import RootLayout from '../layouts/RootLayout';
import HomePage from '../pages/HomePage';
import OwnerLoginPage from '../pages/OwnerLoginPage';
import CustomerLoginPage from '../pages/CustomerLoginPage';
import NotFoundPage from '../pages/NotFoundPage';

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
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
