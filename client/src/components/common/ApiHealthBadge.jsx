import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { checkApiHealth } from '../../services/api';

/**
 * Real API health badge indicating actual backend connectivity state
 */
export default function ApiHealthBadge({ className = '' }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState('checking'); // 'checking' | 'reachable' | 'unavailable'
  const [latency, setLatency] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const performCheck = async () => {
    setIsRefreshing(true);
    const result = await checkApiHealth();
    setIsRefreshing(false);

    if (result.ok) {
      setStatus('reachable');
      setLatency(result.latencyMs);
      setErrorMessage('');
    } else {
      setStatus('unavailable');
      setLatency(null);
      setErrorMessage(result.error || 'Connection failed');
    }
  };

  useEffect(() => {
    performCheck();
    // Re-check periodically every 30 seconds
    const interval = setInterval(performCheck, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
        status === 'reachable'
          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
          : status === 'unavailable'
          ? 'bg-amber-50/90 border-amber-200 text-amber-900'
          : 'bg-slate-50 border-slate-200 text-slate-700'
      } ${className}`}
    >
      <div className="flex items-center gap-1.5">
        {status === 'checking' && (
          <Activity className="w-3.5 h-3.5 text-slate-400 animate-pulse" />
        )}
        {status === 'reachable' && (
          <CheckCircle2 className="w-3.5 h-3.5 text-[#166534]" />
        )}
        {status === 'unavailable' && (
          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
        )}

        <span>
          {status === 'checking' && t('api.checking')}
          {status === 'reachable' && `${t('api.operational')} (${latency}ms)`}
          {status === 'unavailable' && `${t('api.offline')}`}
        </span>
      </div>

      <button
        type="button"
        onClick={performCheck}
        disabled={isRefreshing}
        title={errorMessage || t('api.retry')}
        className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 cursor-pointer disabled:opacity-50 transition-colors"
        aria-label={t('api.retry')}
      >
        <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}
