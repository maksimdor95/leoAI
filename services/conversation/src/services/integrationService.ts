/**
 * Integration Service
 * Triggers actions in other services when events occur
 */

import axios from 'axios';
import { logger } from '../utils/logger';

const JOB_MATCHING_SERVICE_URL = process.env.JOB_MATCHING_SERVICE_URL || 'http://localhost:3004';
const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'http://localhost:3005';
const REPORT_SERVICE_URL = process.env.REPORT_SERVICE_URL || 'http://localhost:3007';

const HTTP_TIMEOUT_MS = {
  scrapeForUser: 10000,
  jobMatching: 30000,
  jobsEmail: 10000,
  reportGeneration: 15000,
} as const;

const HTTP_RETRY = {
  scrapeForUser: 2,
  jobMatching: 2,
  jobsEmail: 1,
  reportGeneration: 1,
} as const;

function toBearerToken(token: string): string {
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const code = error.code || '';
  if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'ENOTFOUND') {
    return true;
  }

  const status = error.response?.status;
  return Boolean(status && (status >= 500 || status === 429));
}

async function withHttpRetry<T>(
  operationName: string,
  maxRetries: number,
  request: () => Promise<T>
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await request();
    } catch (error: unknown) {
      lastError = error;
      const canRetry = attempt < maxRetries && isRetryableError(error);
      if (!canRetry) {
        throw error;
      }

      const delayMs = Math.min(500 * Math.pow(2, attempt), 3000);
      logger.warn(
        `[integration:${operationName}] transient failure, retry ${attempt + 1}/${maxRetries} in ${delayMs}ms`
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Запустить сбор вакансий под конкретного пользователя (по его role-family
 * и желаемой роли). Дёргается из Jack-сценария, как только пользователь
 * отвечает на `desired_role` — в этот момент у нас уже достаточно сигнала,
 * чтобы scraper собрал релевантный срез (PM / Analyst / Design / ...).
 *
 * Не кидает ошибок — триггер фоновый.
 */
export async function triggerProfileDrivenScrape(userId: string, token: string): Promise<void> {
  try {
    logger.info(`[scrape-for-user] Enqueuing profile-driven scrape for user: ${userId}`);
    await withHttpRetry(
      'scrape-for-user',
      HTTP_RETRY.scrapeForUser,
      async () =>
        axios.post(
          `${JOB_MATCHING_SERVICE_URL}/api/jobs/scrape/for-user/${userId}`,
          {},
          {
            headers: {
              Authorization: toBearerToken(token),
              'Content-Type': 'application/json',
            },
            timeout: HTTP_TIMEOUT_MS.scrapeForUser,
          }
        )
    );
    logger.info(`[scrape-for-user] Scrape enqueued for user: ${userId}`);
  } catch (error: unknown) {
    logger.error(`[scrape-for-user] Error enqueuing scrape for user ${userId}:`, error);
  }
}

/**
 * Trigger job matching after conversation completion
 */
export async function triggerJobMatching(userId: string, token: string): Promise<void> {
  try {
    logger.info(`Triggering job matching for user: ${userId}`);

    // Call job matching service to find jobs
    await withHttpRetry(
      'job-matching',
      HTTP_RETRY.jobMatching,
      async () =>
        axios.get(`${JOB_MATCHING_SERVICE_URL}/api/jobs/match/${userId}`, {
          headers: {
            Authorization: toBearerToken(token),
          },
          timeout: HTTP_TIMEOUT_MS.jobMatching,
        })
    );

    logger.info(`Job matching completed for user: ${userId}`);
  } catch (error: unknown) {
    logger.error(`Error triggering job matching for user ${userId}:`, error);
    // Don't throw - this is a background task, shouldn't block conversation completion
  }
}

/**
 * Trigger email sending with job matches
 */
export async function triggerJobsEmail(
  userId: string,
  email: string,
  jobIds: string[],
  token: string
): Promise<void> {
  try {
    logger.info(`Triggering jobs email for user: ${userId} with ${jobIds.length} jobs`);

    // Call email service to send jobs digest
    await withHttpRetry(
      'jobs-email',
      HTTP_RETRY.jobsEmail,
      async () =>
        axios.post(
          `${EMAIL_SERVICE_URL}/api/email/send-jobs`,
          {
            userId,
            jobIds,
          },
          {
            headers: {
              Authorization: toBearerToken(token),
              'Content-Type': 'application/json',
            },
            timeout: HTTP_TIMEOUT_MS.jobsEmail,
          }
        )
    );

    logger.info(`Jobs email sent to user: ${userId}`);
  } catch (error: unknown) {
    logger.error(`Error triggering jobs email for user ${userId}:`, error);
    // Don't throw - this is a background task
  }
}

/**
 * Trigger report generation for wannanew product.
 */
export async function triggerWannanewReport(
  sessionId: string,
  userId: string,
  email: string,
  token: string
): Promise<void> {
  try {
    logger.info(`[wannanew] Triggering report generation for user: ${userId}, session: ${sessionId}`);

    await withHttpRetry(
      'report-generate',
      HTTP_RETRY.reportGeneration,
      async () =>
        axios.post(
          `${REPORT_SERVICE_URL}/api/report/generate`,
          { sessionId, userId, email },
          {
            headers: {
              Authorization: toBearerToken(token),
              'Content-Type': 'application/json',
            },
            timeout: HTTP_TIMEOUT_MS.reportGeneration,
          }
        )
    );

    logger.info(`[wannanew] Report generation requested for user: ${userId}, session: ${sessionId}`);
  } catch (error: unknown) {
    logger.error(`[wannanew] Error triggering report generation for user ${userId}:`, error);
  }
}

interface CompletionOptions {
  userId: string;
  email: string;
  token: string;
  sessionId: string;
  product?: 'jack' | 'wannanew';
  scenarioId?: string;
}

/**
 * Complete flow:
 * - Jack: conversation -> job matching -> email
 * - wannanew: conversation -> report generation
 */
export async function handleConversationCompletion(options: CompletionOptions): Promise<void> {
  const { userId, email, token, sessionId, product, scenarioId } = options;
  
  try {
    logger.info(`Handling conversation completion for user: ${userId}, product: ${product || 'jack'}`);

    // wannanew product: trigger report generation flow
    if (product === 'wannanew' || scenarioId === 'wannanew-pm-v1') {
      await triggerWannanewReport(sessionId, userId, email, token);
      return;
    }

    // Jack product: trigger job matching → email flow
    // Step 1: Trigger job matching
    const matchingResponse = await withHttpRetry(
      'completion-job-matching',
      HTTP_RETRY.jobMatching,
      async () =>
        axios.get(
          `${JOB_MATCHING_SERVICE_URL}/api/jobs/match/${userId}`,
          {
            headers: {
              Authorization: toBearerToken(token),
            },
            timeout: HTTP_TIMEOUT_MS.jobMatching,
          }
        )
    );

    const jobs = matchingResponse.data?.jobs || [];
    if (jobs.length > 0) {
      // Step 2: Extract job IDs
      const jobIds = jobs.map((match: { job: { id: string } }) => match.job.id).slice(0, 10); // Top 10 jobs

      // Step 3: Send email with jobs
      await triggerJobsEmail(userId, email, jobIds, token);
    } else {
      logger.info(`No job matches found for user: ${userId}`);
    }
  } catch (error: unknown) {
    logger.error(`Error handling conversation completion for user ${userId}:`, error);
    // Don't throw - this is a background task
  }
}
