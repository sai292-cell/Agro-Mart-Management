import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shield, ArrowLeft, Lock, Calendar, CheckCircle } from 'lucide-react';
import PageContainer from '../components/layout/PageContainer';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';

export default function OwnerLoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <PageContainer className="flex items-center justify-center py-12">
      <div className="w-full max-w-lg">
        {/* Back Link */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-[#166534] mb-6 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('placeholder.ownerLogin.backButton')}</span>
        </button>

        <Card className="border-2 border-emerald-800/20 shadow-sm">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#166534] text-white flex items-center justify-center shadow-xs">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <Badge variant="primary" size="sm" className="mb-1">
                {t('placeholder.ownerLogin.badge')}
              </Badge>
              <h1 className="text-xl font-bold text-slate-900">
                {t('placeholder.ownerLogin.title')}
              </h1>
            </div>
          </div>

          {/* Development Status Notice */}
          <div className="p-4 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-950 mb-6">
            <div className="flex items-start gap-2.5">
              <Lock className="w-5 h-5 text-[#166534] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-[#166534] uppercase tracking-wide">
                  {t('placeholder.ownerLogin.notice')}
                </p>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {t('placeholder.ownerLogin.description')}
                </p>
              </div>
            </div>
          </div>

          {/* Planned Features in Milestone 4 */}
          <div className="space-y-3 mb-8 pt-2">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('placeholder.ownerLogin.plannedFeaturesTitle')}</span>
            </h2>
            <div className="space-y-2">
              {t('placeholder.ownerLogin.plannedItems', { returnObjects: true }).map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                  <CheckCircle className="w-4 h-4 text-[#166534] shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <Button
            variant="outline"
            size="md"
            icon={ArrowLeft}
            onClick={() => navigate('/')}
            className="w-full"
          >
            {t('placeholder.ownerLogin.backButton')}
          </Button>
        </Card>
      </div>
    </PageContainer>
  );
}
