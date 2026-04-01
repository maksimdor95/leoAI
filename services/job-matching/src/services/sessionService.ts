/**
 * Session Service Client
 * Retrieves conversation session data from Redis
 */

import redisClient from '../config/redis';
import { logger } from '../utils/logger';

export interface ConversationSession {
  id: string;
  userId: string;
  metadata: {
    collectedData: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Get user's active session from Redis
 */
export async function getUserActiveSession(userId: string): Promise<ConversationSession | null> {
  try {
    // Get active session ID
    const sessionId = await redisClient.get(`user:${userId}:session`);
    if (!sessionId) {
      logger.info(`No active session found for user ${userId}`);
      return null;
    }

    // Get session data
    const sessionData = await redisClient.get(`session:${sessionId}`);
    if (!sessionData) {
      logger.warn(`Session ${sessionId} not found in Redis`);
      return null;
    }

    return JSON.parse(sessionData) as ConversationSession;
  } catch (error: unknown) {
    logger.error(`Error getting user session for ${userId}:`, error);
    return null;
  }
}

/**
 * Get collected data from user's session
 */
export async function getUserCollectedData(
  userId: string
): Promise<Record<string, unknown> | null> {
  const session = await getUserActiveSession(userId);
  if (!session) {
    return null;
  }

  return session.metadata?.collectedData || {};
}
