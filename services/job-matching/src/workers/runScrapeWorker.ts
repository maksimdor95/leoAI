/**
 * Dedicated scrape worker process (Phase 2).
 *
 * Usage:
 *   SCRAPE_INLINE_WORKER=false PORT=3004 npm run dev   # API without embedded worker
 *   npm run worker:scrape                              # this process
 *
 * Or keep default inline worker for local DX (API embeds the consumer).
 */

import dotenv from 'dotenv';
dotenv.config();

import { createScrapingWorker } from '../services/scrapingQueue';
import { logger } from '../utils/logger';

logger.info('Starting dedicated scraping worker process...');
const worker = createScrapingWorker();
logger.info('Dedicated scraping worker ready (queue=job-scraping)');

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, closing scrape worker...`);
  await worker.close();
  process.exit(0);
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
