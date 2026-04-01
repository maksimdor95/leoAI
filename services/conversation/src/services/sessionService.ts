/**
 * Session Service
 * Manages conversation sessions in Redis
 */

import redisClient from '../config/database';
import { ConversationSession, SessionCreateRequest, ProductType } from '../types/session';
import { Message } from '../types/message';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { getScenarioIdByProduct } from './dialogueEngine';

const SESSION_PREFIX = 'session:';
const SESSION_TTL = 60 * 60 * 24; // 24 hours

/**
 * Create a new conversation session
 */
export async function createSession(request: SessionCreateRequest): Promise<ConversationSession> {
  const sessionId = uuidv4();
  const now = new Date().toISOString();
  
  // Determine product and scenario
  const product: ProductType = request.product || 'jack';
  const scenarioId = getScenarioIdByProduct(product);

  const session: ConversationSession = {
    id: sessionId,
    userId: request.userId,
    createdAt: now,
    updatedAt: now,
    messages: [],
    metadata: {
      collectedData: {},
      status: 'active',
      product,
      scenarioId,
      completedSteps: [],
      flags: {},
    },
  };

  // Save to Redis
  await redisClient.setEx(`${SESSION_PREFIX}${sessionId}`, SESSION_TTL, JSON.stringify(session));

  // Also save user's active session
  await redisClient.setEx(`user:${request.userId}:session`, SESSION_TTL, sessionId);

  // Add to user's sessions list
  const userSessionsKey = `user:${request.userId}:sessions`;
  await redisClient.sAdd(userSessionsKey, sessionId);
  await redisClient.expire(userSessionsKey, SESSION_TTL);

  logger.info(`Session created: ${sessionId} for user: ${request.userId}`);
  return session;
}

/**
 * Get session by ID
 */
export async function getSession(sessionId: string): Promise<ConversationSession | null> {
  try {
    const data = await redisClient.get(`${SESSION_PREFIX}${sessionId}`);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as ConversationSession;
  } catch (error: unknown) {
    logger.error(`Error getting session ${sessionId}:`, error);
    return null;
  }
}

/**
 * Get user's active session
 */
export async function getUserSession(userId: string): Promise<ConversationSession | null> {
  try {
    const sessionId = await redisClient.get(`user:${userId}:session`);
    if (!sessionId) {
      return null;
    }
    return await getSession(sessionId);
  } catch (error: unknown) {
    logger.error(`Error getting user session for ${userId}:`, error);
    return null;
  }
}

/**
 * Update session
 */
export async function updateSession(session: ConversationSession): Promise<void> {
  session.updatedAt = new Date().toISOString();

  await redisClient.setEx(`${SESSION_PREFIX}${session.id}`, SESSION_TTL, JSON.stringify(session));
}

/**
 * Add message to session
 */
export async function addMessageToSession(sessionId: string, message: Message): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  session.messages.push(message);
  await updateSession(session);
}

/**
 * Update session metadata (collected data)
 */
export async function updateSessionMetadata(
  sessionId: string,
  updates: Partial<ConversationSession['metadata']>
): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  session.metadata = {
    ...session.metadata,
    ...updates,
    collectedData: {
      ...session.metadata.collectedData,
      ...(updates.collectedData || {}),
    },
    completedSteps: Array.from(
      new Set([
        ...(session.metadata.completedSteps || []),
        ...((updates.completedSteps || []) as string[]),
      ])
    ),
    flags: {
      ...(session.metadata.flags || {}),
      ...(updates.flags || {}),
    },
  };

  await updateSession(session);
}

/**
 * Get all sessions for a user
 */
export async function getUserSessions(userId: string): Promise<ConversationSession[]> {
  try {
    const userSessionsKey = `user:${userId}:sessions`;
    const sessionIds = await redisClient.sMembers(userSessionsKey);

    if (sessionIds.length === 0) {
      // Fallback: try to get from active session
      const activeSession = await getUserSession(userId);
      if (activeSession) {
        return [activeSession];
      }
      return [];
    }

    const sessions: ConversationSession[] = [];
    for (const sessionId of sessionIds) {
      const session = await getSession(sessionId);
      if (session && session.userId === userId) {
        sessions.push(session);
      }
    }

    // Sort by updatedAt descending (newest first)
    return sessions.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch (error: unknown) {
    logger.error(`Error getting user sessions for ${userId}:`, error);
    return [];
  }
}

/**
 * Delete a conversation session
 */
export async function deleteSession(sessionId: string, userId: string): Promise<boolean> {
  try {
    // First verify the session exists and belongs to the user
    const session = await getSession(sessionId);
    if (!session || session.userId !== userId) {
      logger.warn(
        `Attempted to delete session ${sessionId} by user ${userId} - not found or unauthorized`
      );
      return false;
    }

    // Remove from Redis
    await redisClient.del(`${SESSION_PREFIX}${sessionId}`);

    // Remove from user's sessions set
    const userSessionsKey = `user:${userId}:sessions`;
    await redisClient.sRem(userSessionsKey, sessionId);

    // If this was the user's active session, clear it
    const activeSessionId = await redisClient.get(`user:${userId}:session`);
    if (activeSessionId === sessionId) {
      await redisClient.del(`user:${userId}:session`);
    }

    logger.info(`Session deleted: ${sessionId} for user: ${userId}`);
    return true;
  } catch (error: unknown) {
    logger.error('Error deleting session:', error);
    return false;
  }
}
