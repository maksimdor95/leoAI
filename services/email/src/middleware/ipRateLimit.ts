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

/** Public consultation form: 5 submissions per minute per IP */
export const consultationRateLimit = createIpRateLimit(60_000, 5);
