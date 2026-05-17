/**
 * JWT Utilities
 * Token generation and verification (shared with User Profile Service)
 */

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';
const JWT_ALGORITHM: jwt.Algorithm = 'HS256';

export interface TokenPayload {
  userId: string;
  email: string;
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): TokenPayload {
  if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-in-production') {
    throw new Error('JWT_SECRET is not configured');
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
    }) as TokenPayload;
    return decoded;
  } catch (error: unknown) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Generate JWT token
 */
export function generateToken(payload: TokenPayload): string {
  if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-in-production') {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}
