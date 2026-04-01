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
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}
