/**
 * User Service
 * Fetches user profile and collected data from other services
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import Redis from 'ioredis';

const USER_PROFILE_SERVICE_URL = process.env.USER_PROFILE_SERVICE_URL || 'http://localhost:3001';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

// Redis client for accessing session data
const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  // Only add username if it's explicitly provided and not 'default'
  ...(process.env.REDIS_USER && process.env.REDIS_USER !== 'default'
    ? { username: process.env.REDIS_USER }
    : {}),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tls: process.env.REDIS_SSL === 'true' ? ({ rejectUnauthorized: false } as any) : undefined,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  preferences?: {
    location?: string[];
    salary?: { min?: number; currency?: string };
    companySize?: string;
    industry?: string[];
    workMode?: string;
    techStack?: string[];
  };
}

export interface CollectedData {
  desiredRole?: string;
  totalExperience?: number;
  location?: string[];
  workMode?: string;
  skills?: string[];
  industries?: string[];
  [key: string]: unknown;
}

/**
 * Get user profile from User Profile Service
 */
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

/**
 * Get collected data from user's active session in Redis
 */
export async function getCollectedData(userId: string): Promise<CollectedData | null> {
  try {
    // Try to find active session for user
    const activeSessionKey = `user:${userId}:session`;
    const sessionId = await redis.get(activeSessionKey);

    if (!sessionId) {
      logger.warn(`No active session found for user ${userId}`);
      return null;
    }

    // Get session data
    const sessionKey = `session:${sessionId}`;
    const sessionData = await redis.get(sessionKey);

    if (!sessionData) {
      logger.warn(`Session ${sessionId} not found in Redis`);
      return null;
    }

    const session = JSON.parse(sessionData);
    return session.metadata?.collectedData || null;
  } catch (error: unknown) {
    logger.error('Failed to get collected data:', error);
    return null;
  }
}

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeRedisConnection(): Promise<void> {
  await redis.quit();
}
