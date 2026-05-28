import { getUserIdFromToken } from '@/lib/analytics';
import { getToken } from '@/lib/auth';

const BOT_USERNAME = 'leoaisupportbot';

/** Telegram start payload: [A-Za-z0-9_-], max 64 chars */
function toStartPayload(siteUserId: string): string {
  const safe = siteUserId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 61);
  return safe ? `u_${safe}` : 'support_site';
}

export function buildTelegramSupportUrl(siteUserId?: string | null): string {
  const start = siteUserId ? toStartPayload(siteUserId) : 'support_site';
  return `https://t.me/${BOT_USERNAME}?start=${start}`;
}

/** Prefer logged-in user id for support deep link. */
export function getTelegramSupportUrl(): string {
  if (typeof window === 'undefined') {
    return buildTelegramSupportUrl();
  }
  const token = getToken();
  if (!token) return buildTelegramSupportUrl();
  return buildTelegramSupportUrl(getUserIdFromToken(token));
}
