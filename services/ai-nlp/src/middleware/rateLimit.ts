import { Request, Response, NextFunction } from 'express';

type Bucket = {
  count: number;
  expiresAt: number;
};

const WINDOW_MS = Number(process.env.AI_RATE_LIMIT_WINDOW_MS || 60_000);
const MAX_REQUESTS = Number(process.env.AI_RATE_LIMIT_MAX_REQUESTS || 120);
const buckets = new Map<string, Bucket>();

function getClientKey(req: Request): string {
  const headerUser = req.headers['x-user-id'];
  if (typeof headerUser === 'string' && headerUser.trim().length > 0) {
    return `user:${headerUser.trim()}`;
  }
  return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
}

export function aiRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const key = getClientKey(req);
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.expiresAt) {
    buckets.set(key, { count: 1, expiresAt: now + WINDOW_MS });
    next();
    return;
  }

  if (bucket.count >= MAX_REQUESTS) {
    res.setHeader('Retry-After', String(Math.ceil((bucket.expiresAt - now) / 1000)));
    res.status(429).json({ error: 'Too many requests, please retry later' });
    return;
  }

  bucket.count += 1;
  next();
}
