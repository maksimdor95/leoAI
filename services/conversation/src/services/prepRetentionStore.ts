import redisClient from '../config/database';
import { logger } from '../utils/logger';
import type { StarBankEntry } from '../utils/prepRetention';

const STAR_BANK_PREFIX = 'user';
const STAR_BANK_SUFFIX = 'prep:starBank';
const STAR_BANK_TTL_SECONDS = 60 * 60 * 24 * 180;

function starBankKey(userId: string): string {
  return `${STAR_BANK_PREFIX}:${userId}:${STAR_BANK_SUFFIX}`;
}

export async function loadUserStarBank(userId: string): Promise<StarBankEntry[]> {
  if (!userId) return [];
  try {
    const raw = await redisClient.get(starBankKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is StarBankEntry => {
      return (
        entry != null &&
        typeof entry === 'object' &&
        typeof (entry as StarBankEntry).userMessage === 'string' &&
        typeof (entry as StarBankEntry).savedAt === 'string'
      );
    });
  } catch (error: unknown) {
    logger.warn(`Failed to load STAR bank for user ${userId}:`, error);
    return [];
  }
}

export async function saveUserStarBank(userId: string, entries: StarBankEntry[]): Promise<void> {
  if (!userId) return;
  try {
    await redisClient.setEx(starBankKey(userId), STAR_BANK_TTL_SECONDS, JSON.stringify(entries.slice(0, 12)));
  } catch (error: unknown) {
    logger.warn(`Failed to save STAR bank for user ${userId}:`, error);
  }
}

export async function appendUserStarBankEntry(userId: string, entry: StarBankEntry): Promise<StarBankEntry[]> {
  const existing = await loadUserStarBank(userId);
  const key = entry.userMessage.trim().slice(0, 160).toLowerCase();
  const merged = [
    entry,
    ...existing.filter((item) => item.userMessage.trim().slice(0, 160).toLowerCase() !== key),
  ].slice(0, 12);
  await saveUserStarBank(userId, merged);
  return merged;
}
