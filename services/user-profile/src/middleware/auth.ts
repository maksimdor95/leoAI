/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

/**
 * Middleware to verify JWT token
 */
export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  logger.info('Authenticating token...');
  const authorizationHeader = req.headers['authorization'];
  if (authorizationHeader) {
    logger.info(`Authorization header: ${authorizationHeader.substring(0, 30)}...`);
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    logger.warn('No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const payload = verifyToken(token);
    logger.info(`Token verified for user: ${payload.userId}`);
    req.userId = payload.userId;
    req.userEmail = payload.email;
    return next();
  } catch (error: unknown) {
    logger.error('Token verification failed:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}
