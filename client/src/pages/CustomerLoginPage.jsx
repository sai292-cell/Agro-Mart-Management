import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  UserCheck,
  ArrowLeft,
  Smartphone,
  KeyRound,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import PageContainer from '../components/layout/PageContainer';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';

export default function CustomerLoginPage() {
  const { t } = useTranslation();
  const { customerRequestOtp, customerVerifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [devNotice, setDevNotice] = useState('');

  const from = location.state?.from?.pathname || '/customer/dashboard';

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!phone.trim() || phone.trim().length < 7) {
      setErrorMessage('Please enter a valid mobile number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await customerRequestOtp(phone.trim());
      setStep('otp');
      if (res.devNotice) {
        setDevNotice(res.devNotice);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Unable to send OTP. Please check the phone number.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!otp.trim() || otp.trim().length < 4) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);
    try {
      await customerVerifyOtp(phone.trim(), otp.trim());
      navigate(from, { replace: true });
    } catch (err) {
      setErrorMessage(
        err.details?.message || err.message || 'Invalid or expired OTP code.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer className="flex items-center justify-center py-10">
      <div className="w-full max-w-md">
        {/* Back Link */}
        <button
          type="button"
          onClick={() => (step === 'otp' ? setStep('phone') : navigate('/'))}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 mb-6 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>
            {step === 'otp' ? 'Change Phone Number' : 'Return to Portal Selection'}
          </span>
        </button>

        <Card className="border-2 border-slate-300 shadow-sm p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-xs">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <Badge variant="default" size="sm" className="mb-1">
                शेतकरी सेवा / Farmer Self-Service
              </Badge>
              <h1 className="text-xl font-bold text-slate-900">
                Farmer Portal Login
              </h1>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-6 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Development OTP Notice */}
          {devNotice && step === 'otp' && (
            <div className="mb-6 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#166534] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Developer Mode Active</span>
                <span>{devNotice}</span>
              </div>
            </div>
          )}

          {step === 'phone' ? (
            /* Step 1: Phone Request Form */
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label
                  htmlFor="phone"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Registered Mobile Number / मोबाईल क्रमांक
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <input
                    id="phone"
                    type="tel"
                    required
                    autoFocus
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9822012345"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Enter the mobile number provided during purchase at Shivshree Agro Mart.
                </p>
              </div>

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
                    Sending Code...
                  </span>
                ) : (
                  'Send Verification Code (OTP)'
                )}
              </Button>
            </form>
          ) : (
            /* Step 2: OTP Verification Form */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label
                  htmlFor="otp"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Enter 6-Digit OTP Code
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    id="otp"
                    type="text"
                    required
                    autoFocus
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent font-mono tracking-widest text-center"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 text-center">
                  Sent to <span className="font-mono font-semibold">{phone}</span>
                </p>
              </div>

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
                    Verifying Code...
                  </span>
                ) : (
                  'Verify & Access Portal'
                )}
              </Button>
            </form>
          )}

          {/* Privacy Note */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-500">
              Your information is sandboxed. You will only access your personal khata records and receipts.
            </p>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
