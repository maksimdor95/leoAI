/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService';
import { logger } from '../utils/logger';
import { extractAccessToken } from '../utils/extractAccessToken';

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
    const token = extractAccessToken(req);
    if (!token) {
      res.status(401).json({ error: 'Unauthorized: No token provided' });
      return;
    }

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
