/**
 * Auth Service
 * Validates JWT tokens with User Profile Service
 */

import axios from 'axios';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { logger } from '../utils/logger';

const USER_PROFILE_SERVICE_URL = process.env.USER_PROFILE_SERVICE_URL || 'http://localhost:3001';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Log JWT_SECRET info on module load (only first few chars for security)
if (JWT_SECRET && JWT_SECRET !== 'your-secret-key-change-in-production') {
  logger.info(`JWT_SECRET is set (length: ${JWT_SECRET.length}, starts with: ${JWT_SECRET.substring(0, 4)}...)`);
} else {
  logger.warn('JWT_SECRET is using default value - this is insecure!');
}

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
    if (error instanceof jwt.JsonWebTokenError) {
      if (error.message === 'invalid signature') {
        logger.error('Token verification failed: invalid signature. This usually means the token was signed with a different JWT_SECRET. User needs to re-login to get a new token.');
      } else {
        logger.error(`Token verification failed: ${error.message}`, error);
      }
    } else {
      logger.error('Token verification failed:', error);
    }
    return null;
  }
}

/**
 * Get user profile from User Profile Service
 */
export type UserProfile = Record<string, unknown>;

export async function getUserProfile(token: string): Promise<UserProfile> {
  try {
    const response = await axios.get(`${USER_PROFILE_SERVICE_URL}/api/users/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error: unknown) {
    logger.error('Failed to get user profile:', error);
    throw error;
  }
}
