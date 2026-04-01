/**
 * JWT Utilities
 * Functions for creating and verifying JWT tokens
 */

import jwt from 'jsonwebtoken';
import { logger } from './logger';

const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';

// Log JWT_SECRET info on module load (only first few chars for security)
if (JWT_SECRET && JWT_SECRET !== 'your-secret-key-change-in-production') {
  logger.info(`JWT_SECRET is set (length: ${JWT_SECRET.length}, starts with: ${JWT_SECRET.substring(0, 4)}...)`);
} else {
  logger.warn('JWT_SECRET is using default value - this is insecure!');
}

export interface TokenPayload {
  userId: string;
  email: string;
}

/**
 * Generate JWT token
 */
export function generateToken(payload: TokenPayload): string {
  if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-in-production') {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): TokenPayload {
  if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-in-production') {
    throw new Error('JWT_SECRET is not configured');
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}
