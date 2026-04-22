import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

interface JWTPayload {
  userId: string;
  email?: string;
  iat: number;
  exp: number;
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const raw = req.headers['x-auth-token'] || req.headers.authorization;
    const authHeader = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authorization header required' });
      return;
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === 'your-secret-key-change-in-production' || secret === 'dev-secret-key') {
      logger.error('JWT_SECRET is not configured for report service');
      res.status(500).json({ error: 'Server auth is not configured' });
      return;
    }

    const decoded = jwt.verify(token, secret) as JWTPayload;

    req.userId = decoded.userId;
    req.userEmail = decoded.email;

    next();
  } catch (error) {
    logger.error('Authentication failed', { error: (error as Error).message });
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
