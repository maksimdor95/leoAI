/**
 * Job Scraper Service
 * Scrapes jobs from various sources
 */

import axios from 'axios';
import { JobInput } from '../models/job';
import jobRepository from '../models/jobRepository';
import { logger } from '../utils/logger';
import { retry, isRetryableError } from '../utils/retry';
import { getHHUserAgent, hasHHAuthConfig } from './hhAuthService';

const HH_API_URL = process.env.HH_API_URL || 'https://api.hh.ru';
const SUPERJOB_API_URL = process.env.SUPERJOB_API_URL || 'https://api.superjob.ru/2.0';
const SCRAPER_USER_AGENT = process.env.SCRAPER_USER_AGENT || getHHUserAgent();
const USE_MOCK_JOBS = process.env.USE_MOCK_JOBS === 'true';

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
 * Scrape jobs from all configured sources (HH.ru, SuperJob, etc.)
 * Falls back to mock data in development if all real sources fail.
 */
export async function scrapeHHJobs(
  keywords: string[] = [...DEFAULT_SEED_KEYWORDS],
  locationId: number = 113 // Россия (HH area). Города сужают выборку слишком сильно.
): Promise<ScrapeResult> {
  const result: ScrapeResult = {
    success: false,
    jobsScraped: 0,
    jobsSaved: 0,
    errors: [],
    sourcesUsed: [],
    mockJobsUsed: false,
  };

  try {
    logger.info('Starting job scraping...');

    // Check if mock jobs are explicitly enabled
    if (USE_MOCK_JOBS) {
      logger.info('USE_MOCK_JOBS is enabled - generating mock jobs only');
      const mockJobs = generateMockJobs(keywords);
      result.jobsScraped = mockJobs.length;
      result.mockJobsUsed = true;
      result.sourcesUsed.push('mock');

      // Save mock jobs
      for (const job of mockJobs) {
        try {
          await jobRepository.createOrUpdate(job);
          result.jobsSaved++;
        } catch (error: unknown) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error(`Failed to save job ${job.source_url}:`, errorMsg);
          result.errors.push(`Failed to save job: ${errorMsg}`);
        }
      }

      result.success = true;
      logger.info(
        `Mock job generation completed: ${result.jobsScraped} generated, ${result.jobsSaved} saved`
      );
      return result;
    }

    // Try real sources first
    const jobs: JobInput[] = [];
    let allSourcesFailed = true;

    // Try to use HH.ru API (if auth is configured)
    if (hasHHAuthConfig()) {
      try {
        logger.info('Attempting to scrape jobs from HH.ru API...');
        const apiJobs = await scrapeHHViaAPI(keywords, locationId);
        if (apiJobs.length > 0) {
          jobs.push(...apiJobs);
          result.sourcesUsed.push('hh.ru-api');
          allSourcesFailed = false;
          logger.info(`Successfully scraped ${apiJobs.length} jobs via HH.ru API`);
        } else {
          logger.info('HH.ru API returned no jobs');
        }
      } catch (error: unknown) {
        logger.warn('HH.ru API scraping failed:', error);
        result.errors.push(
          `HH API error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } else {
      logger.info(
        'HH auth is not configured (HH_ACCESS_TOKEN / HH_API_KEY / HH_CLIENT_ID+HH_CLIENT_SECRET) - skipping HH.ru API scraping'
      );
    }

    // Try SuperJob API (simple alternative to HH.ru)
    if (process.env.SUPERJOB_API_KEY) {
      try {
        logger.info('Attempting to scrape jobs from SuperJob API...');
        const superJobJobs = await scrapeSuperJobViaAPI(keywords);
        if (superJobJobs.length > 0) {
          jobs.push(...superJobJobs);
          result.sourcesUsed.push('superjob-api');
          allSourcesFailed = false;
          logger.info(`Successfully scraped ${superJobJobs.length} jobs via SuperJob API`);
        } else {
          logger.info('SuperJob API returned no jobs');
        }
      } catch (error: unknown) {
        logger.warn('SuperJob API scraping failed:', error);
        result.errors.push(
          `SuperJob API error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } else {
      logger.info('SUPERJOB_API_KEY not set - skipping SuperJob API scraping');
    }

    // If all sources failed or returned no jobs, check if we should use mock data as fallback
    if (jobs.length === 0 && allSourcesFailed) {
      logger.warn('All job sources failed or returned no jobs');

      // In production, don't use mock data unless explicitly enabled
      const isProduction = process.env.NODE_ENV === 'production';

      if (isProduction) {
        logger.error(
          'Production mode: Cannot use mock jobs as fallback. Please configure real job sources.'
        );
        result.errors.push(
          'No jobs found from real sources and mock jobs are disabled in production'
        );
        return result;
      } else {
        logger.warn('Development mode: Using mock jobs as fallback since all sources failed');
        const mockJobs = generateMockJobs(keywords);
        jobs.push(...mockJobs);
        result.mockJobsUsed = true;
        result.sourcesUsed.push('mock-fallback');
        logger.warn(`Generated ${mockJobs.length} mock jobs as fallback`);
      }
    }

    // Save jobs to database
    for (const job of jobs) {
      try {
        await jobRepository.createOrUpdate(job);
        result.jobsSaved++;
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to save job ${job.source_url}:`, errorMsg);
        result.errors.push(`Failed to save job: ${errorMsg}`);
      }
    }

    result.jobsScraped = jobs.length;
    result.success = result.jobsSaved > 0;

    if (result.mockJobsUsed) {
      logger.warn(
        `⚠️  Job scraping completed using MOCK DATA: ${result.jobsScraped} generated, ${result.jobsSaved} saved`
      );
      logger.warn(`   Sources used: ${result.sourcesUsed.join(', ')}`);
      logger.warn(`   This should NOT happen in production!`);
    } else {
      logger.info(
        `✅ Job scraping completed: ${result.jobsScraped} scraped, ${result.jobsSaved} saved`
      );
      logger.info(`   Sources used: ${result.sourcesUsed.join(', ')}`);
    }
  } catch (error: unknown) {
    logger.error('Job scraping failed:', error);
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}

/**
 * Scrape jobs via HH.ru API (if API key is available)
 */
async function scrapeHHViaAPI(keywords: string[], locationId: number): Promise<JobInput[]> {
  const jobs: JobInput[] = [];
  const perPage = 100;

  for (const keyword of keywords.slice(0, 3)) {
    // Limit to 3 keywords for MVP
    try {
      const response = await retry(
        () =>
          axios.get(`${HH_API_URL}/vacancies`, {
            params: {
              text: keyword,
              area: locationId,
              per_page: perPage,
              page: 0,
            },
            headers: {
              'User-Agent': SCRAPER_USER_AGENT,
              'HH-User-Agent': SCRAPER_USER_AGENT,
            },
            timeout: 10000,
          }),
        {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          onRetry: (error, attempt) => {
            if (isRetryableError(error)) {
              logger.warn(
                `Retrying HH.ru API request for keyword "${keyword}" (attempt ${attempt})`
              );
            }
          },
        }
      );

      const vacancies = response.data.items || [];
      logger.info(`Found ${vacancies.length} vacancies for keyword: ${keyword}`);

      for (const vacancy of vacancies.slice(0, 20)) {
        // Limit to 20 per keyword
        try {
          // Fetch full vacancy details
          const vacancyDetail = await fetchVacancyDetails(vacancy.id);
          if (vacancyDetail) {
            jobs.push(vacancyDetail);
          }
        } catch (error: unknown) {
          logger.warn(`Failed to fetch details for vacancy ${vacancy.id}:`, error);
        }

        // Add delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200));
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
    posted_at: datePub ? new Date(datePub * 1000) : null,
  };
}

/**
 * Fetch detailed vacancy information from HH.ru
 */
async function fetchVacancyDetails(vacancyId: string): Promise<JobInput | null> {
  try {
    const response = await retry(
      () =>
        axios.get(`${HH_API_URL}/vacancies/${vacancyId}`, {
          headers: {
            'User-Agent': SCRAPER_USER_AGENT,
            'HH-User-Agent': SCRAPER_USER_AGENT,
          },
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

    const vacancy = response.data;

    // Extract location
    const location: string[] = [];
    if (vacancy.area) {
      location.push(vacancy.area.name);
    }
    if (vacancy.address) {
      location.push(vacancy.address.city || '');
    }

    // Extract salary
    let salary_min: number | null = null;
    let salary_max: number | null = null;
    let currency: string | null = null;
    if (vacancy.salary) {
      salary_min = vacancy.salary.from || null;
      salary_max = vacancy.salary.to || null;
      currency = vacancy.salary.currency || null;
    }

    // Extract skills
    const skills: string[] = vacancy.key_skills?.map((skill: { name: string }) => skill.name) || [];

    // Determine experience level
    let experience_level: string | null = null;
    if (vacancy.experience) {
      const expId = vacancy.experience.id;
      if (expId === 'noExperience' || expId === 'between1And3') {
        experience_level = 'junior';
      } else if (expId === 'between3And6') {
        experience_level = 'middle';
      } else if (expId === 'moreThan6') {
        experience_level = 'senior';
      }
    }

    // Determine work mode
    let work_mode: string | null = null;
    if (vacancy.schedule) {
      const scheduleId = vacancy.schedule.id;
      if (scheduleId === 'remote') {
        work_mode = 'remote';
      } else if (scheduleId === 'flexible') {
        work_mode = 'hybrid';
      } else {
        work_mode = 'office';
      }
    }

    return {
      title: vacancy.name || '',
      company: vacancy.employer?.name || '',
      location: location.filter((l) => l),
      salary_min,
      salary_max,
      currency,
      description: vacancy.description || '',
      requirements: vacancy.snippet?.requirement || '',
      skills,
      experience_level,
      work_mode,
      source: 'hh.ru',
      source_url: vacancy.alternate_url || `https://hh.ru/vacancy/${vacancyId}`,
      posted_at: vacancy.published_at ? new Date(vacancy.published_at) : null,
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
    mockJobs.push({
      title: `${keyword} разработчик`,
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
      source: 'hh.ru',
      source_url: `https://hh.ru/vacancy/mock-${index + 1}`,
      posted_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Within last 7 days
    });
  });

  return mockJobs;
}
