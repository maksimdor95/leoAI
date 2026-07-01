/**
 * Authentication Utilities
 * Session is carried via httpOnly cookie (leo_access_token) + leo_auth flag cookie.
 */

let cachedUserId: string | null = null;

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
  if (!isAuthenticated()) return null;
  if (cachedUserId) return cachedUserId;
  try {
    const res = await fetch('/api/users/profile', { credentials: 'include' });
    if (!res.ok) return null;
    const profile = (await res.json()) as { id?: string };
    cachedUserId = profile.id ?? null;
    return cachedUserId;
  } catch {
    return null;
  }
}

/**
 * After login/register — refresh PostHog identity from profile API (cookie auth).
 */
export async function syncAnalyticsIdentity(): Promise<void> {
  if (typeof window === 'undefined' || !isAuthenticated()) return;
  try {
    const { identifyFromUserId } = await import('./analytics');
    const res = await fetch('/api/users/profile', { credentials: 'include' });
    if (!res.ok) return;
    const profile = (await res.json()) as { id?: string };
    if (profile.id) {
      cachedUserId = profile.id;
      identifyFromUserId(profile.id);
    }
  } catch {
    // analytics is best-effort
  }
}
