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
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local');
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

function toMetrikaParams(
  params?: Record<string, unknown>
): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function sendGoal(id: number, name: string, params?: Record<string, unknown>): void {
  const safe = toMetrikaParams(params);
  if (safe) {
    window.ym?.(id, 'reachGoal', name, safe);
  } else {
    window.ym?.(id, 'reachGoal', name);
  }
}

/** Flush queued hits/goals after tag.js + ym stub are ready. */
export function flushYandexMetrikaQueue(): void {
  const id = getYandexMetrikaId();
  if (!id || typeof window.ym !== 'function') return;
  while (pending.length > 0) {
    const item = pending.shift()!;
    if (item.kind === 'hit') sendHit(id, item.path);
    else sendGoal(id, item.name, item.params);
  }
}

export function captureYandexMetrikaHit(path: string): void {
  const id = getYandexMetrikaId();
  if (!isYandexMetrikaEnabled() || !id) return;
  if (typeof window.ym !== 'function') {
    pending.push({ kind: 'hit', path });
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
    return;
  }
  sendGoal(id, name, params);
}
