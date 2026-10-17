import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Sprout } from 'lucide-react';

export default function ProtectedRoute({ children, allowedRoles, redirectTo = '/' }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-8">
        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#166534] flex items-center justify-center animate-pulse mb-3">
          <Sprout className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
          Verifying session...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // If authenticated user tries to access a portal they don't have roles for
    return <Navigate to="/" replace />;
  }

  return children;
}
