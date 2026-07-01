/**
 * Auth Service
 * Validates JWT tokens
 */

import jwt, { JwtPayload } from 'jsonwebtoken';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

// Fill unset vars only — staging injects JWT_SECRET via up.sh before Node starts.
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const DEFAULT_PLACEHOLDER = 'your-secret-key-change-in-production';
const JWT_ALGORITHM: jwt.Algorithm = 'HS256';

/**
 * Verify JWT token
 */
interface DecodedToken extends JwtPayload {
  userId?: string;
  id?: string;
  email?: string;
}

export async function verifyToken(
  token: string
): Promise<{ userId: string; email: string } | null> {
  try {
    if (!JWT_SECRET || JWT_SECRET === DEFAULT_PLACEHOLDER) {
      logger.error('JWT_SECRET is not configured for job-matching service');
      return null;
    }

    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace(/^Bearer\s+/, '');

    // Verify token locally (fast)
    const decoded = jwt.verify(cleanToken, JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
    });
    if (typeof decoded !== 'object' || decoded === null) {
      logger.error('Token verification returned a non-object payload');
      return null;
    }

    const payload = decoded as DecodedToken;

    // Extract userId (может быть userId или id)
    const userId = payload.userId ?? payload.id;
    if (!userId) {
      logger.error('Token missing userId');
      return null;
    }

    return {
      userId: String(userId),
      email: typeof payload.email === 'string' ? payload.email : '',
    };
  } catch (error: unknown) {
    logger.error('Token verification failed:', error);
    return null;
  }
}
