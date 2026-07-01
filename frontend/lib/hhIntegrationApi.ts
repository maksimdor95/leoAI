import { isAuthenticated } from '@/lib/auth';
import { getPublicApiBaseUrl } from '@/lib/publicApiBaseUrl';
import type { HhIntegrationStatus } from '@/types/hhIntegration';

function usersBaseUrl(): string {
  return getPublicApiBaseUrl();
}

function authFetchInit(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  };
}

function requireAuthenticated(): void {
  if (!isAuthenticated()) {
    throw new Error('Нужна авторизация');
  }
}

async function parseJsonError(response: Response, fallback: string): Promise<never> {
  const data = await response.json().catch(() => ({}));
  throw new Error(typeof data?.error === 'string' ? data.error : fallback);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error: unknown) {
    if (
      error instanceof DOMException ||
      (error instanceof Error && error.name === 'AbortError')
    ) {
      throw new Error('Превышено время ожидания ответа сервера');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function fetchHhIntegrationStatus(options?: { lite?: boolean }): Promise<HhIntegrationStatus> {
  if (!isAuthenticated()) {
    return { connected: false };
  }

  const query = options?.lite ? '?lite=1' : '';
  const response = await fetchWithTimeout(
    `${usersBaseUrl()}/api/users/integrations/hh${query}`,
    authFetchInit(),
    12000
  );

  if (!response.ok) {
    await parseJsonError(response, 'Не удалось проверить подключение HeadHunter');
  }

  return response.json() as Promise<HhIntegrationStatus>;
}

export async function beginHhIntegrationConnect(returnTo?: string): Promise<void> {
  requireAuthenticated();

  const query = new URLSearchParams({ format: 'json' });
  if (returnTo) {
    query.set('returnTo', returnTo);
  }

  const response = await fetchWithTimeout(
    `${usersBaseUrl()}/api/users/oauth/hh/start?${query.toString()}`,
    authFetchInit(),
    15000
  );

  if (!response.ok) {
    await parseJsonError(response, 'Не удалось начать подключение HeadHunter');
  }

  const data = (await response.json()) as { authorizeUrl?: string };
  if (!data.authorizeUrl) {
    throw new Error('HeadHunter OAuth не настроен');
  }

  window.location.href = data.authorizeUrl;
}

export async function revokeHhIntegration(): Promise<void> {
  requireAuthenticated();

  const response = await fetch(
    `${usersBaseUrl()}/api/users/integrations/hh`,
    authFetchInit({ method: 'DELETE' })
  );

  if (!response.ok) {
    await parseJsonError(response, 'Не удалось отключить HeadHunter');
  }
}
