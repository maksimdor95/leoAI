'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { capturePageView, initPostHog, identifyFromToken, posthog } from '@/lib/analytics';
import { getToken } from '@/lib/auth';

function PostHogPageView(): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    capturePageView(pathname + (qs ? `?${qs}` : ''));
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const enabled = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);

  useEffect(() => {
    if (!enabled) return;
    initPostHog();
    const token = getToken();
    if (token) identifyFromToken(token);
  }, [enabled]);

  if (!enabled) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}
