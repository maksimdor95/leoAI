/**
 * Job Scraper Service
 * Scrapes jobs from various sources
 */

import axios from 'axios';
import { JobInput } from '../models/job';
import jobRepository from '../models/jobRepository';
import { logger } from '../utils/logger';
import { retry, isRetryableError } from '../utils/retry';
import { getHHApplicationToken, getHHUserAgent, hasHHAuthConfig } from './hhAuthService';
import { buildHhVacancyUrl } from '../utils/vacancyUrl';
import { extractHhVacancyMeta, mapHhWorkMode } from '../utils/hhVacancyMeta';
import { uniqueLocationLabels } from '../utils/locationLabels';
import { enrichJobWithLLM } from './enrichment';
import { classifyRoleFamily } from './roleFamily';
import { scrapeExtendedSources } from './connectors';

const HH_API_URL = process.env.HH_API_URL || 'https://api.hh.ru';
const SUPERJOB_API_URL = process.env.SUPERJOB_API_URL || 'https://api.superjob.ru/2.0';
const SCRAPER_USER_AGENT = process.env.SCRAPER_USER_AGENT || getHHUserAgent();
const USE_MOCK_JOBS = process.env.USE_MOCK_JOBS === 'true';

function buildHHApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': SCRAPER_USER_AGENT,
    'HH-User-Agent': SCRAPER_USER_AGENT,
  };
  const appToken = getHHApplicationToken();
  if (appToken) {
    headers.Authorization = `Bearer ${appToken}`;
  }
  return headers;
}

/** Москва в справочнике SuperJob `/towns/` (не путать с area id HeadHunter). */
const SUPERJOB_DEFAULT_TOWN_ID = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Город(а) для поиска SuperJob: SUPERJOB_TOWN_IDS="4,14" → параметр `t[]`,
 * иначе SUPERJOB_TOWN или дефолт Москва.
 */
function getSuperJobLocationParams(): Record<string, string | number | number[]> {
  const raw = process.env.SUPERJOB_TOWN_IDS?.trim();
  if (raw) {
    const ids = raw
      .split(/[,;\s]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length === 0) {
      return { town: SUPERJOB_DEFAULT_TOWN_ID };
    }
    if (ids.length === 1) {
      return { town: ids[0] };
    }
    return { t: ids };
  }
  const single = parseInt(process.env.SUPERJOB_TOWN || String(SUPERJOB_DEFAULT_TOWN_ID), 10);
  return { town: Number.isFinite(single) && single > 0 ? single : SUPERJOB_DEFAULT_TOWN_ID };
}

function getHHScraperLimits(): {
  keywordLimit: number;
  maxPages: number;
  perPage: number;
  maxVacanciesPerKeyword: number;
  detailDelayMs: number;
} {
  const keywordLimit = Math.min(
    8,
    Math.max(1, parseInt(process.env.HH_KEYWORD_LIMIT || '5', 10) || 5)
  );
  const maxPages = Math.min(
    5,
    Math.max(1, parseInt(process.env.HH_MAX_PAGES || '3', 10) || 3)
  );
  const perPage = 100;
  const rawCap = parseInt(process.env.HH_MAX_VACANCIES_PER_KEYWORD || '40', 10);
  const maxVacanciesPerKeyword =
    Number.isFinite(rawCap) && rawCap > 0 ? Math.min(60, rawCap) : 40;
  const detailDelayMs = Math.max(0, parseInt(process.env.HH_REQUEST_DELAY_MS || '200', 10) || 200);

  return { keywordLimit, maxPages, perPage, maxVacanciesPerKeyword, detailDelayMs };
}

