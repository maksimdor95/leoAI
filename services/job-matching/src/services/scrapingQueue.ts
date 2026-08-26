/**
 * Scraping + enrichment queue (BullMQ).
 *
 * Phase 2 DoD: HTTP never scrapes in-process. Default SCRAPE_INLINE_WORKER is OFF —
 * API only enqueues; a dedicated `npm run worker:scrape` consumes jobs.
 * Phase 3: repeatable `enrich-jobs` + lazy enrich from match path.
 */

import { Queue, Worker, type Job } from 'bullmq';
import Redis from 'ioredis';
import {
  scrapeCatalog,
  DEFAULT_SEED_KEYWORDS,
  type ScrapeFamilyId,
  type ScrapeResult,
} from './scraper';
import { scrapeMedCatalog } from './med/scrapeMed';
import { enrichJobsMissingEmbeddings, enrichJobsFromEntities } from './enrichment';
import {
  revalidateStaleJobs,
  getRevalidateLimit,
} from './revalidate/runRevalidate';
import type { Job as JobEntity } from '../models/job';
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
  keywords?: string[];
  locationId?: number;
  userId?: string;
  origin?: 'user-profile' | 'hourly-cron' | 'manual' | 'seed' | 'extended-only' | 'med-only';
  families?: ScrapeFamilyId[];
  enrich?: boolean;
  enrichExtended?: boolean;
  includeTg?: boolean;
}

export interface EnrichJobPayload {
  limit?: number;
}

export interface RevalidateJobPayload {
  limit?: number;
  olderThanHours?: number;
  sources?: string[];
}

type QueuePayload = ScrapingJobPayload | EnrichJobPayload | RevalidateJobPayload;

export const scrapingQueue = new Queue<QueuePayload>('job-scraping', {
  connection,
});

const FAMILY_SET = new Set<ScrapeFamilyId>(['hh', 'superjob', 'extended']);

function normalizeFamilies(raw: unknown): ScrapeFamilyId[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const families = raw.filter(
    (f): f is ScrapeFamilyId => typeof f === 'string' && FAMILY_SET.has(f as ScrapeFamilyId)
  );
  return families.length > 0 ? families : undefined;
}

async function processScrapePayload(payload: ScrapingJobPayload, jobId?: string): Promise<ScrapeResult> {
  if (payload.origin === 'med-only') {
    logger.info(`Processing Med scraping job ${jobId}`);
    const result = await scrapeMedCatalog({
      keywords: payload.keywords,
      locationId: payload.locationId,
      includeTg: payload.includeTg !== false,
    });
    logger.info(
      `✅ Med scrape ${jobId}: enabled=${result.medEnabled} scraped=${result.jobsScraped} saved=${result.jobsSaved}`
    );
    if (result.errors.length > 0) {
      logger.warn(`   Med errors: ${result.errors.join('; ')}`);
    }
    return result;
  }

  const keywords =
    Array.isArray(payload.keywords) && payload.keywords.length > 0
      ? payload.keywords
      : [...DEFAULT_SEED_KEYWORDS];
  const locationId =
    typeof payload.locationId === 'number' && payload.locationId > 0
      ? payload.locationId
      : 113;
  const families = normalizeFamilies(payload.families);
  const extendedOnly = families?.length === 1 && families[0] === 'extended';

  logger.info(
    `Processing scraping job ${jobId} origin=${payload.origin ?? 'unspecified'} ` +
      `userId=${payload.userId ?? '-'} locationId=${locationId} ` +
      `families=${families?.join(',') ?? 'all'} ` +
      `keywords=[${keywords.slice(0, 5).join(', ')}${keywords.length > 5 ? ', …' : ''}]`
  );

  const result = await scrapeCatalog(keywords, locationId, {
    families,
    enrich: payload.enrich,
    enrichExtended: payload.enrichExtended,
    allowMockFallback: extendedOnly ? false : undefined,
  });

  if (result.mockJobsUsed) {
    logger.warn(
      `⚠️  Scraping job ${jobId} used MOCK DATA (sources=${result.sourcesUsed.join(', ')}, ` +
        `scraped=${result.jobsScraped}, saved=${result.jobsSaved})`
    );
  } else {
    logger.info(
      `✅ Scraping job ${jobId} completed (sources=${result.sourcesUsed.join(', ')}, ` +
        `scraped=${result.jobsScraped}, saved=${result.jobsSaved})`
    );
  }

  if (result.bySource) {
    logger.info(`ScrapeReport bySource=${JSON.stringify(result.bySource)}`);
  }
  if (result.errors.length > 0) {
    logger.warn(`   Errors: ${result.errors.join('; ')}`);
  }

  return result;
}

