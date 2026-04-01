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
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authorization header required' });
      return;
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET || 'dev-secret-key';

    const decoded = jwt.verify(token, secret) as JWTPayload;

    req.userId = decoded.userId;
    req.userEmail = decoded.email;

    next();
  } catch (error) {
    logger.error('Authentication failed', { error: (error as Error).message });
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
