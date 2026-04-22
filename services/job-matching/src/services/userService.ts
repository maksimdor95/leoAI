/**
 * User Service
 * Fetches user profile and collected data from other services
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import Redis from 'ioredis';
import { ioredisTlsOptions } from '../utils/redisTls';
import { classifyRoleFamily, keywordsForFamily } from './roleFamily';

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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseExperienceYears(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function hasRoleSignals(data: CollectedData | null | undefined): boolean {
  if (!data) return false;
  if (
    isNonEmptyString(data.desiredRole) ||
    isNonEmptyString(data.desired_role) ||
    isNonEmptyString(data.target_role) ||
    isNonEmptyString(data.current_role)
  ) {
    return true;
  }

  for (let i = 1; i <= 5; i += 1) {
    const role = data[`position_${i}_role` as keyof CollectedData];
    if (isNonEmptyString(role)) return true;
  }
  return false;
}

function mergeCollectedData(
  sessionData: CollectedData | null,
  careerData: CollectedData | null
): CollectedData | null {
  if (sessionData && careerData) {
    return { ...careerData, ...sessionData };
  }
  return sessionData ?? careerData;
}

function collectStringCandidates(obj: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const value of Object.values(obj)) {
    if (isNonEmptyString(value)) {
      out.push(value);
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isNonEmptyString(item)) out.push(item);
      }
      continue;
    }
    if (value && typeof value === 'object') {
      const nested = value as Record<string, unknown>;
      for (const nestedValue of Object.values(nested)) {
        if (isNonEmptyString(nestedValue)) out.push(nestedValue);
      }
    }
  }
  return out;
}

function inferDesiredRoleFromData(data: CollectedData | null | undefined): string | null {
  if (!data) return null;
  const candidates = collectStringCandidates(data as Record<string, unknown>)
    .map((v) => v.trim())
    .filter(Boolean);
  if (candidates.length === 0) return null;

  const inferredFamily = classifyRoleFamily(candidates.join(' | '));
  if (inferredFamily === 'unknown') return null;

  const familyKeywords = keywordsForFamily(inferredFamily);
  if (familyKeywords.length > 0) return familyKeywords[0];
  return null;
}

function enrichWithInferredRole(data: CollectedData | null): CollectedData | null {
  if (!data) return null;
  if (hasRoleSignals(data)) return data;

  const inferred = inferDesiredRoleFromData(data);
  if (!inferred) return data;

  return {
    ...data,
    desiredRole: inferred,
    desired_role: inferred,
  };
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
    const trackFromList = Array.isArray(payload?.tracks)
      ? (payload.tracks.find((t: Record<string, unknown>) => t?.is_default) ??
        payload.tracks[0])
      : null;
    const profile =
      payload?.careerProfile ??
      payload?.profile ??
      trackFromList ??
      payload;
    if (!profile || typeof profile !== 'object') return null;

    const record = profile as Record<string, unknown>;
    const collected: CollectedData = {};

    const targetRole =
      (isNonEmptyString(record.target_role) && record.target_role) ||
      (isNonEmptyString(record.targetRole) && record.targetRole);
    if (targetRole) {
      collected.desiredRole = targetRole;
      collected.desired_role = targetRole;
    }

    const currentRole =
      (isNonEmptyString(record.current_role) && record.current_role) ||
      (isNonEmptyString(record.currentRole) && record.currentRole);
    if (currentRole) {
      collected.current_role = currentRole;
      collected.position_1_role = currentRole;
    }

    const expYears = parseExperienceYears(record.experience_years ?? record.experienceYears);
    if (typeof expYears === 'number') {
      collected.totalExperience = expYears;
    }

    const resumeText = isNonEmptyString(payload?.resume?.resume_text)
      ? (payload.resume.resume_text as string)
      : null;
    if (resumeText && !hasRoleSignals(collected)) {
      const inferredFamily = classifyRoleFamily(resumeText);
      if (inferredFamily !== 'unknown') {
        const inferred = keywordsForFamily(inferredFamily)[0];
        if (inferred) {
          collected.desiredRole = inferred;
          collected.desired_role = inferred;
        }
      }
    }

    const base = Object.keys(collected).length > 0 ? collected : null;
    return enrichWithInferredRole(base);
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
  const sessionNotEmpty = !!fromSession && Object.keys(fromSession).length > 0;
  const sessionHasRoleSignals = hasRoleSignals(fromSession);
  if (sessionNotEmpty && sessionHasRoleSignals) return fromSession;

  const fromCareer = await getCollectedDataFromCareerProfile(userId, token);
  if (fromCareer && !sessionHasRoleSignals) {
    logger.info(
      `[collectedData] Enriching data from CareerProfile for user ${userId}; session lacks role signals`
    );
  }

  const merged = mergeCollectedData(fromSession, fromCareer);
  if (!merged || Object.keys(merged).length === 0) return null;
  return enrichWithInferredRole(merged);
}

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeRedisConnection(): Promise<void> {
  await redis.quit();
}
