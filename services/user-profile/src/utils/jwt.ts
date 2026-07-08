/**
 * JWT Utilities
 * Functions for creating and verifying JWT tokens
 */

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { logger } from './logger';

// Fill unset vars from service .env; do not override secrets from up.sh / .env.staging.local.
dotenv.config();

const INSECURE_JWT_SECRETS = new Set([
  'your-secret-key-change-in-production',
  'your_jwt_secret_key_here_change_in_production',
]);

const JWT_SECRET: string = process.env.JWT_SECRET?.trim() || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';
export const JWT_ALGORITHM: jwt.Algorithm = 'HS256';

// Log only presence of JWT secret, never partial value.
if (JWT_SECRET && !INSECURE_JWT_SECRETS.has(JWT_SECRET)) {
  logger.info(`JWT_SECRET is configured (length: ${JWT_SECRET.length})`);
} else {
  logger.warn('JWT_SECRET is using default value - this is insecure!');
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim() || JWT_SECRET;
  if (!secret || INSECURE_JWT_SECRETS.has(secret)) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

export interface TokenPayload {
  userId: string;
  email: string;
}

/**
 * Generate JWT token
 */
export function generateToken(payload: TokenPayload): string {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, {
    algorithm: JWT_ALGORITHM,
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): TokenPayload {
  const secret = getJwtSecret();
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: [JWT_ALGORITHM],
    }) as TokenPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}
