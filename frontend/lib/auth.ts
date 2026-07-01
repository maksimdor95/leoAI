/**
 * Authentication Utilities
 * Session is carried via httpOnly cookie (leo_access_token) + leo_auth flag cookie.
 */

import { getPublicApiBaseUrl } from '@/lib/publicApiBaseUrl';

export type UserProfileSummary = {
  id?: string;
};

let cachedUserId: string | null = null;
let profileRequest: Promise<UserProfileSummary | null> | null = null;

function profileApiUrl(): string {
  return `${getPublicApiBaseUrl()}/api/users/profile`;
}

async function loadUserProfile(): Promise<UserProfileSummary | null> {
  try {
    const res = await fetch(profileApiUrl(), { credentials: 'include' });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        clearClientAuthState();
      }
      return null;
    }
    return (await res.json()) as UserProfileSummary;
  } catch {
    return null;
  }
}

/** Single in-flight profile request — avoids duplicate calls on landing refresh. */
export async function fetchUserProfile(): Promise<UserProfileSummary | null> {
  if (!isAuthenticated()) return null;
  if (cachedUserId) return { id: cachedUserId };
  if (!profileRequest) {
    profileRequest = loadUserProfile().finally(() => {
      profileRequest = null;
    });
  }
  const profile = await profileRequest;
  if (profile?.id) cachedUserId = profile.id;
  return profile;
}

/**
 * @deprecated Token is no longer stored in localStorage. Kept for OAuth/analytics handoff only.
 */
export function saveToken(token: string): void {
  if (typeof window !== 'undefined') {
    void import('./analytics').then(({ identifyFromToken }) => identifyFromToken(token));
  }
}

/**
 * JWT is in httpOnly cookie — not readable from JS. Use isAuthenticated() or credentials: 'include'.
 */
export function getToken(): string | null {
  return null;
}

/**
 * @deprecated Use clearClientAuthState
 */
export function removeToken(): void {
  // no-op: token lives in httpOnly cookie only
}

/**
 * Clear client-visible auth state (logout also clears httpOnly cookie server-side).
 */
export function clearClientAuthState(): void {
  cachedUserId = null;
  profileRequest = null;
  if (typeof document !== 'undefined') {
    document.cookie = 'leo_auth=; Max-Age=0; path=/; SameSite=Lax';
    document.cookie = 'leo_access_token=; Max-Age=0; path=/; SameSite=Lax';
  }
  void import('./analytics').then(({ resetAnalyticsUser }) => resetAnalyticsUser());
}

/**
 * Check if user is authenticated (non-httpOnly session flag set by backend).
 */
export function isAuthenticated(): boolean {
  if (typeof document !== 'undefined') {
    return document.cookie
      .split(';')
      .map((part) => part.trim())
      .some((part) => part === 'leo_auth=1');
  }
  return false;
}

export async function getAuthenticatedUserId(): Promise<string | null> {
  const profile = await fetchUserProfile();
  return profile?.id ?? null;
}

/**
 * After login/register — refresh PostHog identity from profile API (cookie auth).
 */
export async function syncAnalyticsIdentity(): Promise<void> {
  if (typeof window === 'undefined' || !isAuthenticated()) return;
  try {
    const { identifyFromUserId } = await import('./analytics');
    const profile = await fetchUserProfile();
    if (profile?.id) identifyFromUserId(profile.id);
  } catch {
    // analytics is best-effort
  }
}
