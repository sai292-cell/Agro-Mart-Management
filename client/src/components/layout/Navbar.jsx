import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sprout, Shield, User } from 'lucide-react';
import LanguageSwitcher from '../common/LanguageSwitcher';

export default function Navbar() {
  const { t } = useTranslation();
  const location = useLocation();

  const isCurrent = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo and Title */}
          <Link
            to="/"
            className="flex items-center gap-3 group focus:outline-none"
            aria-label="Shivshree Agro Mart Home"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#166534] to-[#15803d] flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
              <Sprout className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 group-hover:text-[#166534] transition-colors">
                  {t('brand.name')}
                </span>
                <span className="hidden sm:inline-block text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-[#166534] border border-emerald-200">
                  {t('brand.location')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden md:block">
                {t('brand.tagline')}
              </p>
            </div>
          </Link>

          {/* Navigation Links and Language Switcher */}
          <div className="flex items-center gap-2 sm:gap-4">
            <nav className="hidden sm:flex items-center gap-1.5">
              <Link
                to="/owner/login"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  isCurrent('/owner/login')
                    ? 'bg-emerald-50 text-[#166534] font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>{t('nav.ownerPortal')}</span>
              </Link>

              <Link
                to="/customer/login"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  isCurrent('/customer/login')
                    ? 'bg-emerald-50 text-[#166534] font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>{t('nav.customerPortal')}</span>
              </Link>
            </nav>

            <div className="h-6 w-px bg-slate-200 hidden sm:block" />

            {/* Language Switcher */}
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}
