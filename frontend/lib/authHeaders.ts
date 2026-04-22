import { getToken } from './auth';

export function buildAuthHeaders(
  tokenOverride?: string | null,
  includeXAuthToken = false
): Record<string, string> {
  const token = tokenOverride ?? getToken();
  if (!token) {
    return {};
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (includeXAuthToken) {
    headers['X-Auth-Token'] = `Bearer ${token}`;
  }

  return headers;
}