function getSuperJobScraperLimits(): {
  keywordLimit: number;
  pageSize: number;
  maxPages: number;
  delayMs: number;
  maxVacanciesPerKeyword: number;
} {
  const keywordLimit = Math.min(
    50,
    Math.max(1, parseInt(process.env.SUPERJOB_KEYWORD_LIMIT || '10', 10) || 10)
  );
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(process.env.SUPERJOB_PAGE_SIZE || '100', 10) || 100)
  );
  const maxPages = Math.min(
    500,
    Math.max(1, parseInt(process.env.SUPERJOB_MAX_PAGES || '5', 10) || 5)
  );
  const delayMs = Math.max(0, parseInt(process.env.SUPERJOB_REQUEST_DELAY_MS || '550', 10) || 550);
  const rawCap = parseInt(process.env.SUPERJOB_MAX_VACANCIES_PER_KEYWORD || '0', 10);
  const maxVacanciesPerKeyword =
    Number.isFinite(rawCap) && rawCap > 0 ? rawCap : maxPages * pageSize;

  return { keywordLimit, pageSize, maxPages, delayMs, maxVacanciesPerKeyword };
}

export interface ScrapeResult {
  success: boolean;
  jobsScraped: number;
  jobsSaved: number;
  errors: string[];
  sourcesUsed: string[];
  mockJobsUsed: boolean;
  /** Per JobInput.source counts for ops/metrics (Phase 4). */
  bySource?: Record<string, { scraped: number; saved: number }>;
  familyReports?: FamilyRunReport[];
}

export interface PersistJobsOptions {
  /**
   * When true, call enrichJobWithLLM before save (slow; depends on ai-nlp).
   * Default false — Kabi-style ingest first; enrichment is a later pipeline stage.
   */
  enrich?: boolean;
}

/**
 * Persist scraped jobs one-by-one. Failures on individual rows are collected, not thrown.
 */
