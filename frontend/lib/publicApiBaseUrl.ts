/**
 * Public API base URLs for browser calls.
 * On leo-ai.ru (and similar) the reverse proxy serves /api/* on the same host.
 * Local dev keeps direct service ports when hostname is localhost.
 */

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function envBaseUrl(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? normalizeBaseUrl(value) : undefined;
}

function browserOriginUnlessLocalhost(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const { hostname, origin } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return undefined;
  }
  return origin;
}

export function getPublicApiBaseUrl(): string {
  return (
    envBaseUrl('NEXT_PUBLIC_API_URL') ??
    browserOriginUnlessLocalhost() ??
    'http://localhost:3001'
  );
}

export function getPublicConversationBaseUrl(): string {
  return (
    envBaseUrl('NEXT_PUBLIC_CONVERSATION_API_URL') ??
    envBaseUrl('NEXT_PUBLIC_API_URL') ??
    browserOriginUnlessLocalhost() ??
    'http://localhost:3002'
  );
}

export function getPublicAiBaseUrl(): string {
  return (
    envBaseUrl('NEXT_PUBLIC_AI_SERVICE_URL') ??
    browserOriginUnlessLocalhost() ??
    'http://localhost:3003'
  );
}
