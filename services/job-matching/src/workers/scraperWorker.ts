/**
 * @deprecated Use `npm run worker:scrape` → src/workers/runScrapeWorker.ts
 * Kept so old docs/scripts that import createScraperWorker still resolve.
 */

export { createScrapingWorker as createScraperWorker } from '../services/scrapingQueue';
