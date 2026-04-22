/**
 * Protects GET /api/jobs/catalog from public scraping.
 * - In production: JOB_CATALOG_TOKEN must be set; request must send the same via
 *   X-Job-Catalog-Token or Authorization: Bearer.
 * - In non-production: if JOB_CATALOG_TOKEN is set, it is required; if unset, open (local dev).
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

function extractToken(req: Request): string | undefined {
  const header = req.headers['x-job-catalog-token'];
  if (typeof header === 'string' && header.trim()) {
    return header.trim();
  }
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return undefined;
}

export function requireJobCatalogAccess(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.JOB_CATALOG_TOKEN;
  const provided = extractToken(req);
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    if (!expected) {
      logger.warn('Job catalog: access denied (JOB_CATALOG_TOKEN not set in production)');
      res.status(403).json({
        error: 'Catalog listing is disabled. Set JOB_CATALOG_TOKEN for the job-matching service.',
      });
      return;
    }
    if (provided !== expected) {
      res.status(401).json({ error: 'Unauthorized: invalid or missing catalog token' });
      return;
    }
    next();
    return;
  }

  if (expected && provided !== expected) {
    res.status(401).json({ error: 'Unauthorized: invalid or missing catalog token' });
    return;
  }

  next();
}
