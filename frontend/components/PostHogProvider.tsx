'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { YandexMetrikaScript } from '@/components/YandexMetrikaScript';
import { capturePageView, initPostHog, posthog } from '@/lib/analytics';
import { isAuthenticated, syncAnalyticsIdentity } from '@/lib/auth';

function AnalyticsPageView(): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    capturePageView(pathname + (qs ? `?${qs}` : ''));
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const posthogEnabled = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
  const metrikaEnabled = Boolean(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID);
  const enabled = posthogEnabled || metrikaEnabled;

  useEffect(() => {
    if (!posthogEnabled) return;
    initPostHog();
    if (isAuthenticated()) {
      void syncAnalyticsIdentity();
    }
  }, [posthogEnabled]);

  if (!enabled) return <>{children}</>;

  const pageView = (
    <Suspense fallback={null}>
      <AnalyticsPageView />
    </Suspense>
  );

  return (
    <>
      <YandexMetrikaScript />
      {posthogEnabled ? (
        <PHProvider client={posthog}>
          {pageView}
          {children}
        </PHProvider>
      ) : (
        <>
          {pageView}
          {children}
        </>
      )}
    </>
  );
}
