/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: { userId: string; email: string };
}

/**
 * Middleware to verify JWT token
 */
export async function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: No token provided' });
      return;
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: Invalid token' });
      return;
    }

    req.user = user;
    next();
  } catch (error: unknown) {
    logger.error('Request authentication failed:', error);
    res.status(401).json({ error: 'Unauthorized: Authentication failed' });
  }
}
