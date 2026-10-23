import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  UserCheck,
  ArrowLeft,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Shield,
  HelpCircle,
  X,
  UserPlus,
  Store,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import PageContainer from '../components/layout/PageContainer';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';

export default function CustomerLoginPage() {
  const { t } = useTranslation();
  const { customerLogin, isAuthenticated, isCustomer } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [farmerId, setFarmerId] = useState(location.state?.registeredFarmerId || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);

  const from = location.state?.from?.pathname || '/customer/dashboard';

  // If already authenticated as customer, redirect to dashboard immediately
  useEffect(() => {
    if (isAuthenticated && isCustomer) {
      navigate('/customer/dashboard', { replace: true });
    }
  }, [isAuthenticated, isCustomer, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanId = farmerId.trim().toUpperCase();
    if (!cleanId) {
      setErrorMessage(t('farmerAuth.farmerId') + ' is required.');
      return;
    }
    if (!password) {
      setErrorMessage(t('farmerAuth.password') + ' is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await customerLogin(cleanId, password);
      navigate(from, { replace: true });
    } catch (err) {
      setErrorMessage(
        err.details?.message || err.message || 'Invalid Farmer ID or password. Please verify your credentials.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer className="flex items-center justify-center py-8 sm:py-12">
      <div className="w-full max-w-md">
        {/* Back Link */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 mb-6 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('customerLogin.backButton')}</span>
        </button>

        <Card className="border-2 border-slate-300 shadow-sm p-6 sm:p-8 relative">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-xs">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <Badge variant="default" size="sm" className="mb-1">
                {t('farmerAuth.badge')}
              </Badge>
              <h1 className="text-xl font-bold text-slate-900">
                {t('farmerAuth.loginTitle')}
              </h1>
            </div>
          </div>

          <p className="text-xs text-slate-600 mb-6 leading-relaxed">
            {t('farmerAuth.loginSubtitle')}
          </p>

          {/* Registration Success Banner if coming directly from registration */}
          {location.state?.registeredFarmerId && (
            <div className="mb-6 p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">
                  {t('farmerAuth.successBadge')}: {location.state.registeredFarmerId}
                </span>
                <p className="text-emerald-800 mt-0.5">
                  {t('farmerAuth.saveIdNotice')}
                </p>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-6 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Farmer ID Field */}
            <div>
              <label
                htmlFor="farmerId"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                {t('farmerAuth.farmerId')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <UserCheck className="w-4 h-4" />
                </div>
                <input
                  id="farmerId"
                  type="text"
                  required
                  autoFocus={!farmerId}
                  value={farmerId}
                  onChange={(e) => setFarmerId(e.target.value.toUpperCase())}
                  placeholder={t('farmerAuth.farmerIdPlaceholder')}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent font-mono tracking-wide"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {t('farmerAuth.farmerIdHelper')}
              </p>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-slate-700"
                >
                  {t('farmerAuth.password')}
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[11px] font-semibold text-[#166534] hover:underline cursor-pointer"
                >
                  {t('farmerAuth.forgotPasswordLink')}
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus={Boolean(farmerId)}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('farmerAuth.passwordPlaceholder')}
                  className="w-full pl-9 pr-10 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showPassword ? t('farmerAuth.hidePassword') : t('farmerAuth.showPassword')}
                  aria-label={showPassword ? t('farmerAuth.hidePassword') : t('farmerAuth.showPassword')}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isSubmitting}
              className="w-full mt-2"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('farmerAuth.signingIn')}
                </span>
              ) : (
                t('farmerAuth.signInButton')
              )}
            </Button>
          </form>

          {/* Registration Navigation Link */}
          <div className="mt-6 pt-5 border-t border-slate-200 text-center">
            <p className="text-xs text-slate-600 mb-2">
              {t('farmerAuth.createAccountLink')}
            </p>
            <Link
              to="/customer/register"
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg border-2 border-slate-300 text-slate-800 font-semibold text-xs hover:border-[#166534] hover:text-[#166534] hover:bg-emerald-50/40 transition-all cursor-pointer shadow-2xs"
            >
              <UserPlus className="w-4 h-4 text-[#166534]" />
              <span>{t('farmerAuth.registerTitle')}</span>
            </Link>
          </div>

          {/* Privacy Note */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>{t('farmerAuth.privacyNotice')}</span>
            </p>
          </div>
        </Card>

        {/* Forgot Password Modal (₹0 Budget Security Safeguard) */}
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <Card className="w-full max-w-md p-6 bg-white shadow-xl border-2 border-slate-300 relative animate-in fade-in zoom-in duration-150">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <Badge variant="warning" size="sm" className="mb-1">
                    {t('farmerAuth.forgotPasswordBadge')}
                  </Badge>
                  <h2 className="text-base font-bold text-slate-900">
                    {t('farmerAuth.forgotPasswordTitle')}
                  </h2>
                </div>
              </div>

              <div className="text-xs text-slate-700 space-y-3 leading-relaxed mb-6">
                <p>{t('farmerAuth.forgotPasswordMessage')}</p>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 font-semibold text-slate-900 mb-1">
                    <Store className="w-4 h-4 text-[#166534]" />
                    <span>Shivshree Agro Mart Counter</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    पत्ता / Address: Shivshree Agro Mart, Maharashtra, India.
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    पडताळणी / Verification: Bring your registered mobile phone or past printed bill.
                  </p>
                </div>
              </div>

              <Button
                variant="primary"
                size="md"
                onClick={() => setShowForgotModal(false)}
                className="w-full"
              >
                {t('farmerAuth.close')}
              </Button>
            </Card>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
