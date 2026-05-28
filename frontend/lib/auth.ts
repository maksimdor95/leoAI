/**
 * Authentication Utilities
 * Functions for managing authentication state
 */

/**
 * Save token to localStorage
 */
export function saveToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('token', token);
    void import('./analytics').then(({ identifyFromToken }) => identifyFromToken(token));
  }
}

/**
 * Get token from localStorage
 */
export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
}

/**
 * Remove token from localStorage
 */
export function removeToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
  }
}

/**
 * Clear all client-visible auth state.
 */
export function clearClientAuthState(): void {
  removeToken();
  if (typeof document !== 'undefined') {
    document.cookie = 'leo_auth=; Max-Age=0; path=/; SameSite=Lax';
  }
  void import('./analytics').then(({ resetAnalyticsUser }) => resetAnalyticsUser());
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  if (getToken() !== null) {
    return true;
  }
  if (typeof document !== 'undefined') {
    return document.cookie
      .split(';')
      .map((part) => part.trim())
      .some((part) => part === 'leo_auth=1');
  }
  return false;
}
