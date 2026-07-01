import { fetchUserProfile, isAuthenticated } from '@/lib/auth';

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
  if (typeof window === 'undefined' || !isAuthenticated()) {
    return buildTelegramSupportUrl();
  }
  return buildTelegramSupportUrl();
}

/** Resolve support URL with user id from profile API (cookie auth). */
export async function resolveTelegramSupportUrl(): Promise<string> {
  if (typeof window === 'undefined' || !isAuthenticated()) {
    return buildTelegramSupportUrl();
  }
  const profile = await fetchUserProfile();
  return buildTelegramSupportUrl(profile?.id);
}
