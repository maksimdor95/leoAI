/**
 * Integration Service
 * Triggers actions in other services when events occur
 */

import axios from 'axios';
import { logger } from '../utils/logger';

const JOB_MATCHING_SERVICE_URL = process.env.JOB_MATCHING_SERVICE_URL || 'http://localhost:3004';
const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'http://localhost:3005';

/**
 * Trigger job matching after conversation completion
 */
export async function triggerJobMatching(userId: string, token: string): Promise<void> {
  try {
    logger.info(`Triggering job matching for user: ${userId}`);

    // Call job matching service to find jobs
    await axios.get(`${JOB_MATCHING_SERVICE_URL}/api/jobs/match/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 30000, // 30 seconds timeout
    });

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
    await axios.post(
      `${EMAIL_SERVICE_URL}/api/email/send-jobs`,
      {
        userId,
        jobIds,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 seconds timeout
      }
    );

    logger.info(`Jobs email sent to user: ${userId}`);
  } catch (error: unknown) {
    logger.error(`Error triggering jobs email for user ${userId}:`, error);
    // Don't throw - this is a background task
  }
}

interface CompletionOptions {
  userId: string;
  email: string;
  token: string;
  product?: 'jack' | 'wannanew';
  scenarioId?: string;
}

/**
 * Complete flow: conversation → job matching → email (only for Jack product)
 * For wannanew: placeholder for future report generation
 */
export async function handleConversationCompletion(options: CompletionOptions): Promise<void> {
  const { userId, email, token, product, scenarioId } = options;
  
  try {
    logger.info(`Handling conversation completion for user: ${userId}, product: ${product || 'jack'}`);

    // wannanew product: skip job matching/email, placeholder for report generation
    if (product === 'wannanew' || scenarioId === 'wannanew-pm-v1') {
      logger.info(`[wannanew] Conversation completed for user: ${userId}. Report generation not implemented yet.`);
      // TODO: Future - trigger report generation for wannanew
      return;
    }

    // Jack product: trigger job matching → email flow
    // Step 1: Trigger job matching
    const matchingResponse = await axios.get(
      `${JOB_MATCHING_SERVICE_URL}/api/jobs/match/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 30000,
      }
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
