/**
 * Yandex Metrika: page hits + JavaScript goals for marketing funnels.
 * Goals use the same names as PostHog events (via captureEvent).
 * Counter bootstrap lives in YandexMetrikaScript; this module only sends hits/goals.
 */

declare global {
  interface Window {
    ym?: (counterId: number, method: string, ...args: unknown[]) => void;
  }
}

type PendingHit = { kind: 'hit'; path: string };
type PendingGoal = { kind: 'goal'; name: string; params?: Record<string, unknown> };
type Pending = PendingHit | PendingGoal;

const pending: Pending[] = [];
let flushTimersStarted = false;

/** Once per browser tab session — enough for Metrika (goal once/visit) + avoids PostHog dupes. */
let landingViewedSent = false;

export function getYandexMetrikaId(): number | null {
  const raw = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID?.trim();
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/** Skip localhost noise unless explicitly debugging Metrika. */
export function isYandexMetrikaEnabled(): boolean {
  if (!isBrowser() || !getYandexMetrikaId()) return false;
  const hostname = window.location.hostname;
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local');
  if (isLocal && process.env.NEXT_PUBLIC_YANDEX_METRIKA_DEBUG !== 'true') {
    return false;
  }
  return true;
}

/**
 * Recommended JavaScript goals to create in Metrika UI (identifier = event name).
 * Primary acquisition → Jack vacancies funnel order below.
 */
export const YANDEX_METRIKA_FUNNEL_GOALS = [
  'landing_viewed',
  'landing_cta_clicked',
  'auth_modal_opened',
  'user_registered',
  'user_logged_in',
  'chat_product_selection_viewed',
  'chat_product_selected',
  'chat_session_started',
  'chat_first_user_message',
  'vacancies_panel_opened',
  'vacancies_shown',
  'vacancy_opened',
  'vacancy_apply_clicked',
  'vacancy_prep_started',
  'insight_opened',
  'insight_skills_added',
  'insight_course_clicked',
  'report_downloaded',
] as const;

function sendHit(id: number, path: string): void {
  const url = `${window.location.origin}${path}`;
  window.ym?.(id, 'hit', url, { title: document.title, referer: document.referrer });
}

function sendGoal(id: number, name: string): void {
  // Identifier only — PostHog keeps event properties; Metrika funnel matches JS-goal id.
  window.ym?.(id, 'reachGoal', name);
}

function scheduleFlushRetries(): void {
  if (!isBrowser() || flushTimersStarted) return;
  flushTimersStarted = true;
  const delays = [0, 100, 500, 1500, 4000];
  for (const ms of delays) {
    window.setTimeout(() => flushYandexMetrikaQueue(), ms);
  }
}

/** Flush queued hits/goals after tag.js + ym stub are ready. */
export function flushYandexMetrikaQueue(): void {
  const id = getYandexMetrikaId();
  if (!id || typeof window.ym !== 'function') return;
  while (pending.length > 0) {
    const item = pending.shift()!;
    if (item.kind === 'hit') sendHit(id, item.path);
    else sendGoal(id, item.name);
  }
}

export function captureYandexMetrikaHit(path: string): void {
  const id = getYandexMetrikaId();
  if (!isYandexMetrikaEnabled() || !id) return;
  if (typeof window.ym !== 'function') {
    pending.push({ kind: 'hit', path });
    scheduleFlushRetries();
    return;
  }
  sendHit(id, path);
}

export function reachYandexMetrikaGoal(
  name: string,
  params?: Record<string, unknown>
): void {
  const id = getYandexMetrikaId();
  if (!isYandexMetrikaEnabled() || !id || !name) return;
  if (typeof window.ym !== 'function') {
    pending.push({ kind: 'goal', name, params });
    scheduleFlushRetries();
    return;
  }
  sendGoal(id, name);
}

export function wasLandingViewedTracked(): boolean {
  return landingViewedSent;
}

/** Reset when leaving home so a later SPA return can count again in PostHog. */
export function resetLandingViewedTracking(): void {
  landingViewedSent = false;
}

/**
 * Mark home visit for funnel step 1. Deduped per tab until reset.
 * Returns true if this call actually sent the event.
 */
export function markLandingViewedSent(): boolean {
  if (landingViewedSent) return false;
  landingViewedSent = true;
  return true;
}
