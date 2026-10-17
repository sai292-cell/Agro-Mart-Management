import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserCheck, ArrowLeft, Smartphone, Calendar, CheckCircle } from 'lucide-react';
import PageContainer from '../components/layout/PageContainer';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';

export default function CustomerLoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <PageContainer className="flex items-center justify-center py-12">
      <div className="w-full max-w-lg">
        {/* Back Link */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 mb-6 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('placeholder.customerLogin.backButton')}</span>
        </button>

        <Card className="border-2 border-slate-300 shadow-sm">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-xs">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <Badge variant="default" size="sm" className="mb-1">
                {t('placeholder.customerLogin.badge')}
              </Badge>
              <h1 className="text-xl font-bold text-slate-900">
                {t('placeholder.customerLogin.title')}
              </h1>
            </div>
          </div>

          {/* Development Status Notice */}
          <div className="p-4 rounded-lg bg-slate-100/80 border border-slate-200 text-slate-900 mb-6">
            <div className="flex items-start gap-2.5">
              <Smartphone className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  {t('placeholder.customerLogin.notice')}
                </p>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {t('placeholder.customerLogin.description')}
                </p>
              </div>
            </div>
          </div>

          {/* Planned Features in Milestone 4 */}
          <div className="space-y-3 mb-8 pt-2">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('placeholder.customerLogin.plannedFeaturesTitle')}</span>
            </h2>
            <div className="space-y-2">
              {t('placeholder.customerLogin.plannedItems', { returnObjects: true }).map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
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
            {t('placeholder.customerLogin.backButton')}
          </Button>
        </Card>
      </div>
    </PageContainer>
  );
}
