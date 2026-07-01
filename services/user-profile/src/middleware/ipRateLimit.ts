import { Request, Response, NextFunction } from 'express';

type Bucket = { count: number; expiresAt: number };
const buckets = new Map<string, Bucket>();

function clientKey(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function createIpRateLimit(windowMs: number, maxRequests: number) {
  return function ipRateLimit(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    const key = clientKey(req);
    const bucket = buckets.get(key);

    if (!bucket || now > bucket.expiresAt) {
      buckets.set(key, { count: 1, expiresAt: now + windowMs });
      next();
      return;
    }

    if (bucket.count >= maxRequests) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.expiresAt - now) / 1000)));
      res.status(429).json({ error: 'Too many requests, please retry later' });
      return;
    }

    bucket.count += 1;
    next();
  };
}

/** Login / register: 10 attempts per minute per IP */
export const authRateLimit = createIpRateLimit(60_000, 10);

/** Forgot password / reset validate: 5 per minute per IP */
export const passwordResetRateLimit = createIpRateLimit(60_000, 5);
