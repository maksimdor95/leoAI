/**
 * Короткий Redis-кэш ответа /api/jobs/match.
 * Снижает повторные прогоны 5k + LLM при том же профиле и каталоге.
 */

import crypto from 'crypto';
import { logger } from '../utils/logger';

const CACHE_ENABLED = (process.env.MATCH_CACHE_ENABLED || 'true').toLowerCase() !== 'false';
const TTL_SEC = Math.min(
  1800,
  Math.max(30, Number(process.env.MATCH_CACHE_TTL_SEC || 300))
);

export type MatchCatalogFingerprint = {
  jobsInDb: number;
  maxUpdatedAt: string;
};

export function isMatchCacheEnabled(): boolean {
  return CACHE_ENABLED;
}

export function getMatchCacheTtlSec(): number {
  return TTL_SEC;
}

/** Стабильный хэш профиля для ключа кэша (без embedding). */
export function hashMatchProfile(collectedData: Record<string, unknown> | null | undefined): string {
  if (!collectedData || typeof collectedData !== 'object') {
    return 'empty';
  }
  const skip = new Set(['embedding', '__embedding', 'embeddingUpdatedAt']);
  const entries = Object.keys(collectedData)
    .filter((k) => !skip.has(k))
    .sort()
    .map((k) => [k, collectedData[k]] as const);
  const raw = JSON.stringify(entries);
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24);
}

export function buildMatchCacheKey(params: {
  userId: string;
  sessionId?: string;
  profileHash: string;
  catalog: MatchCatalogFingerprint;
}): string {
  const sessionPart = params.sessionId?.trim() || 'default';
  const cat = `${params.catalog.jobsInDb}:${params.catalog.maxUpdatedAt}`;
  return `match:v1:${params.userId}:${sessionPart}:${params.profileHash}:${cat}`;
}

async function getRedis() {
  // Lazy import — unit-тесты хэша/ключа не поднимают ioredis.
  const mod = await import('../config/redis');
  return mod.default;
}

export async function getCachedMatchPayload(key: string): Promise<unknown | null> {
  if (!CACHE_ENABLED) return null;
  try {
    const redis = await getRedis();
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch (err) {
    logger.warn(
      `match cache get failed (fail-open): ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

export async function setCachedMatchPayload(key: string, payload: unknown): Promise<void> {
  if (!CACHE_ENABLED) return;
  try {
    const redis = await getRedis();
    await redis.set(key, JSON.stringify(payload), 'EX', TTL_SEC);
  } catch (err) {
    logger.warn(
      `match cache set failed (fail-open): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
