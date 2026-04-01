/**
 * Queue Service
 * Manages job queues for background processing
 */

import { Queue } from 'bullmq';
import { logger } from '../utils/logger';

const SCRAPER_QUEUE_NAME = 'job-scraping';

interface ScraperJobData {
  source?: string;
}

/**
 * Create scraper queue
 */
export function createScraperQueue(): Queue<ScraperJobData> {
  return new Queue<ScraperJobData>(SCRAPER_QUEUE_NAME, {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000, // 5 seconds
      },
      removeOnComplete: {
        count: 100,
        age: 24 * 3600, // 24 hours
      },
      removeOnFail: {
        count: 1000,
      },
    },
  });
}

/**
 * Schedule scraping job
 */
export async function scheduleScraping(source?: string): Promise<void> {
  const queue = createScraperQueue();

  await queue.add(
    'scrape-jobs',
    { source },
    {
      repeat: {
        pattern: '0 * * * *', // Every hour at minute 0
      },
    }
  );

  logger.info('Scraping job scheduled (runs every hour)');
}

/**
 * Trigger immediate scraping
 */
export async function triggerScraping(source?: string): Promise<string> {
  const queue = createScraperQueue();

  const job = await queue.add('scrape-jobs', { source }, { priority: 1 });

  logger.info(`Scraping job triggered: ${job.id}`);
  return job.id || '';
}
