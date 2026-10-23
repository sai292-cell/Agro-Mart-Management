import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  UserPlus,
  ArrowLeft,
  User,
  Smartphone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  MapPin,
  Globe,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Copy,
  Check,
  Shield,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import PageContainer from '../components/layout/PageContainer';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';

export default function CustomerRegisterPage() {
  const { t } = useTranslation();
  const { customerRegister, isAuthenticated, isCustomer } = useAuth();
  const navigate = useNavigate();

  // If already authenticated as customer, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated && isCustomer) {
      navigate('/customer/dashboard', { replace: true });
    }
  }, [isAuthenticated, isCustomer, navigate]);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    village: '',
    taluka: '',
    district: '',
    state: 'Maharashtra',
    preferredLanguage: 'mr',
    age: '',
    gender: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [registeredData, setRegisteredData] = useState(null); // When registration succeeds: { farmerId, name, phone }
  const [copied, setCopied] = useState(false);

  // Password validation checks
  const hasMinLength = formData.password.length >= 8;
  const hasUppercase = /[A-Z]/.test(formData.password);
  const hasLowercase = /[a-z]/.test(formData.password);
  const hasNumber = /\d/.test(formData.password);
  const isStrongPassword = hasMinLength && hasUppercase && hasLowercase && hasNumber;
  const passwordsMatch = formData.password.length > 0 && formData.password === formData.confirmPassword;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCopyFarmerId = async () => {
    if (!registeredData?.farmerId) return;
    try {
      await navigator.clipboard.writeText(registeredData.farmerId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('Clipboard write failed', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    // Validation checks
    const cleanPhoneDigits = formData.phone.replace(/\D/g, '');
    const tenDigits = cleanPhoneDigits.length >= 10 ? cleanPhoneDigits.slice(-10) : cleanPhoneDigits;
    if (tenDigits.length !== 10 || !/^[6-9]\d{9}$/.test(tenDigits)) {
      setErrorMessage(t('farmerAuth.mobilePlaceholder') + ' - Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (!isStrongPassword) {
      setErrorMessage(t('farmerAuth.passwordRequirements'));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage(t('farmerAuth.passwordsMismatch'));
      return;
    }

    if (!formData.name.trim() || !formData.village.trim() || !formData.taluka.trim() || !formData.district.trim()) {
      setErrorMessage('Please fill in all mandatory fields marked with an asterisk (*).');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phone: tenDigits,
        email: formData.email.trim() || undefined,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        village: formData.village.trim(),
        taluka: formData.taluka.trim(),
        district: formData.district.trim(),
        state: formData.state.trim() || 'Maharashtra',
        preferredLanguage: formData.preferredLanguage || 'mr',
        age: formData.age ? Number(formData.age) : undefined,
        gender: formData.gender || undefined,
      };

      const res = await customerRegister(payload);
      if (res?.data?.farmerId) {
        setRegisteredData(res.data);
      } else {
        throw new Error('Registration completed but no Farmer ID was returned.');
      }
    } catch (err) {
      setErrorMessage(
        err.details?.message || err.message || 'Registration failed. Please check the provided information.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // SUCCESS SCREEN
  if (registeredData) {
    return (
      <PageContainer className="flex items-center justify-center py-10 sm:py-16">
        <div className="w-full max-w-lg">
          <Card className="border-2 border-emerald-400 shadow-lg p-6 sm:p-10 text-center bg-gradient-to-b from-white to-emerald-50/30">
            {/* Celebration Icon */}
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-[#166534] flex items-center justify-center mx-auto mb-4 shadow-sm animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <Badge variant="primary" size="md" className="mb-2">
              {t('farmerAuth.successBadge')}
            </Badge>

            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              {t('farmerAuth.successTitle')}
            </h1>

            <p className="text-xs text-slate-600 mb-6 leading-relaxed max-w-md mx-auto">
              {t('farmerAuth.successMessage')}
            </p>

            {/* Generated Unique Farmer ID Display Card */}
            <div className="p-5 rounded-2xl bg-slate-900 text-white shadow-md mb-6 relative border border-slate-800">
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-widest block mb-1">
                {t('farmerAuth.yourFarmerId')}
              </span>
              <span className="text-2xl sm:text-3xl font-black font-mono tracking-wider block text-white select-all my-1">
                {registeredData.farmerId}
              </span>
              <span className="text-[11px] text-slate-400 block mb-3">
                {registeredData.name} • {registeredData.phone}
              </span>

              {/* Copy Button */}
              <button
                type="button"
                onClick={handleCopyFarmerId}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{t('farmerAuth.copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>{t('farmerAuth.copyId')}</span>
                  </>
                )}
              </button>
            </div>

            {/* Crucial Instructions */}
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs text-left mb-6 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-amber-950 mb-0.5">
                  महत्त्वाचे / Important
                </span>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  {t('farmerAuth.saveIdNotice')}
                </p>
              </div>
            </div>

            {/* Proceed to Sign In Button */}
            <Button
              variant="primary"
              size="lg"
              onClick={() =>
                navigate('/customer/login', {
                  state: { registeredFarmerId: registeredData.farmerId },
                })
              }
              className="w-full text-sm font-semibold"
            >
              {t('farmerAuth.proceedToLogin')}
            </Button>
          </Card>
        </div>
      </PageContainer>
    );
  }

  // REGISTRATION FORM
  return (
    <PageContainer className="flex items-center justify-center py-8 sm:py-12">
      <div className="w-full max-w-xl">
        {/* Back Link */}
        <button
          type="button"
          onClick={() => navigate('/customer/login')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 mb-6 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('farmerAuth.alreadyHaveAccount')}</span>
        </button>

        <Card className="border-2 border-slate-300 shadow-sm p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#166534] text-white flex items-center justify-center shadow-xs">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <Badge variant="primary" size="sm" className="mb-1">
                {t('farmerAuth.badge')}
              </Badge>
              <h1 className="text-xl font-bold text-slate-900">
                {t('farmerAuth.registerTitle')}
              </h1>
            </div>
          </div>

          <p className="text-xs text-slate-600 mb-6 leading-relaxed">
            {t('farmerAuth.registerSubtitle')}
          </p>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-6 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Section 1: Personal Details */}
            <div className="space-y-4">
              <h2 className="text-xs uppercase font-bold text-slate-500 tracking-wider border-b border-slate-100 pb-1">
                १. वैयक्तिक माहिती / Personal Details
              </h2>

              {/* Full Name */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  {t('farmerAuth.fullName')} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    placeholder={t('farmerAuth.fullNamePlaceholder')}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent"
                  />
                </div>
              </div>

              {/* Phone & Email Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Mobile Number */}
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    {t('farmerAuth.mobileNumber')} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      required
                      maxLength={10}
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder={t('farmerAuth.mobilePlaceholder')}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent font-mono"
                    />
                  </div>
                </div>

                {/* Optional Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    {t('farmerAuth.emailAddress')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder={t('farmerAuth.emailPlaceholder')}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Age and Gender Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Age */}
                <div>
                  <label
                    htmlFor="age"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    {t('farmerAuth.age')}
                  </label>
                  <input
                    id="age"
                    name="age"
                    type="number"
                    min={18}
                    max={120}
                    value={formData.age}
                    onChange={handleChange}
                    placeholder={t('farmerAuth.agePlaceholder')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label
                    htmlFor="gender"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    {t('farmerAuth.gender')}
                  </label>
                  <select
                    id="gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent bg-white"
                  >
                    <option value="">-- {t('farmerAuth.selectGender')} --</option>
                    <option value="MALE">{t('farmerAuth.male')}</option>
                    <option value="FEMALE">{t('farmerAuth.female')}</option>
                    <option value="OTHER">{t('farmerAuth.other')}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Address & Location */}
            <div className="space-y-4 pt-3">
              <h2 className="text-xs uppercase font-bold text-slate-500 tracking-wider border-b border-slate-100 pb-1">
                २. पत्ता व गाव / Address Details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Village */}
                <div>
                  <label
                    htmlFor="village"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    {t('farmerAuth.village')} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="village"
                    name="village"
                    type="text"
                    required
                    value={formData.village}
                    onChange={handleChange}
                    placeholder={t('farmerAuth.villagePlaceholder')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent"
                  />
                </div>

                {/* Taluka */}
                <div>
                  <label
                    htmlFor="taluka"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    {t('farmerAuth.taluka')} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="taluka"
                    name="taluka"
                    type="text"
                    required
                    value={formData.taluka}
                    onChange={handleChange}
                    placeholder={t('farmerAuth.talukaPlaceholder')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent"
                  />
                </div>

                {/* District */}
                <div>
                  <label
                    htmlFor="district"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    {t('farmerAuth.district')} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="district"
                    name="district"
                    type="text"
                    required
                    value={formData.district}
                    onChange={handleChange}
                    placeholder={t('farmerAuth.districtPlaceholder')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent"
                  />
                </div>
              </div>

              {/* State & Preferred Language Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* State */}
                <div>
                  <label
                    htmlFor="state"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    {t('farmerAuth.state')}
                  </label>
                  <input
                    id="state"
                    name="state"
                    type="text"
                    value={formData.state}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent bg-slate-50"
                  />
                </div>

                {/* Preferred Language */}
                <div>
                  <label
                    htmlFor="preferredLanguage"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    {t('farmerAuth.preferredLanguage')}
                  </label>
                  <select
                    id="preferredLanguage"
                    name="preferredLanguage"
                    value={formData.preferredLanguage}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent bg-white"
                  >
                    <option value="mr">मराठी (Marathi)</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 3: Password & Security */}
            <div className="space-y-4 pt-3">
              <h2 className="text-xs uppercase font-bold text-slate-500 tracking-wider border-b border-slate-100 pb-1">
                ३. पासवर्ड व सुरक्षा / Security Password
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Password Field */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    {t('farmerAuth.password')} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.password}
                      onChange={handleChange}
                      placeholder={t('farmerAuth.passwordPlaceholder')}
                      className="w-full pl-9 pr-10 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    {t('farmerAuth.confirmPassword')} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder={t('farmerAuth.confirmPasswordPlaceholder')}
                      className="w-full pl-9 pr-10 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Password Requirement Checklist */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-1">
                <span className="font-semibold text-slate-700 block mb-1">
                  पासवर्ड आवश्यकता / Password Strength:
                </span>
                <div className="grid grid-cols-2 gap-1 text-slate-600">
                  <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-700 font-semibold' : ''}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    <span>किमान ८ अक्षरे / Min 8 characters</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-emerald-700 font-semibold' : ''}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    <span>किमान १ मोठे अक्षर / 1 uppercase (A-Z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasLowercase ? 'text-emerald-700 font-semibold' : ''}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    <span>किमान १ लहान अक्षर / 1 lowercase (a-z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-700 font-semibold' : ''}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    <span>किमान १ अंक / 1 number (0-9)</span>
                  </div>
                </div>
                {formData.confirmPassword && (
                  <p className={`mt-1 font-semibold ${passwordsMatch ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {passwordsMatch ? `✓ ${t('farmerAuth.passwordsMatch')}` : `✕ ${t('farmerAuth.passwordsMismatch')}`}
                  </p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isSubmitting}
              className="w-full mt-4"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('farmerAuth.registering')}
                </span>
              ) : (
                t('farmerAuth.registerButton')
              )}
            </Button>
          </form>

          {/* Login navigation link */}
          <div className="mt-6 pt-4 border-t border-slate-200 text-center">
            <Link
              to="/customer/login"
              className="text-xs font-semibold text-[#166534] hover:underline"
            >
              {t('farmerAuth.alreadyHaveAccount')}
            </Link>
          </div>

          {/* Privacy Note */}
          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>{t('farmerAuth.privacyNotice')}</span>
            </p>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
