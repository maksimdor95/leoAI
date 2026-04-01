/**
 * Scraper Worker
 * Background worker for job scraping using BullMQ
 */

import { Worker } from 'bullmq';
import { scrapeHHJobs } from '../services/scraper';
import { logger } from '../utils/logger';

const SCRAPER_QUEUE_NAME = 'job-scraping';

interface ScraperJobData {
  source?: string;
}

/**
 * Create scraper worker
 */
export function createScraperWorker(): Worker<ScraperJobData> {
  const worker = new Worker<ScraperJobData>(
    SCRAPER_QUEUE_NAME,
    async (job) => {
      logger.info(`Processing scraping job ${job.id}...`);

      try {
        // Run scrapers (scrapeHHJobs already saves jobs to database)
        const result = await scrapeHHJobs();

        if (result.mockJobsUsed) {
          logger.warn(`⚠️  Scraping job ${job.id} used MOCK DATA`);
          logger.warn(`   Sources used: ${result.sourcesUsed.join(', ')}`);
        } else {
          logger.info(`✅ Scraping job ${job.id} completed successfully`);
          logger.info(`   Sources used: ${result.sourcesUsed.join(', ')}`);
        }

        logger.info(
          `Scraping job ${job.id} completed: ${result.jobsScraped} scraped, ${result.jobsSaved} saved`
        );

        if (result.errors.length > 0) {
          logger.warn(`   Errors: ${result.errors.join('; ')}`);
        }

        return {
          scraped: result.jobsScraped,
          saved: result.jobsSaved,
          skipped: result.jobsScraped - result.jobsSaved,
        };
      } catch (error: unknown) {
        logger.error(`Error processing scraping job ${job.id}:`, error);
        throw error;
      }
    },
    {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0', 10),
      },
      concurrency: 1, // Process one scraping job at a time
      removeOnComplete: {
        count: 100, // Keep last 100 completed jobs
        age: 24 * 3600, // 24 hours
      },
      removeOnFail: {
        count: 1000, // Keep last 1000 failed jobs
      },
    }
  );

  worker.on('completed', (job) => {
    logger.info(`Scraping job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Scraping job ${job?.id} failed:`, err);
  });

  return worker;
}

/**
 * Start scraper worker (for running as separate process)
 */
if (require.main === module) {
  logger.info('Starting scraper worker...');
  const worker = createScraperWorker();
  logger.info('Scraper worker started');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing worker...');
    await worker.close();
    process.exit(0);
  });
}
