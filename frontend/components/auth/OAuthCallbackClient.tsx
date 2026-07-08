'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from 'antd';
import { CheckCircleFilled, LoadingOutlined } from '@ant-design/icons';
import { syncAnalyticsIdentity } from '@/lib/auth';
import { captureEvent } from '@/lib/analytics';
import { resolvePostAuthHref } from '@/lib/pendingAuthRedirect';
import { useHumeTheme } from '@/lib/useHumeTheme';

function FloatingDots() {
  const dots = [
    { left: '12%', top: '18%', delay: '0s', duration: '3.2s' },
    { left: '78%', top: '12%', delay: '0.4s', duration: '4s' },
    { left: '22%', top: '72%', delay: '0.8s', duration: '3.6s' },
    { left: '88%', top: '58%', delay: '0.2s', duration: '4.2s' },
    { left: '48%', top: '28%', delay: '1s', duration: '3.4s' },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {dots.map((pos, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-green-500/20 rounded-full animate-float"
          style={{
            left: pos.left,
            top: pos.top,
            animationDelay: pos.delay,
            animationDuration: pos.duration,
          }}
        />
      ))}
    </div>
  );
}

export function OAuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isHume = useHumeTheme();
  const success = searchParams.get('success') ?? undefined;
  const error = searchParams.get('error') ?? undefined;
  const kind = searchParams.get('kind') ?? undefined;
  const provider = searchParams.get('provider') ?? undefined;
  const returnTo = searchParams.get('returnTo') ?? undefined;
  const isSuccess = success === '1';
  const isHhIntegration = kind === 'integration' && provider === 'hh';

  useEffect(() => {
    if (!isSuccess) {
      return;
    }

    if (isHhIntegration) {
      const target = returnTo
        ? `${returnTo}${returnTo.includes('?') ? '&' : '?'}hhConnected=1`
        : '/chat?hhConnected=1';
      router.replace(target);
      return;
    }

    void syncAnalyticsIdentity();
    captureEvent('user_logged_in', { method: 'oauth', source: 'oauth_callback' });
    router.replace(resolvePostAuthHref());
  }, [isHhIntegration, isSuccess, returnTo, router]);

  return (
    <main
      className={`relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6 ${
        isHume
          ? 'bg-[var(--color-bone)] text-[var(--color-ink)]'
          : 'bg-[#050913] text-white'
      }`}
    >
      {!isHume ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-[#050913] via-[#0a1a2e] to-[#050913] opacity-90" />
          <FloatingDots />
        </>
      ) : null}

      <div className="relative z-10 w-full max-w-md">
        <p
          className={`text-center text-xs uppercase tracking-[0.2em] mb-6 ${
            isHume ? 'text-[var(--color-smoke)]' : 'text-slate-500'
          }`}
        >
          LEO AI
        </p>

        <div
          className={`rounded-3xl border px-8 py-10 shadow-2xl text-center ${
            isHume
              ? 'border-[rgba(34,34,34,0.08)] bg-[var(--color-paper)]'
              : 'border-white/10 bg-white/[0.04] backdrop-blur-md'
          }`}
        >
          {isSuccess ? (
            <>
              <CheckCircleFilled
                className={`text-5xl mb-5 ${isHume ? 'text-[var(--color-iris)]' : 'text-green-500'}`}
                aria-hidden
              />
              <h1
                className={`text-2xl md:text-3xl font-bold mb-3 leading-snug ${
                  isHume ? 'hume-heading !text-2xl md:!text-3xl' : 'text-white'
                }`}
              >
                {isHhIntegration ? 'HeadHunter подключён' : 'Авторизация успешно завершена'}
              </h1>
              <p className={`text-base mb-6 ${isHume ? 'text-[var(--color-smoke)]' : 'text-slate-300'}`}>
                {isHhIntegration ? 'Сейчас вернём вас в LEO.' : 'Сейчас откроем ваш чат с LEO.'}
              </p>
              <div
                className={`flex items-center justify-center gap-2 text-sm ${
                  isHume ? 'text-[var(--color-smoke)]' : 'text-slate-400'
                }`}
              >
                <LoadingOutlined className={isHume ? 'text-[var(--color-iris)]' : 'text-green-500'} spin />
                <span>Перенаправляем...</span>
              </div>
            </>
          ) : (
            <>
              <div
                className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10 text-xl font-bold text-red-400"
                aria-hidden
              >
                !
              </div>
              <h1
                className={`text-2xl md:text-3xl font-bold mb-3 leading-snug ${
                  isHume ? 'hume-heading !text-2xl md:!text-3xl' : 'text-white'
                }`}
              >
                Не удалось войти
              </h1>
              <p className={`text-sm mb-2 ${isHume ? 'text-[var(--color-smoke)]' : 'text-slate-400'}`}>
                Проверьте настройки OAuth или попробуйте снова.
              </p>
              <p className="text-red-400/90 text-sm mb-8 break-words">
                {error || 'OAuth завершился с ошибкой'}
              </p>
              <Button
                type="primary"
                size="large"
                block
                className={
                  isHume
                    ? 'hume-btn-pill !h-12 !w-full'
                    : '!h-12 !rounded-full !bg-green-500 !border-green-500 hover:!bg-green-400 !font-semibold'
                }
                onClick={() => router.replace('/')}
              >
                Вернуться на главную
              </Button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
