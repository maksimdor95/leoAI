/**
 * Job Scraper Service
 * Scrapes jobs from various sources
 */

import axios from 'axios';
import { JobInput } from '../models/job';
import jobRepository from '../models/jobRepository';
import { logger } from '../utils/logger';
import { retry, isRetryableError } from '../utils/retry';

const HH_API_URL = process.env.HH_API_URL || 'https://api.hh.ru';
const SCRAPER_USER_AGENT =
  process.env.SCRAPER_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const USE_MOCK_JOBS = process.env.USE_MOCK_JOBS === 'true';

export interface ScrapeResult {
  success: boolean;
  jobsScraped: number;
  jobsSaved: number;
  errors: string[];
  sourcesUsed: string[];
  mockJobsUsed: boolean;
}

/**
 * Scrape jobs from HeadHunter.ru
 * Supports multiple sources with fallback to mock data if explicitly enabled
 */
export async function scrapeHHJobs(
  keywords: string[] = ['JavaScript', 'TypeScript', 'Node.js', 'React', 'Python'],
  locationId: number = 1 // Moscow
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

    // Try to use HH.ru API (if API key is available)
    if (process.env.HH_API_KEY) {
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
      logger.info('HH_API_KEY not set - skipping HH.ru API scraping');
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
              Authorization: process.env.HH_API_KEY
                ? `Bearer ${process.env.HH_API_KEY}`
                : undefined,
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
 * Fetch detailed vacancy information from HH.ru
 */
async function fetchVacancyDetails(vacancyId: string): Promise<JobInput | null> {
  try {
    const response = await retry(
      () =>
        axios.get(`${HH_API_URL}/vacancies/${vacancyId}`, {
          headers: {
            'User-Agent': SCRAPER_USER_AGENT,
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
