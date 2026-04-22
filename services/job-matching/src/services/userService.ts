/**
 * User Service
 * Fetches user profile and collected data from other services
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import Redis from 'ioredis';
import { ioredisTlsOptions } from '../utils/redisTls';

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
  tls: ioredisTlsOptions() as any,
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
 * Фолбэк: если Redis-сессия пустая / истекла, собираем CollectedData
 * из CareerProfile в user-profile сервисе. Это даёт шанс матчеру
 * работать даже после рестарта Redis / выхода пользователя и возвращения.
 *
 * Здесь мы получаем только базовые поля (target_role / current_role / experience_years),
 * чего достаточно для role-family классификации и выбора ключевых слов.
 */
export async function getCollectedDataFromCareerProfile(
  userId: string,
  token: string
): Promise<CollectedData | null> {
  try {
    const response = await axios.get(
      `${USER_PROFILE_SERVICE_URL}/api/career/career-profile/${userId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000,
      }
    );
    const payload = response.data ?? {};
    const profile = payload?.careerProfile ?? payload?.profile ?? payload;
    if (!profile || typeof profile !== 'object') return null;

    const record = profile as Record<string, unknown>;
    const collected: CollectedData = {};

    if (typeof record.target_role === 'string' && record.target_role.trim()) {
      collected.desiredRole = record.target_role as string;
      collected.desired_role = record.target_role as string;
    }
    if (typeof record.current_role === 'string' && record.current_role.trim()) {
      collected.position_1_role = record.current_role as string;
    }
    if (typeof record.experience_years === 'number') {
      collected.totalExperience = record.experience_years as number;
    }

    return Object.keys(collected).length > 0 ? collected : null;
  } catch (error) {
    logger.warn(`Failed to fetch career profile fallback for user ${userId}: ${String(error)}`);
    return null;
  }
}

/**
 * Собирает CollectedData с приоритетом Redis-сессии, но использует
 * career-profile как фолбэк. Матчер всегда должен пытаться дать результат
 * хотя бы на основе CareerProfile — иначе пользователь после logout получает
 * «нерелевантный каталог» без объяснения.
 */
export async function getCollectedDataWithFallback(
  userId: string,
  token: string
): Promise<CollectedData | null> {
  const fromSession = await getCollectedData(userId);
  if (fromSession && Object.keys(fromSession).length > 0) return fromSession;

  const fromCareer = await getCollectedDataFromCareerProfile(userId, token);
  if (fromCareer) {
    logger.info(
      `[collectedData] Falling back to CareerProfile for user ${userId}; session is empty or expired`
    );
  }
  return fromCareer;
}

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeRedisConnection(): Promise<void> {
  await redis.quit();
}
