import posthog from 'posthog-js';

let initialized = false;

export function getUserIdFromToken(token: string): string | null {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { userId?: string; id?: string };
    return payload.userId || payload.id || null;
  } catch {
    return null;
  }
}

function isEnabled(): boolean {
  return typeof window !== 'undefined' && Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

/** .env иногда склеивает строки без \\n — отрезаем хвост от следующей переменной. */
function normalizePostHogHost(raw: string | undefined): string {
  const fallback = 'https://eu.i.posthog.com';
  if (!raw?.trim()) return fallback;
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, '');
  const match = trimmed.match(/^https?:\/\/[a-z0-9.-]+/i);
  return match ? match[0].replace(/\/$/, '') : fallback;
}

export function initPostHog(): void {
  if (!isEnabled() || initialized) return;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: normalizePostHogHost(process.env.NEXT_PUBLIC_POSTHOG_HOST),
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
  });
  initialized = true;
}

export function identifyFromToken(token: string): void {
  if (!isEnabled()) return;
  initPostHog();
  const userId = getUserIdFromToken(token);
  if (userId) posthog.identify(userId);
}

export function resetAnalyticsUser(): void {
  if (!isEnabled()) return;
  posthog.reset();
}

export function captureEvent(name: string, properties?: Record<string, unknown>): void {
  if (!isEnabled()) return;
  initPostHog();
  posthog.capture(name, properties);
}

export function capturePageView(path: string): void {
  if (!isEnabled()) return;
  initPostHog();
  posthog.capture('$pageview', {
    $current_url: `${window.location.origin}${path}`,
  });
}

export { posthog };
