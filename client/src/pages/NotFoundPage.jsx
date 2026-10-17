import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Home } from 'lucide-react';
import PageContainer from '../components/layout/PageContainer';
import Card from '../components/common/Card';
import Button from '../components/common/Button';

export default function NotFoundPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <PageContainer className="flex items-center justify-center py-16">
      <div className="w-full max-w-md text-center">
        <Card className="p-8">
          <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>

          <span className="text-3xl font-extrabold text-slate-800 font-mono block mb-1">
            404
          </span>
          <h1 className="text-lg font-bold text-slate-900 mb-2">
            {t('notFound.title')}
          </h1>
          <p className="text-xs text-slate-600 mb-6 leading-relaxed">
            {t('notFound.description')}
          </p>

          <Button
            variant="primary"
            size="md"
            icon={Home}
            onClick={() => navigate('/')}
            className="w-full"
          >
            {t('notFound.button')}
          </Button>
        </Card>
      </div>
    </PageContainer>
  );
}
