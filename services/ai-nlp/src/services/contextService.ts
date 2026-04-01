/**
 * Context Service
 * Handles conversation history and extracted facts in Redis
 */

import redisClient from '../config/redis';
import { AIMessage, ExtractedFacts } from '../types/ai';
import { logger } from '../utils/logger';

const PREFIX = process.env.REDIS_PREFIX || 'ai:nlp:';
const HISTORY_TTL = 60 * 60 * 24; // 24 hours
const FACTS_TTL = 60 * 60 * 24 * 7; // 7 days
const HISTORY_LIMIT = 20; // keep last 20 messages by default

const historyKey = (sessionId: string) => `${PREFIX}history:${sessionId}`;
const factsKey = (sessionId: string) => `${PREFIX}facts:${sessionId}`;

export async function getHistory(sessionId: string): Promise<AIMessage[]> {
  const data = await redisClient.get(historyKey(sessionId));
  if (!data) {
    return [];
  }
  try {
    return JSON.parse(data) as AIMessage[];
  } catch (error: unknown) {
    logger.error('Failed to parse history from Redis:', error);
    return [];
  }
}

export async function saveHistory(sessionId: string, messages: AIMessage[]): Promise<void> {
  const trimmed = messages.slice(-HISTORY_LIMIT);
  await redisClient.setEx(historyKey(sessionId), HISTORY_TTL, JSON.stringify(trimmed));
}

export async function appendToHistory(sessionId: string, message: AIMessage): Promise<AIMessage[]> {
  const history = await getHistory(sessionId);
  history.push(message);
  await saveHistory(sessionId, history);
  return history;
}

export async function getFacts(sessionId: string): Promise<ExtractedFacts | null> {
  const data = await redisClient.get(factsKey(sessionId));
  if (!data) {
    return null;
  }
  try {
    return JSON.parse(data) as ExtractedFacts;
  } catch (error: unknown) {
    logger.error('Failed to parse facts from Redis:', error);
    return null;
  }
}

export async function updateFacts(
  sessionId: string,
  updates: ExtractedFacts
): Promise<ExtractedFacts> {
  const existing = (await getFacts(sessionId)) || {};
  const merged: ExtractedFacts = {
    ...existing,
    ...updates,
  };

  await redisClient.setEx(factsKey(sessionId), FACTS_TTL, JSON.stringify(merged));
  return merged;
}
