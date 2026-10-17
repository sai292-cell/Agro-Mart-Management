import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import ApiHealthBadge from '../common/ApiHealthBadge';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="bg-white border-t border-slate-200 mt-auto py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Copyright and Tagline */}
          <div className="text-center sm:text-left">
            <p className="text-xs font-semibold text-slate-800">
              {t('footer.copyright')}
            </p>
            <div className="flex items-center justify-center sm:justify-start gap-2 mt-1 text-[11px] text-slate-500">
              <span>{t('footer.tagline')}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-slate-600">
                <ShieldCheck className="w-3.5 h-3.5 text-[#166534]" />
                {t('footer.secureNote')}
              </span>
            </div>
          </div>

          {/* Backend Service Status Indicator */}
          <div className="flex items-center gap-3">
            <ApiHealthBadge />
          </div>
        </div>
      </div>
    </footer>
  );
}
