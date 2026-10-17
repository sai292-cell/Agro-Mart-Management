import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Shield,
  UserCheck,
  ArrowRight,
  Receipt,
  AlertTriangle,
  BookOpen,
  Languages,
  CheckCircle,
  Sprout,
  Store,
} from 'lucide-react';
import PageContainer from '../components/layout/PageContainer';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <PageContainer className="py-6 sm:py-10">
      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#166534] text-xs font-semibold mb-4">
          <Sprout className="w-4 h-4" />
          <span>{t('brand.badge')}</span>
          <span className="text-emerald-300">•</span>
          <span>{t('brand.location')}</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
          {t('landing.heroTitle')}
        </h1>

        <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed">
          {t('landing.heroSubtitle')}
        </p>
      </div>

      {/* Two Visually Distinct Portal Cards */}
      <div className="max-w-5xl mx-auto mb-14">
        <div className="text-center mb-6">
          <h2 className="text-sm uppercase tracking-wider font-bold text-slate-500">
            {t('landing.selectPortal')}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {/* Card 1: Shop Owner & Staff Portal */}
          <Card
            hoverEffect
            className="flex flex-col justify-between border-2 border-emerald-700/20 bg-gradient-to-b from-white to-emerald-50/20 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100/40 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />

            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <Badge variant="primary" icon={Shield}>
                  {t('portals.owner.badge')}
                </Badge>
                <span className="text-xs font-mono text-slate-400">PORTAL 01</span>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-[#166534] text-white flex items-center justify-center shadow-xs">
                  <Store className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {t('portals.owner.title')}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {t('portals.owner.subtitle')}
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                {t('portals.owner.description')}
              </p>

              {/* Feature Highlights */}
              <div className="space-y-2 mb-6 pt-4 border-t border-slate-100">
                {t('portals.owner.features', { returnObjects: true }).map((feat, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs text-slate-700">
                    <CheckCircle className="w-4 h-4 text-[#166534] shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              icon={ArrowRight}
              iconPosition="right"
              onClick={() => navigate('/owner/login')}
              className="w-full justify-between"
            >
              <span>{t('portals.owner.button')}</span>
            </Button>
          </Card>

          {/* Card 2: Farmer / Customer Portal */}
          <Card
            hoverEffect
            className="flex flex-col justify-between border-2 border-slate-300/80 bg-gradient-to-b from-white to-slate-50 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-200/40 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />

            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <Badge variant="default" icon={UserCheck}>
                  {t('portals.customer.badge')}
                </Badge>
                <span className="text-xs font-mono text-slate-400">PORTAL 02</span>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-xs">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {t('portals.customer.title')}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {t('portals.customer.subtitle')}
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                {t('portals.customer.description')}
              </p>

              {/* Feature Highlights */}
              <div className="space-y-2 mb-6 pt-4 border-t border-slate-100">
                {t('portals.customer.features', { returnObjects: true }).map((feat, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs text-slate-700">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button
              variant="outline"
              size="lg"
              icon={ArrowRight}
              iconPosition="right"
              onClick={() => navigate('/customer/login')}
              className="w-full justify-between border-slate-400 hover:border-slate-600 hover:bg-slate-100"
            >
              <span>{t('portals.customer.button')}</span>
            </Button>
          </Card>
        </div>
      </div>

      {/* Trust & Architecture Badges */}
      <div className="max-w-5xl mx-auto pt-8 border-t border-slate-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
            <Receipt className="w-5 h-5 mx-auto text-[#166534] mb-2" />
            <span className="text-xs font-semibold text-slate-800 block">
              {t('landing.features.billing')}
            </span>
          </div>

          <div className="p-4 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
            <AlertTriangle className="w-5 h-5 mx-auto text-amber-600 mb-2" />
            <span className="text-xs font-semibold text-slate-800 block">
              {t('landing.features.inventory')}
            </span>
          </div>

          <div className="p-4 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
            <BookOpen className="w-5 h-5 mx-auto text-[#15803d] mb-2" />
            <span className="text-xs font-semibold text-slate-800 block">
              {t('landing.features.ledger')}
            </span>
          </div>

          <div className="p-4 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
            <Languages className="w-5 h-5 mx-auto text-sky-600 mb-2" />
            <span className="text-xs font-semibold text-slate-800 block">
              {t('landing.features.bilingual')}
            </span>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
