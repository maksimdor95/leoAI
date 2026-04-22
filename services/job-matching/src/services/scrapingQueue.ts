/**
 * Scraping Queue Service
 * Manages background job scraping using BullMQ.
 *
 * Очередь принимает optional payload `{ keywords, locationId, userId }` —
 * scraper собирает вакансии по кастомным кейвордам (например, из профиля
 * пользователя). Без payload используется `DEFAULT_SEED_KEYWORDS` из scraper'а.
 */

import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { scrapeHHJobs, DEFAULT_SEED_KEYWORDS } from './scraper';
import { logger } from '../utils/logger';
import { ioredisTlsOptions } from '../utils/redisTls';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

const connection = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  ...(process.env.REDIS_USER && process.env.REDIS_USER !== 'default'
    ? { username: process.env.REDIS_USER }
    : {}),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tls: ioredisTlsOptions() as any,
  maxRetriesPerRequest: null,
});

export interface ScrapingJobPayload {
  /** Ключевые слова для scraper'а. Если пусто — используются дефолтные. */
  keywords?: string[];
  /** HH area id. По умолчанию 113 (вся Россия). */
  locationId?: number;
  /** ID инициатора скрейпа — для логов и антидубликата. */
  userId?: string;
  /** Тег для метрик (e.g. 'user-profile' | 'hourly-cron' | 'manual'). */
  origin?: 'user-profile' | 'hourly-cron' | 'manual' | 'seed';
}

export const scrapingQueue = new Queue<ScrapingJobPayload>('job-scraping', {
  connection,
});

const worker = new Worker<ScrapingJobPayload>(
  'job-scraping',
  async (job) => {
    const payload = job.data || {};
    const keywords =
      Array.isArray(payload.keywords) && payload.keywords.length > 0
        ? payload.keywords
        : [...DEFAULT_SEED_KEYWORDS];
    const locationId =
      typeof payload.locationId === 'number' && payload.locationId > 0
        ? payload.locationId
        : 113;

    logger.info(
      `Processing scraping job ${job.id} origin=${payload.origin ?? 'unspecified'} ` +
        `userId=${payload.userId ?? '-'} locationId=${locationId} ` +
        `keywords=[${keywords.slice(0, 5).join(', ')}${keywords.length > 5 ? ', …' : ''}]`
    );

    const result = await scrapeHHJobs(keywords, locationId);

    if (result.mockJobsUsed) {
      logger.warn(
        `⚠️  Scraping job ${job.id} used MOCK DATA (sources=${result.sourcesUsed.join(', ')}, ` +
          `scraped=${result.jobsScraped}, saved=${result.jobsSaved})`
      );
    } else {
      logger.info(
        `✅ Scraping job ${job.id} completed (sources=${result.sourcesUsed.join(', ')}, ` +
          `scraped=${result.jobsScraped}, saved=${result.jobsSaved})`
      );
    }

    if (result.errors.length > 0) {
      logger.warn(`   Errors: ${result.errors.join('; ')}`);
    }

    return result;
  },
  {
    connection,
    concurrency: 1,
  }
);

worker.on('completed', (job) => {
  logger.info(`Scraping job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  logger.error(`Scraping job ${job?.id} failed:`, err);
});

/**
 * Schedule regular scraping (every hour) with the diverse default keyword set.
 */
export async function scheduleRegularScraping(): Promise<void> {
  const repeatableJobs = await scrapingQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await scrapingQueue.removeRepeatableByKey(job.key);
  }

  await scrapingQueue.add(
    'scrape-jobs',
    { origin: 'hourly-cron' },
    {
      repeat: {
        pattern: '0 * * * *',
      },
      jobId: 'hourly-scraping',
    }
  );

  logger.info('Scheduled hourly job scraping (diverse default keyword set)');
}

/**
 * Триггер общего скрейпа (без привязки к пользователю).
 * Сохраняем обратную совместимость с refreshJobs endpoint.
 */
export async function triggerScraping(payload?: ScrapingJobPayload): Promise<void> {
  const data: ScrapingJobPayload = {
    origin: payload?.origin ?? 'manual',
    keywords: payload?.keywords,
    locationId: payload?.locationId,
    userId: payload?.userId,
  };
  await scrapingQueue.add('scrape-jobs', data);
  logger.info(
    `Triggered scraping origin=${data.origin} userId=${data.userId ?? '-'} ` +
      `keywords=${data.keywords?.length ?? 'default'}`
  );
}

/**
 * Close queue connections (for graceful shutdown).
 */
export async function closeQueue(): Promise<void> {
  await worker.close();
  await scrapingQueue.close();
  await connection.quit();
}
