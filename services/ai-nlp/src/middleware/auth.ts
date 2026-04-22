import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

interface JwtPayload {
  userId?: string;
  id?: string;
}

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret === 'your-secret-key-change-in-production') {
    logger.error('JWT_SECRET is not configured for AI/NLP service');
    res.status(500).json({ error: 'Server auth is not configured' });
    return;
  }

  const raw = req.headers['x-auth-token'] || req.headers.authorization;
  const authHeader = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!token) {
    res.status(401).json({ error: 'Authorization header required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    req.userId = String(decoded.userId || decoded.id || '');
    next();
  } catch (error) {
    logger.warn('AI/NLP auth failed', { error: (error as Error).message });
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
