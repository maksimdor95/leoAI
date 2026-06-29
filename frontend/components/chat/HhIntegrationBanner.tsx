'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Spin } from 'antd';
import {
  beginHhIntegrationConnect,
  fetchHhIntegrationStatus,
  revokeHhIntegration,
} from '@/lib/hhIntegrationApi';
import type { HhIntegrationStatus } from '@/types/hhIntegration';

type HhIntegrationBannerProps = {
  refreshKey?: number;
};

const secondaryBtnClass =
  '!h-8 !rounded-lg !border !border-white/15 !bg-white/[0.05] !text-slate-200 hover:!border-white/25 hover:!bg-white/10 hover:!text-white !shadow-none !text-xs';

export function HhIntegrationBanner({ refreshKey = 0 }: HhIntegrationBannerProps) {
  const [status, setStatus] = useState<HhIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchHhIntegrationStatus({ lite: true });
      setStatus(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось проверить HeadHunter');
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus, refreshKey]);

  useEffect(() => {
    const resetActionLoading = () => setActionLoading(false);
    window.addEventListener('pageshow', resetActionLoading);
    return () => window.removeEventListener('pageshow', resetActionLoading);
  }, []);

  const handleConnect = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await beginHhIntegrationConnect('/chat');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось подключить HeadHunter');
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await revokeHhIntegration();
      await loadStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось отключить HeadHunter');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-400">
        <Spin size="small" />
        Проверяем HeadHunter…
      </div>
    );
  }

  if (status?.connected) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400/90">
              HeadHunter подключён
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {typeof status.resumesCount === 'number'
                ? `Резюме на HH: ${status.resumesCount}. `
                : null}
              Скоро можно будет откликаться прямо из LEO.
            </p>
          </div>
          <Button
            size="small"
            loading={actionLoading}
            onClick={() => void handleDisconnect()}
            className={secondaryBtnClass}
          >
            Отключить
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3 space-y-2">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-300/90">
          Подключите HeadHunter
        </div>
        <p className="mt-1 text-xs text-slate-400 leading-relaxed">
          Чтобы в следующем шаге откликаться из LEO без копирования письма, привяжите аккаунт hh.ru.
        </p>
      </div>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      {status?.expired ? (
        <p className="text-xs text-amber-300">Сессия HH истекла — подключите снова.</p>
      ) : null}
      <Button
        type="primary"
        size="small"
        loading={actionLoading}
        onClick={() => void handleConnect()}
        className="!bg-emerald-600 !border-emerald-600 hover:!bg-emerald-500"
      >
        Подключить HeadHunter
      </Button>
    </div>
  );
}
