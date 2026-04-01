/**
 * Auth Service
 * Validates JWT tokens
 */

import jwt, { JwtPayload } from 'jsonwebtoken';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace(/^Bearer\s+/, '');

    // Verify token locally (fast)
    const decoded = jwt.verify(cleanToken, JWT_SECRET);
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