async function processQueueJob(job: Job<QueuePayload>): Promise<unknown> {
  if (job.name === 'enrich-jobs') {
    const payload = (job.data || {}) as EnrichJobPayload;
    const limit = Math.min(100, Math.max(5, payload.limit ?? 40));
    logger.info(`Processing enrich-jobs ${job.id} limit=${limit}`);
    const result = await enrichJobsMissingEmbeddings(limit);
    logger.info(
      `✅ enrich-jobs ${job.id}: attempted=${result.attempted} enriched=${result.enriched}`
    );
    return result;
  }

  if (job.name === 'revalidate-hh-jobs' || job.name === 'revalidate-jobs') {
    const payload = (job.data || {}) as RevalidateJobPayload;
    const limit = Math.min(100, Math.max(1, payload.limit ?? getRevalidateLimit()));
    logger.info(`Processing revalidate-jobs ${job.id} limit=${limit}`);
    const result = await revalidateStaleJobs({
      limit,
      olderThanHours: payload.olderThanHours,
      sources: payload.sources,
    });
    logger.info(
      `✅ revalidate-jobs ${job.id}: attempted=${result.attempted} ` +
        `refreshed=${result.refreshed} archived=${result.archived} errors=${result.errors}`
    );
    return result;
  }

  return processScrapePayload((job.data || {}) as ScrapingJobPayload, job.id);
}

/**
 * Create a BullMQ worker for scrape + enrich jobs.
 */
