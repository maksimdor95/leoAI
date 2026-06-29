const STORAGE_KEY = 'leo_pending_auth_redirect';

export type PendingAuthRedirect = {
  href: string;
  scenarioId?: string;
};

export function setPendingAuthRedirect(redirect: PendingAuthRedirect): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(redirect));
  } catch {
    // ignore quota / private mode
  }
}

export function consumePendingAuthRedirect(): PendingAuthRedirect | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    const parsed = JSON.parse(raw) as PendingAuthRedirect;
    if (typeof parsed.href === 'string' && parsed.href.startsWith('/')) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function resolvePostAuthHref(fallback = '/chat?new=true'): string {
  return consumePendingAuthRedirect()?.href ?? fallback;
}
