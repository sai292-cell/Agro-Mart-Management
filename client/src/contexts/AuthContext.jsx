import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  loginApi,
  refreshApi,
  logoutApi,
  customerRegisterApi,
  customerLoginApi,
  getApiAccessToken,
  setApiAccessToken,
} from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Silent session restoration on initial application load
  useEffect(() => {
    async function restoreSession() {
      try {
        const data = await refreshApi();
        if (data?.user) {
          setUser(data.user);
        }
      } catch (err) {
        // No active refresh session, user remains unauthenticated
        setApiAccessToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  const login = async (identifier, password) => {
    const data = await loginApi(identifier, password);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    try {
      await logoutApi();
    } catch (err) {
      console.warn('Logout API error:', err.message);
    } finally {
      setUser(null);
      setApiAccessToken(null);
    }
  };

  const customerRegister = async (formData) => {
    return customerRegisterApi(formData);
  };

  const customerLogin = async (farmerId, password) => {
    const data = await customerLoginApi(farmerId, password);
    setUser(data.user);
    return data;
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    isOwner: user?.role === 'OWNER',
    isStaff: ['OWNER', 'MANAGER', 'CASHIER'].includes(user?.role),
    isCustomer: user?.role === 'CUSTOMER',
    login,
    logout,
    customerRegister,
    customerLogin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
