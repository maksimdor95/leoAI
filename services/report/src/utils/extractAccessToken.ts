import { Request } from 'express';

export function extractCookieToken(cookieHeader: string | undefined, cookieName: string): string | null {
  if (!cookieHeader) return null;
  const part = cookieHeader
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${cookieName}=`));
  if (!part) return null;
  const raw = part.substring(cookieName.length + 1);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function extractAccessToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  const xAuth = req.headers['x-auth-token'];
  if (typeof xAuth === 'string' && xAuth.startsWith('Bearer ')) {
    return xAuth.slice(7);
  }
  if (typeof xAuth === 'string' && xAuth.trim()) {
    return xAuth.trim();
  }
  return extractCookieToken(req.headers.cookie, 'leo_access_token');
}
