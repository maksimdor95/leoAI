/**
 * Scraping Queue Service
 * Manages background job scraping using BullMQ
 */

import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { scrapeHHJobs } from './scraper';
import { logger } from '../utils/logger';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

const connection = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  // Only add username if it's explicitly provided and not 'default'
  ...(process.env.REDIS_USER && process.env.REDIS_USER !== 'default'
    ? { username: process.env.REDIS_USER }
    : {}),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tls: process.env.REDIS_SSL === 'true' ? ({ rejectUnauthorized: false } as any) : undefined,
  maxRetriesPerRequest: null,
});

// Create queue
export const scrapingQueue = new Queue('job-scraping', {
  connection,
});

// Create worker
const worker = new Worker(
  'job-scraping',
  async (job) => {
    logger.info(`Processing scraping job ${job.id}...`);
    const result = await scrapeHHJobs();

    if (result.mockJobsUsed) {
      logger.warn(`⚠️  Scraping job ${job.id} used MOCK DATA`);
      logger.warn(`   Sources used: ${result.sourcesUsed.join(', ')}`);
      logger.warn(`   Jobs: ${result.jobsScraped} scraped, ${result.jobsSaved} saved`);
    } else {
      logger.info(`✅ Scraping job ${job.id} completed successfully`);
      logger.info(`   Sources used: ${result.sourcesUsed.join(', ')}`);
      logger.info(`   Jobs: ${result.jobsScraped} scraped, ${result.jobsSaved} saved`);
    }

    if (result.errors.length > 0) {
      logger.warn(`   Errors: ${result.errors.join('; ')}`);
    }

    return result;
  },
  {
    connection,
    concurrency: 1, // Only one scraping job at a time
  }
);

worker.on('completed', (job) => {
  logger.info(`Scraping job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  logger.error(`Scraping job ${job?.id} failed:`, err);
});

/**
 * Schedule regular scraping (every hour)
 */
export async function scheduleRegularScraping(): Promise<void> {
  // Remove existing repeatable jobs
  const repeatableJobs = await scrapingQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await scrapingQueue.removeRepeatableByKey(job.key);
  }

  // Add new repeatable job (every hour)
  await scrapingQueue.add(
    'scrape-jobs',
    {},
    {
      repeat: {
        pattern: '0 * * * *', // Every hour at minute 0 (cron format)
      },
      jobId: 'hourly-scraping',
    }
  );

  logger.info('Scheduled hourly job scraping');
}

/**
 * Trigger immediate scraping
 */
export async function triggerScraping(): Promise<void> {
  await scrapingQueue.add('scrape-jobs', {});
  logger.info('Triggered immediate job scraping');
}

/**
 * Close queue connections (for graceful shutdown)
 */
export async function closeQueue(): Promise<void> {
  await worker.close();
  await scrapingQueue.close();
  await connection.quit();
}