export async function persistScrapedJobs(
  jobs: JobInput[],
  options: PersistJobsOptions = {}
): Promise<{ saved: number; errors: string[]; bySource: Record<string, { scraped: number; saved: number }> }> {
  const enrich = options.enrich === true;
  let saved = 0;
  const errors: string[] = [];
  const bySource: Record<string, { scraped: number; saved: number }> = {};

  for (const job of jobs) {
    const src = job.source || 'unknown';
    if (!bySource[src]) bySource[src] = { scraped: 0, saved: 0 };
    bySource[src].scraped += 1;
    try {
      const isMock = job.source === 'demo';
      const toSave = !isMock && enrich ? await enrichJobWithLLM(job) : job;
      await jobRepository.createOrUpdate(toSave);
      saved += 1;
      bySource[src].saved += 1;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to save job ${job.source_url}:`, errorMsg);
      errors.push(`Failed to save job: ${errorMsg}`);
    }
  }

  return { saved, errors, bySource };
}

/**
 * Диверсифицированный дефолтный набор ключевых слов — используется только если
 * scraper вызван без явного списка (например, на первый прогон при пустой БД).
 * Раньше здесь был чисто dev-набор (JS/TS/Node/React/Python), из-за чего каталог
 * забивался только вакансиями разработки и не подходил PM/аналитикам/дизайнерам.
 */
export const DEFAULT_SEED_KEYWORDS: readonly string[] = [
  'Product Manager',
  'Менеджер продукта',
  'Product Analyst',
  'Бизнес-аналитик',
  'Data Analyst',
  'UX Designer',
  'Backend Developer',
  'Frontend Developer',
  'QA Engineer',
  'DevOps Engineer',
];

/**
 * Scrape jobs from configured source families in parallel (fail-open).
 * Each family persists as soon as it finishes — HH failure cannot block SJ/extended.
 * Legacy name `scrapeHHJobs` kept for callers; prefer `scrapeCatalog`.
 */
export async function scrapeHHJobs(
  keywords: string[] = [...DEFAULT_SEED_KEYWORDS],
  locationId: number = 113 // Россия (HH area). Города сужают выборку слишком сильно.
): Promise<ScrapeResult> {
  return scrapeCatalog(keywords, locationId);
}

export type ScrapeFamilyId = 'hh' | 'superjob' | 'extended';

export interface ScrapeCatalogOptions {
  families?: ScrapeFamilyId[];
  /** Enrich HH/SJ batches. Default: ENRICH_ON_SCRAPE=true only (Phase 3: off). */
  enrich?: boolean;
  /** Enrich extended batches. Default: ENRICH_EXTENDED_ON_SCRAPE=true only. */
  enrichExtended?: boolean;
  /** Dev mock fallback when every family returns nothing (default true). */
  allowMockFallback?: boolean;
  /** Injectable fetchers for unit tests. */
  fetchHh?: (keywords: string[], locationId: number) => Promise<JobInput[]>;
  fetchSj?: (keywords: string[]) => Promise<JobInput[]>;
  fetchExtended?: typeof scrapeExtendedSources;
  persist?: typeof persistScrapedJobs;
}

export interface FamilyRunReport {
  family: ScrapeFamilyId;
  scraped: number;
  saved: number;
  sourcesUsed: string[];
  errors: string[];
  ms: number;
  bySource?: Record<string, { scraped: number; saved: number }>;
}

function familyTimeoutMs(family: ScrapeFamilyId): number {
  const defaults: Record<ScrapeFamilyId, number> = {
    hh: 10 * 60 * 1000,
    superjob: 8 * 60 * 1000,
    extended: 6 * 60 * 1000,
  };
  const envKeys: Record<ScrapeFamilyId, string> = {
    hh: 'SCRAPE_HH_TIMEOUT_MS',
    superjob: 'SCRAPE_SJ_TIMEOUT_MS',
    extended: 'SCRAPE_EXTENDED_TIMEOUT_MS',
  };
  const raw = parseInt(process.env[envKeys[family]] || '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : defaults[family];
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Phase 1 orchestrator: HH | SuperJob | Extended via allSettled + per-family persist.
 */
export async function scrapeCatalog(
  keywords: string[] = [...DEFAULT_SEED_KEYWORDS],
  locationId: number = 113,
  options: ScrapeCatalogOptions = {}
): Promise<ScrapeResult> {
  const result: ScrapeResult = {
    success: false,
    jobsScraped: 0,
    jobsSaved: 0,
    errors: [],
    sourcesUsed: [],
    mockJobsUsed: false,
    bySource: {},
    familyReports: [],
  };

  const families: ScrapeFamilyId[] = options.families ?? ['hh', 'superjob', 'extended'];
  // Phase 3: enrich off by default (ENRICH_ON_SCRAPE=true or options.enrich=true to opt in).
  const enrich =
    options.enrich === true ||
    (options.enrich === undefined && process.env.ENRICH_ON_SCRAPE === 'true');
  const enrichExtended =
    options.enrichExtended === true ||
    (options.enrichExtended === undefined &&
      process.env.ENRICH_EXTENDED_ON_SCRAPE === 'true');
  const allowMockFallback = options.allowMockFallback !== false;
  const persist = options.persist ?? persistScrapedJobs;
  const fetchHh = options.fetchHh ?? scrapeHHViaAPI;
  const fetchSj = options.fetchSj ?? scrapeSuperJobViaAPI;
  const fetchExtended = options.fetchExtended ?? scrapeExtendedSources;

  try {
    logger.info(
      `Starting catalog scrape (families=${families.join(',')}, enrich=${enrich}, ` +
        `enrichExtended=${enrichExtended}, keywords=${keywords.slice(0, 5).join(', ')}…)`
    );

    if (USE_MOCK_JOBS) {
      logger.info('USE_MOCK_JOBS is enabled - generating mock jobs only');
      const mockJobs = generateMockJobs(keywords);
      const persisted = await persist(mockJobs, { enrich: false });
      result.jobsScraped = mockJobs.length;
      result.jobsSaved = persisted.saved;
      result.errors.push(...persisted.errors);
      result.mockJobsUsed = true;
      result.sourcesUsed.push('mock');
      result.success = result.jobsSaved > 0;
      return result;
    }

    const runFamily = async (family: ScrapeFamilyId): Promise<FamilyRunReport> => {
      const started = Date.now();
      const report: FamilyRunReport = {
        family,
        scraped: 0,
        saved: 0,
        sourcesUsed: [],
        errors: [],
        ms: 0,
      };

      if (family === 'hh') {
        if (!hasHHAuthConfig()) {
          logger.info('HH auth is not configured — skipping HH family');
          report.ms = Date.now() - started;
          return report;
        }
        logger.info('Attempting to scrape jobs from HH.ru API...');
        const jobs = await fetchHh(keywords, locationId);
        report.scraped = jobs.length;
        if (jobs.length > 0) {
          report.sourcesUsed.push('hh.ru-api');
          const persisted = await persist(jobs, { enrich });
          report.saved = persisted.saved;
          report.errors.push(...persisted.errors);
          report.bySource = persisted.bySource;
          logger.info(`HH family: scraped=${jobs.length} saved=${persisted.saved}`);
        } else {
          logger.info('HH.ru API returned no jobs');
        }
      } else if (family === 'superjob') {
        if (!process.env.SUPERJOB_API_KEY) {
          logger.info('SUPERJOB_API_KEY not set — skipping SuperJob family');
          report.ms = Date.now() - started;
          return report;
        }
        logger.info('Attempting to scrape jobs from SuperJob API...');
        const jobs = await fetchSj(keywords);
        report.scraped = jobs.length;
        if (jobs.length > 0) {
          report.sourcesUsed.push('superjob-api');
          const persisted = await persist(jobs, { enrich });
          report.saved = persisted.saved;
          report.errors.push(...persisted.errors);
          report.bySource = persisted.bySource;
          logger.info(`SuperJob family: scraped=${jobs.length} saved=${persisted.saved}`);
        } else {
          logger.info('SuperJob API returned no jobs');
        }
      } else {
        // Extended: persist after each connector (Kabi); enrich opt-in via enrichExtended.
        let saved = 0;
        const bySource: Record<string, { scraped: number; saved: number }> = {};
        const extended = await fetchExtended(keywords, {
          afterConnector: async ({ connectorId, jobs }) => {
            if (jobs.length === 0) return;
            const persisted = await persist(jobs, { enrich: enrichExtended });
            saved += persisted.saved;
            report.errors.push(...persisted.errors);
            for (const [src, counts] of Object.entries(persisted.bySource)) {
              if (!bySource[src]) bySource[src] = { scraped: 0, saved: 0 };
              bySource[src].scraped += counts.scraped;
              bySource[src].saved += counts.saved;
            }
            logger.info(
              `Extended source ${connectorId}: persisted ${persisted.saved}/${jobs.length}`
            );
          },
        });
        report.scraped = extended.jobs.length;
        report.saved = saved;
        report.bySource = bySource;
        report.sourcesUsed.push(...extended.sourcesUsed);
        report.errors.push(...extended.errors);
        logger.info(
          `Extended family: scraped=${extended.jobs.length} saved=${saved} ` +
            `sources=${extended.sourcesUsed.join(',') || '(none)'}`
        );
      }

      report.ms = Date.now() - started;
      return report;
    };

    const settled = await Promise.allSettled(
      families.map((family) =>
        withTimeout(runFamily(family), familyTimeoutMs(family), `${family} family`)
      )
    );

    const reports: FamilyRunReport[] = [];
    for (let i = 0; i < settled.length; i += 1) {
      const family = families[i];
      const outcome = settled[i];
      if (outcome.status === 'fulfilled') {
        reports.push(outcome.value);
      } else {
        const msg =
          outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
        logger.warn(`Catalog family ${family} failed: ${msg}`);
        result.errors.push(`${family}: ${msg}`);
        reports.push({
          family,
          scraped: 0,
          saved: 0,
          sourcesUsed: [],
          errors: [msg],
          ms: 0,
        });
      }
    }

    for (const report of reports) {
      result.jobsScraped += report.scraped;
      result.jobsSaved += report.saved;
      result.sourcesUsed.push(...report.sourcesUsed);
      result.errors.push(...report.errors);
      if (report.bySource) {
        for (const [src, counts] of Object.entries(report.bySource)) {
          if (!result.bySource![src]) result.bySource![src] = { scraped: 0, saved: 0 };
          result.bySource![src].scraped += counts.scraped;
          result.bySource![src].saved += counts.saved;
        }
      }
      logger.info(
        `Family report ${report.family}: scraped=${report.scraped} saved=${report.saved} ms=${report.ms}`
      );
    }
    result.familyReports = reports;
    logger.info(`ScrapeReport ${JSON.stringify({ bySource: result.bySource, families: reports.map((r) => ({ family: r.family, scraped: r.scraped, saved: r.saved, ms: r.ms })) })}`);


    if (result.jobsSaved === 0 && result.jobsScraped === 0) {
      logger.warn('All job source families failed or returned no jobs');
      if (allowMockFallback) {
        const isProduction = process.env.NODE_ENV === 'production';
        if (isProduction) {
          result.errors.push(
            'No jobs found from real sources and mock jobs are disabled in production'
          );
        } else {
          logger.warn('Development mode: Using mock jobs as fallback since all sources failed');
          const mockJobs = generateMockJobs(keywords);
          const persisted = await persist(mockJobs, { enrich: false });
          result.jobsScraped = mockJobs.length;
          result.jobsSaved = persisted.saved;
          result.errors.push(...persisted.errors);
          result.mockJobsUsed = true;
          result.sourcesUsed.push('mock-fallback');
        }
      } else if (families.length === 1 && families[0] === 'extended') {
        result.errors.push(
          'No extended jobs fetched (flag off, empty connectors, or keyword filters)'
        );
      }
    }

    result.success = result.jobsSaved > 0;

    if (result.mockJobsUsed) {
      logger.warn(
        `⚠️  Job scraping completed using MOCK DATA: ${result.jobsScraped} generated, ${result.jobsSaved} saved`
      );
      logger.warn(`   Sources used: ${result.sourcesUsed.join(', ')}`);
    } else {
      logger.info(
        `✅ Catalog scrape completed: scraped=${result.jobsScraped} saved=${result.jobsSaved}`
      );
      logger.info(`   Sources used: ${result.sourcesUsed.join(', ') || '(none)'}`);
    }
  } catch (error: unknown) {
    logger.error('Job scraping failed:', error);
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}

/**
 * Extended-only ingest (Phase 0 pipeline refactor).
 * Does not touch HH/SJ. Persists after each connector (Kabi early-save).
 * Enrichment off by default so a slow/dead ai-nlp cannot block catalog fill.
 */
export async function scrapeExtendedOnly(
  keywords: string[] = [...DEFAULT_SEED_KEYWORDS],
  options: PersistJobsOptions = {}
): Promise<ScrapeResult> {
  return scrapeCatalog(keywords, 113, {
    families: ['extended'],
    enrichExtended: options.enrich === true,
    allowMockFallback: false,
  });
}

/**
 * Scrape jobs via HH.ru API (if API key is available)
 */
async function scrapeHHViaAPI(keywords: string[], locationId: number): Promise<JobInput[]> {
  const jobs: JobInput[] = [];
  const { keywordLimit, maxPages, perPage, maxVacanciesPerKeyword, detailDelayMs } =
    getHHScraperLimits();

  if (!getHHApplicationToken()) {
    logger.warn(
      'HH vacancy search needs HH_API_KEY (application token «Токен приложения» on dev.hh.ru, APPL…)'
    );
    return jobs;
  }

  const hhHeaders = buildHHApiHeaders();
  logger.info(
    `HH scrape: keywords≤${keywordLimit}, pages=${maxPages}, perPage=${perPage}, max/keyword=${maxVacanciesPerKeyword}`
  );

  for (const keyword of keywords.slice(0, keywordLimit)) {
    let collectedForKeyword = 0;
    try {
      for (let page = 0; page < maxPages; page += 1) {
        if (collectedForKeyword >= maxVacanciesPerKeyword) {
          break;
        }

        const response = await retry(
          () =>
            axios.get(`${HH_API_URL}/vacancies`, {
              params: {
                text: keyword,
                area: locationId,
                per_page: perPage,
                page,
              },
              headers: hhHeaders,
              timeout: 10000,
            }),
          {
            maxRetries: 3,
            initialDelay: 1000,
            maxDelay: 5000,
            onRetry: (error, attempt) => {
              if (isRetryableError(error)) {
                logger.warn(
                  `Retrying HH.ru API request for keyword "${keyword}" page ${page} (attempt ${attempt})`
                );
              }
            },
          }
        );

        const vacancies = response.data.items || [];
        logger.info(
          `Found ${vacancies.length} vacancies for keyword "${keyword}" (page ${page})`
        );

        if (vacancies.length === 0) {
          break;
        }

        for (const vacancy of vacancies) {
          if (collectedForKeyword >= maxVacanciesPerKeyword) {
            break;
          }

          try {
            const vacancyDetail = await fetchHhVacancyDetails(vacancy.id);
            if (vacancyDetail) {
              jobs.push(vacancyDetail);
              collectedForKeyword += 1;
            }
          } catch (error: unknown) {
            logger.warn(`Failed to fetch details for vacancy ${vacancy.id}:`, error);
          }

          await sleep(detailDelayMs);
        }

        if (vacancies.length < perPage) {
          break;
        }
      }
    } catch (error: unknown) {
      logger.warn(`Failed to scrape keyword ${keyword}:`, error);
    }
  }

  return jobs;
}

/**
 * Scrape jobs via SuperJob API (пагинация page + count, лимиты через env).
 * Docs: https://api.superjob.ru/ — списки: page, count (1–100), total/more.
 */
async function scrapeSuperJobViaAPI(keywords: string[]): Promise<JobInput[]> {
  const jobs: JobInput[] = [];
  const apiKey = process.env.SUPERJOB_API_KEY;

  if (!apiKey) {
    return jobs;
  }

  const loc = getSuperJobLocationParams();
  const { keywordLimit, pageSize, maxPages, delayMs, maxVacanciesPerKeyword } =
    getSuperJobScraperLimits();

  logger.info(
    `SuperJob scrape: keywords≤${keywordLimit}, count=${pageSize}, maxPages=${maxPages}, delay=${delayMs}ms, max/keyword=${maxVacanciesPerKeyword}, location=${JSON.stringify(loc)}`
  );

  for (const keyword of keywords.slice(0, keywordLimit)) {
    let collectedForKeyword = 0;
    try {
      for (let page = 0; page < maxPages; page += 1) {
        if (collectedForKeyword >= maxVacanciesPerKeyword) {
          break;
        }

        const response = await retry(
          () =>
            axios.get(`${SUPERJOB_API_URL}/vacancies/`, {
              params: {
                keyword,
                page,
                count: pageSize,
                ...loc,
              },
              headers: {
                'User-Agent': SCRAPER_USER_AGENT,
                'X-Api-App-Id': apiKey,
                Authorization: process.env.SUPERJOB_ACCESS_TOKEN
                  ? `Bearer ${process.env.SUPERJOB_ACCESS_TOKEN}`
                  : undefined,
              },
              timeout: 15000,
            }),
          {
            maxRetries: 3,
            initialDelay: 1000,
            maxDelay: 5000,
            onRetry: (error, attempt) => {
              if (isRetryableError(error)) {
                logger.warn(
                  `Retrying SuperJob API keyword="${keyword}" page=${page} (attempt ${attempt})`
                );
              }
            },
          }
        );

        const vacancies = Array.isArray(response.data?.objects) ? response.data.objects : [];
        const moreRaw = response.data?.more;
        const total = typeof response.data?.total === 'number' ? response.data.total : undefined;

        logger.info(
          `SuperJob keyword="${keyword}" page=${page}: objects=${vacancies.length}, total=${total ?? 'n/a'}, more=${String(moreRaw)}`
        );

        for (const vacancy of vacancies) {
          if (collectedForKeyword >= maxVacanciesPerKeyword) {
            break;
          }
          const parsed = parseSuperJobVacancy(
            vacancy as Record<string, unknown>,
            keyword
          );
          if (parsed) {
            jobs.push(parsed);
            collectedForKeyword += 1;
          }
        }

        if (vacancies.length === 0) {
          break;
        }
        let hasMorePages = false;
        if (moreRaw === true) {
          hasMorePages = true;
        } else if (moreRaw === false) {
          hasMorePages = false;
        } else {
          hasMorePages = vacancies.length >= pageSize;
        }
        if (!hasMorePages) {
          break;
        }

        if (delayMs > 0) {
          await sleep(delayMs);
        }
      }
    } catch (error: unknown) {
      logger.warn(`Failed to scrape SuperJob by keyword "${keyword}":`, error);
    }
  }

  return jobs;
}

/**
 * Parse a single SuperJob vacancy object into JobInput.
 * Field mapping based on https://api.superjob.ru/ docs v2.0:
 *   experience.id:     1=без опыта, 2=от 1 года, 3=от 3 лет, 4=от 6 лет
 *   type_of_work.id:   6=полный день, 10=неполный, 12=сменный, 13=частичная, 7=временная, 9=вахта
 *   place_of_work.id:  1=на территории работодателя, 2=на дому (remote), 3=разъездной
 */
function parseSuperJobVacancy(vacancy: Record<string, unknown>, keyword: string): JobInput | null {
  const title = (vacancy?.profession as string) || '';
  const company = (vacancy?.firm_name as string) || '';
  if (!title || !company) return null;

  const town = vacancy?.town as { title?: string } | undefined;
  const location = town?.title ? [String(town.title)] : [];

  const payFrom = vacancy?.payment_from as number | undefined;
  const payTo = vacancy?.payment_to as number | undefined;
  const salaryMin = typeof payFrom === 'number' && payFrom > 0 ? payFrom : null;
  const salaryMax = typeof payTo === 'number' && payTo > 0 ? payTo : null;
  const currency =
    typeof vacancy?.currency === 'string' && vacancy.currency.trim()
      ? vacancy.currency.trim()
      : null;

  const workText = typeof vacancy?.work === 'string' ? vacancy.work : '';
  const candidatText = typeof vacancy?.candidat === 'string' ? vacancy.candidat : '';
  const compensationText = typeof vacancy?.compensation === 'string' ? vacancy.compensation : '';
  const description = [workText, compensationText].filter(Boolean).join('\n\n');
  const requirements = candidatText || description;

  const exp = vacancy?.experience as { id?: number } | undefined;
  let experience_level: string | null = null;
  if (exp?.id) {
    if (exp.id === 1) experience_level = 'junior';
    else if (exp.id === 2) experience_level = 'junior';
    else if (exp.id === 3) experience_level = 'middle';
    else if (exp.id === 4) experience_level = 'senior';
  }

  const placeOfWork = vacancy?.place_of_work as { id?: number } | undefined;
  let work_mode: string | null = null;
  if (placeOfWork?.id) {
    if (placeOfWork.id === 2) work_mode = 'remote';
    else if (placeOfWork.id === 3) work_mode = 'hybrid';
    else work_mode = 'office';
  }

  const link = typeof vacancy?.link === 'string' && vacancy.link
    ? vacancy.link
    : `https://www.superjob.ru/vakansii/${vacancy?.id || ''}.html`;

  const datePub = vacancy?.date_published as number | undefined;

  return {
    title,
    company,
    location,
    salary_min: salaryMin,
    salary_max: salaryMax,
    currency,
    description,
    requirements,
    skills: [keyword],
    experience_level,
    work_mode,
    source: 'superjob.ru',
    source_url: link,
    role_family: classifyRoleFamily(title),
    posted_at: datePub ? new Date(datePub * 1000) : null,
  };
}

/**
 * Fetch a single SuperJob vacancy by id (revalidate / detail refresh).
 */
export async function fetchSuperJobVacancyDetails(vacancyId: string): Promise<JobInput | null> {
  const apiKey = process.env.SUPERJOB_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await axios.get(`${SUPERJOB_API_URL}/vacancies/${vacancyId}/`, {
      headers: {
        'User-Agent': SCRAPER_USER_AGENT,
        'X-Api-App-Id': apiKey,
        Authorization: process.env.SUPERJOB_ACCESS_TOKEN
          ? `Bearer ${process.env.SUPERJOB_ACCESS_TOKEN}`
          : undefined,
      },
      timeout: 10000,
      validateStatus: (s) => s < 500,
    });
    if (response.status !== 200 || !response.data || typeof response.data !== 'object') {
      return null;
    }
    return parseSuperJobVacancy(response.data as Record<string, unknown>, 'revalidate');
  } catch (error: unknown) {
    logger.warn(
      `SuperJob vacancy ${vacancyId} fetch failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}

/**
 * Fetch detailed vacancy information from HH.ru
 */
export async function fetchHhVacancyDetails(vacancyId: string): Promise<JobInput | null> {
  try {
    const response = await retry(
      () =>
        axios.get(`${HH_API_URL}/vacancies/${vacancyId}`, {
          headers: buildHHApiHeaders(),
          timeout: 5000,
        }),
      {
        maxRetries: 2,
        initialDelay: 500,
        maxDelay: 2000,
        onRetry: (error, attempt) => {
          if (isRetryableError(error)) {
            logger.warn(`Retrying fetch vacancy details for ${vacancyId} (attempt ${attempt})`);
          }
        },
      }
    );

    const vacancy = response.data as Record<string, unknown>;
    const sourceMeta = extractHhVacancyMeta(vacancy);

    const area = vacancy.area as { name?: string } | undefined;
    const address = vacancy.address as { city?: string } | undefined;
    const location = uniqueLocationLabels([area?.name, address?.city]);

    // Extract salary
    let salary_min: number | null = null;
    let salary_max: number | null = null;
    let currency: string | null = null;
    const salary = vacancy.salary as
      | { from?: number | null; to?: number | null; currency?: string | null }
      | undefined;
    if (salary) {
      salary_min = salary.from || null;
      salary_max = salary.to || null;
      currency = salary.currency || null;
    }

    // Extract skills
    const keySkills = vacancy.key_skills as { name: string }[] | undefined;
    const skills: string[] = keySkills?.map((skill) => skill.name) || [];

    // Determine experience level
    let experience_level: string | null = null;
    const experience = vacancy.experience as { id?: string } | undefined;
    if (experience?.id) {
      const expId = experience.id;
      if (expId === 'noExperience' || expId === 'between1And3') {
        experience_level = 'junior';
      } else if (expId === 'between3And6') {
        experience_level = 'middle';
      } else if (expId === 'moreThan6') {
        experience_level = 'senior';
      }
    }

    // Determine work mode from HH work_format (not schedule)
    const work_mode = mapHhWorkMode(vacancy);
    const snippet = vacancy.snippet as { requirement?: string } | undefined;

    return {
      title: (vacancy.name as string) || '',
      company: ((vacancy.employer as { name?: string })?.name) || '',
      location,
      salary_min,
      salary_max,
      currency,
      description: (vacancy.description as string) || '',
      requirements: snippet?.requirement || '',
      skills,
      experience_level,
      work_mode,
      source_meta: sourceMeta,
      source: 'hh.ru',
      source_url: buildHhVacancyUrl(vacancyId),
      role_family: classifyRoleFamily(((vacancy.name as string) || '')),
      posted_at: vacancy.published_at ? new Date(vacancy.published_at as string) : null,
    };
  } catch (error: unknown) {
    logger.error(`Error fetching vacancy ${vacancyId}:`, error);
    return null;
  }
}

/**
 * Generate mock jobs for testing (only when explicitly enabled via USE_MOCK_JOBS or as fallback in development)
 */
function generateMockJobs(keywords: string[]): JobInput[] {
  const mockJobs: JobInput[] = [];
  const companies = ['Яндекс', 'Сбер', 'Тинькофф', 'VK', 'Ozon', 'Wildberries', 'Авито'];
  const locations = [['Москва'], ['Санкт-Петербург'], ['Москва', 'Удаленно']];
  const workModes = ['remote', 'office', 'hybrid'];
  const experienceLevels = ['junior', 'middle', 'senior'];

  keywords.slice(0, 10).forEach((keyword, index) => {
    const title = `${keyword} разработчик`;
    mockJobs.push({
      title,
      company: companies[index % companies.length],
      location: locations[index % locations.length],
      salary_min: 100000 + index * 20000,
      salary_max: 200000 + index * 30000,
      currency: 'RUR',
      description: `Ищем ${keyword} разработчика для работы над интересными проектами. Требуется опыт работы от 2 лет.`,
      requirements: `Опыт работы с ${keyword}, знание современных технологий, желание развиваться.`,
      skills: [keyword, 'Git', 'TypeScript'],
      experience_level: experienceLevels[index % experienceLevels.length] as
        | 'junior'
        | 'middle'
        | 'senior',
      work_mode: workModes[index % workModes.length] as 'remote' | 'office' | 'hybrid',
      source: 'demo',
      source_url: `demo://leo-ai/mock/${index + 1}?q=${encodeURIComponent(keyword)}`,
      role_family: classifyRoleFamily(title),
      posted_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Within last 7 days
    });
  });

  return mockJobs;
}
