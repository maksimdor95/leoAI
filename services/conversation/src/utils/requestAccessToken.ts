import { Request } from 'express';

function extractBearerToken(
  headerValue: string | string[] | undefined
): string | undefined {
  if (!headerValue) return undefined;
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!value) return undefined;
  const trimmed = value.startsWith('Bearer ') ? value.substring(7) : value;
  return trimmed.trim() || undefined;
}

function extractCookieToken(cookieHeader: string | undefined, cookieName: string): string | undefined {
  if (!cookieHeader) return undefined;
  const part = cookieHeader
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${cookieName}=`));
  if (!part) return undefined;
  const raw = part.substring(cookieName.length + 1);
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Bearer from headers or httpOnly cookie — for downstream service calls after cookie-auth. */
export function extractRequestAccessToken(req: Request): string | undefined {
  const rawAuthHeader = req.headers['x-auth-token'] || req.headers.authorization;
  const headerToken = extractBearerToken(rawAuthHeader);
  const cookieToken = extractCookieToken(req.headers.cookie, 'leo_access_token');
  return headerToken || cookieToken || undefined;
}
