import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

/**
 * Accessible Marathi/English Language Switcher
 */
export default function LanguageSwitcher({ className = '' }) {
  const { i18n } = useTranslation();
  const currentLang = i18n.language || 'mr';

  const toggleLanguage = (lang) => {
    i18n.changeLanguage(lang);
  };

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-slate-200 bg-white p-1 shadow-2xs ${className}`}
      role="group"
      aria-label="Language Selector"
    >
      <div className="flex items-center px-1.5 text-slate-400">
        <Globe className="w-4 h-4" />
      </div>
      <button
        type="button"
        onClick={() => toggleLanguage('mr')}
        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
          currentLang === 'mr'
            ? 'bg-[#166534] text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        }`}
        aria-pressed={currentLang === 'mr'}
      >
        मराठी
      </button>
      <button
        type="button"
        onClick={() => toggleLanguage('en')}
        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
          currentLang === 'en'
            ? 'bg-[#166534] text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        }`}
        aria-pressed={currentLang === 'en'}
      >
        English
      </button>
    </div>
  );
}
