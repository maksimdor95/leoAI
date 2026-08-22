import posthog from 'posthog-js';
import {
  captureYandexMetrikaHit,
  isYandexMetrikaEnabled,
  markLandingViewedSent,
  reachYandexMetrikaGoal,
  resetLandingViewedTracking,
  wasLandingViewedTracked,
} from '@/lib/yandexMetrika';

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

function registerRuntimeSuperProperties(): void {
  if (typeof window === 'undefined') return;
  const hostname = window.location.hostname;
  const isInternal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local');
  posthog.register({
    app_env: process.env.NODE_ENV ?? 'production',
    is_internal: isInternal,
  });
}

export function initPostHog(): void {
  if (!isEnabled() || initialized) return;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: normalizePostHogHost(process.env.NEXT_PUBLIC_POSTHOG_HOST),
    person_profiles: 'always',
    capture_pageview: false,
    capture_pageleave: true,
  });
  registerRuntimeSuperProperties();
  initialized = true;
}

export function identifyFromToken(token: string): void {
  if (!isEnabled()) return;
  initPostHog();
  const userId = getUserIdFromToken(token);
  if (userId) posthog.identify(userId);
}

export function identifyFromUserId(userId: string): void {
  if (!isEnabled() || !userId) return;
  initPostHog();
  posthog.identify(userId);
}

export function resetAnalyticsUser(): void {
  if (!isEnabled()) return;
  posthog.reset();
}

export function captureEvent(name: string, properties?: Record<string, unknown>): void {
  if (isEnabled()) {
    initPostHog();
    posthog.capture(name, properties);
  }
  // Same event name → Metrika JavaScript goal (for funnel reports).
  if (isYandexMetrikaEnabled()) {
    reachYandexMetrikaGoal(name, properties);
  }
}

/**
 * Funnel step 1: home visit. Deduped so Hero + router both can call safely.
 * Call before CTA so Metrika sequential funnel never sees CTA without landing.
 */
export function trackLandingViewed(properties?: Record<string, unknown>): void {
  if (!markLandingViewedSent()) return;
  captureEvent('landing_viewed', properties);
}

/** Ensure step 1 exists before CTA (covers race where click beats useEffect). */
export function ensureLandingViewed(properties?: Record<string, unknown>): void {
  if (wasLandingViewedTracked()) return;
  trackLandingViewed(properties);
}

export function capturePageView(path: string): void {
  const normalized = path.split('?')[0] || '/';
  if (normalized !== '/') {
    resetLandingViewedTracking();
  }

  if (isEnabled()) {
    initPostHog();
    posthog.capture('$pageview', {
      $current_url: `${window.location.origin}${path}`,
    });
  }
  if (isYandexMetrikaEnabled()) {
    captureYandexMetrikaHit(path);
  }

  // Backup for funnel step 1 — even if HeroSection effect is late/missed.
  if (normalized === '/') {
    trackLandingViewed({ source: 'pageview', path });
  }
}

export { posthog };