export function createScrapingWorker(): Worker<QueuePayload> {
  const worker = new Worker<QueuePayload>('job-scraping', processQueueJob, {
    connection,
    concurrency: 1,
  });

  worker.on('completed', (job) => {
    logger.info(`Queue job ${job.id} (${job.name}) completed successfully`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Queue job ${job?.id} (${job?.name}) failed:`, err);
  });

  return worker;
}

/**
 * Phase 2 DoD: inline worker OFF by default.
 * Opt-in only: SCRAPE_INLINE_WORKER=true (not recommended for local/prod resilience).
 */
const INLINE_WORKER = process.env.SCRAPE_INLINE_WORKER === 'true';

let scrapingWorker: Worker<QueuePayload> | null = null;

export function startInlineScrapingWorkerIfEnabled(): Worker<QueuePayload> | null {
  if (!INLINE_WORKER) {
    logger.info(
      'Scraping worker NOT inline (default). Dedicated process: npm run worker:scrape'
    );
    return null;
  }
  if (!scrapingWorker) {
    scrapingWorker = createScrapingWorker();
    logger.warn(
      'Scraping worker started INLINE (SCRAPE_INLINE_WORKER=true) — API shares process with scrape'
    );
  }
  return scrapingWorker;
}

/**
 * Phase 4: separate family crons + Phase 3 enrich cron.
 */
export async function scheduleRegularScraping(): Promise<void> {
  const repeatableJobs = await scrapingQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await scrapingQueue.removeRepeatableByKey(job.key);
  }

  await scrapingQueue.add(
    'scrape-jobs',
    { origin: 'hourly-cron', families: ['hh'] },
    { repeat: { pattern: '0 * * * *' }, jobId: 'hourly-scraping-hh' }
  );

  await scrapingQueue.add(
    'scrape-jobs',
    { origin: 'hourly-cron', families: ['superjob'] },
    { repeat: { pattern: '15 * * * *' }, jobId: 'hourly-scraping-sj' }
  );

  await scrapingQueue.add(
    'scrape-jobs',
    { origin: 'hourly-cron', families: ['extended'] },
    { repeat: { pattern: '30 */2 * * *' }, jobId: 'hourly-scraping-extended' }
  );

  await scrapingQueue.add(
    'enrich-jobs',
    { limit: 40 } satisfies EnrichJobPayload,
    { repeat: { pattern: '*/20 * * * *' }, jobId: 'enrich-pending' }
  );

  await scrapingQueue.add(
    'revalidate-jobs',
    { limit: getRevalidateLimit() } satisfies RevalidateJobPayload,
    { repeat: { pattern: '45 * * * *' }, jobId: 'revalidate-jobs-hourly' }
  );

  logger.info(
    'Scheduled: HH@:00, SuperJob@:15, Extended every 2h@:30, enrich every 20m, revalidate boards+career@:45'
  );
}

export async function triggerScraping(payload?: ScrapingJobPayload): Promise<void> {
  const data: ScrapingJobPayload = {
    origin: payload?.origin ?? 'manual',
    keywords: payload?.keywords,
    locationId: payload?.locationId,
    userId: payload?.userId,
    families: payload?.families,
    enrich: payload?.enrich,
    enrichExtended: payload?.enrichExtended,
    includeTg: payload?.includeTg,
  };
  await scrapingQueue.add('scrape-jobs', data);
  logger.info(
    `Triggered scraping origin=${data.origin} userId=${data.userId ?? '-'} ` +
      `families=${data.families?.join(',') ?? 'all'} ` +
      `keywords=${data.keywords?.length ?? 'default'}`
  );
}

export async function triggerEnrichment(limit: number = 40): Promise<void> {
  await scrapingQueue.add('enrich-jobs', { limit } satisfies EnrichJobPayload);
  logger.info(`Triggered enrich-jobs limit=${limit}`);
}

export async function triggerHhRevalidate(limit?: number): Promise<void> {
  const payload: RevalidateJobPayload = {
    limit: limit ?? getRevalidateLimit(),
  };
  await scrapingQueue.add('revalidate-jobs', payload);
  logger.info(`Triggered revalidate-jobs limit=${payload.limit}`);
}

export async function triggerRevalidate(limit?: number, sources?: string[]): Promise<void> {
  const payload: RevalidateJobPayload = {
    limit: limit ?? getRevalidateLimit(),
    sources,
  };
  await scrapingQueue.add('revalidate-jobs', payload);
  logger.info(
    `Triggered revalidate-jobs limit=${payload.limit} sources=${sources?.join(',') ?? 'all'}`
  );
}

/**
 * Phase 3 lazy path: after match, enrich shown jobs missing embeddings (fire-and-forget).
 */
export function scheduleLazyEnrichForMatchJobs(jobs: JobEntity[]): void {
  const need = jobs.filter((j) => !j.embedding || j.embedding.length === 0).slice(0, 25);
  if (need.length === 0) return;
  void enrichJobsFromEntities(need)
    .then((r) => {
      if (r.enriched > 0) {
        logger.info(`Lazy enrich after match: enriched=${r.enriched}/${need.length}`);
      }
    })
    .catch((err: unknown) => {
      logger.warn(
        'Lazy enrich after match failed:',
        err instanceof Error ? err.message : String(err)
      );
    });
}

export async function closeQueue(): Promise<void> {
  if (scrapingWorker) {
    await scrapingWorker.close();
  }
  await scrapingQueue.close();
  await connection.quit();
}
