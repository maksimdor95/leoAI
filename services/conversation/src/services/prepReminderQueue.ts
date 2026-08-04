/**
 * Deferred Interview Prep continue reminders (P1 DoD).
 * Independent of session TTL: payload lives in Redis ZSET until due/sent/cancelled.
 */

import redisClient from '../config/database';
import { logger } from '../utils/logger';
import type { ConversationSession } from '../types/session';
import { buildPrepContinueEmailDraftFromCollected, shouldSchedulePrepReminder } from '../utils/prepContinueReminder';
import { triggerPrepContinueEmailInternal } from './integrationService';
import { getSession, updateSessionMetadata } from './sessionService';

export const PREP_REMINDER_DELAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_ZSET = 'prep:reminders';
const REMINDER_KEY_PREFIX = 'prep:reminder:';
const REMINDER_PAYLOAD_TTL_SEC = 60 * 60 * 48; // 48h past due buffer

export type PrepReminderPayload = {
  sessionId: string;
  userId: string;
  email: string;
  emailKey: string;
  stageLabel: string;
  nextTitle: string;
  durationMin: number;
  stepIndex: number;
  stepTotal: number;
  progressPercent: number;
  role?: string;
  dueAt: string;
  scheduledAt: string;
};

function reminderKey(sessionId: string): string {
  return `${REMINDER_KEY_PREFIX}${sessionId}`;
}

export { shouldSchedulePrepReminder };

export async function cancelPrepContinueReminder(sessionId: string): Promise<void> {
  try {
    await redisClient.zRem(REMINDER_ZSET, sessionId);
    await redisClient.del(reminderKey(sessionId));
  } catch (error: unknown) {
    logger.warn(`Failed to cancel prep reminder for ${sessionId}:`, error);
  }
}

/**
 * Перепланировать напоминание на lastActive+24ч (или отменить для спринта / завершённого маршрута).
 */
export async function syncPrepContinueReminder(params: {
  session: ConversationSession;
  email: string;
  nowMs?: number;
}): Promise<'scheduled' | 'cancelled' | 'skipped'> {
  const { session, email, nowMs = Date.now() } = params;
  if (session.metadata.product !== 'interview-prep') {
    return 'skipped';
  }
  if (!email || !email.includes('@')) {
    return 'skipped';
  }

  const collected = session.metadata.collectedData || {};
  if (!shouldSchedulePrepReminder(collected)) {
    await cancelPrepContinueReminder(session.id);
    return 'cancelled';
  }

  const draft = buildPrepContinueEmailDraftFromCollected(collected, {
    requirePauseElapsed: false,
    nowMs,
  });
  if (!draft) {
    await cancelPrepContinueReminder(session.id);
    return 'cancelled';
  }

  const dueMs = nowMs + PREP_REMINDER_DELAY_MS;
  const payload: PrepReminderPayload = {
    sessionId: session.id,
    userId: session.userId,
    email,
    emailKey: draft.emailKey,
    stageLabel: draft.stageLabel,
    nextTitle: draft.nextTitle,
    durationMin: draft.durationMin,
    stepIndex: draft.stepIndex,
    stepTotal: draft.stepTotal,
    progressPercent: draft.progressPercent,
    role: draft.role,
    dueAt: new Date(dueMs).toISOString(),
    scheduledAt: new Date(nowMs).toISOString(),
  };

  await redisClient.setEx(reminderKey(session.id), REMINDER_PAYLOAD_TTL_SEC, JSON.stringify(payload));
  await redisClient.zAdd(REMINDER_ZSET, { score: dueMs, value: session.id });
  logger.info(
    `Prep reminder scheduled session=${session.id} dueAt=${payload.dueAt} key=${payload.emailKey}`
  );
  return 'scheduled';
}

export async function processDuePrepContinueReminders(options?: {
  nowMs?: number;
  limit?: number;
}): Promise<number> {
  const nowMs = options?.nowMs ?? Date.now();
  const limit = options?.limit ?? 20;
  let sent = 0;

  try {
    const dueIds = await redisClient.zRangeByScore(REMINDER_ZSET, 0, nowMs, {
      LIMIT: { offset: 0, count: limit },
    });

    for (const sessionId of dueIds) {
      const raw = await redisClient.get(reminderKey(sessionId));
      await redisClient.zRem(REMINDER_ZSET, sessionId);

      if (!raw) {
        continue;
      }

      let payload: PrepReminderPayload;
      try {
        payload = JSON.parse(raw) as PrepReminderPayload;
      } catch {
        await redisClient.del(reminderKey(sessionId));
        continue;
      }

      // Если сессия ещё жива — перепроверить актуальность (темп / прогресс / уже отправлено).
      const session = await getSession(sessionId);
      if (session) {
        const collected = session.metadata.collectedData || {};
        if (!shouldSchedulePrepReminder(collected)) {
          await redisClient.del(reminderKey(sessionId));
          continue;
        }
        if (collected.prepContinueEmailKey === payload.emailKey) {
          await redisClient.del(reminderKey(sessionId));
          continue;
        }
        const liveDraft = buildPrepContinueEmailDraftFromCollected(collected, {
          requirePauseElapsed: true,
          nowMs,
          pauseMs: PREP_REMINDER_DELAY_MS,
        });
        if (!liveDraft) {
          // Пользователь мог завершить маршрут или вернуться раньше — не шлём.
          await redisClient.del(reminderKey(sessionId));
          continue;
        }
        payload = {
          ...payload,
          ...liveDraft,
          email: payload.email,
          sessionId: payload.sessionId,
          userId: payload.userId,
          dueAt: payload.dueAt,
          scheduledAt: payload.scheduledAt,
        };
      }

      const ok = await triggerPrepContinueEmailInternal({
        userId: payload.userId,
        email: payload.email,
        sessionId: payload.sessionId,
        stageLabel: payload.stageLabel,
        nextTitle: payload.nextTitle,
        durationMin: payload.durationMin,
        stepIndex: payload.stepIndex,
        stepTotal: payload.stepTotal,
        progressPercent: payload.progressPercent,
        role: payload.role,
      });

      if (ok) {
        sent += 1;
        if (session) {
          await updateSessionMetadata(sessionId, {
            collectedData: {
              ...session.metadata.collectedData,
              prepContinueEmailKey: payload.emailKey,
            },
          });
        }
      }
      await redisClient.del(reminderKey(sessionId));
    }
  } catch (error: unknown) {
    logger.error('Error processing due prep reminders:', error);
  }

  return sent;
}

let reminderTimer: ReturnType<typeof setInterval> | null = null;

export function startPrepReminderWorker(intervalMs = 60_000): void {
  if (reminderTimer) {
    return;
  }
  const tick = () => {
    void processDuePrepContinueReminders().then((n) => {
      if (n > 0) {
        logger.info(`Prep reminder worker sent ${n} email(s)`);
      }
    });
  };
  reminderTimer = setInterval(tick, intervalMs);
  // Не блокируем event loop unref в тестах/shutdown
  if (typeof reminderTimer.unref === 'function') {
    reminderTimer.unref();
  }
  logger.info(`Prep reminder worker started (interval=${intervalMs}ms)`);
}

export function stopPrepReminderWorker(): void {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
}

/** Для тестов / диагностики */
export async function peekPrepReminder(sessionId: string): Promise<PrepReminderPayload | null> {
  const raw = await redisClient.get(reminderKey(sessionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PrepReminderPayload;
  } catch {
    return null;
  }
}
