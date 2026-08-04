import axios from 'axios';
import { JobInput } from '../models/job';
import jobRepository from '../models/jobRepository';
import { logger } from '../utils/logger';

const AI_NLP_URL = process.env.AI_NLP_URL || 'http://localhost:3003';

export async function enrichJobWithLLM(job: JobInput): Promise<JobInput> {
  try {
    const response = await axios.post(
      `${AI_NLP_URL}/api/ai/enrich-job`,
      {
        title: job.title,
        description: job.description,
        requirements: job.requirements,
      },
      { timeout: 15000 }
    );

    const data = response.data;
    if (data) {
      if (Array.isArray(data.skills) && data.skills.length > 0) {
        const newSkills = data.skills.filter((s: string) => typeof s === 'string');
        job.skills = Array.from(new Set([...job.skills, ...newSkills]));
      }
      if (data.experience_level && data.experience_level !== 'unknown') {
        job.experience_level = data.experience_level;
      }
      if (data.work_mode && data.work_mode !== 'unknown') {
        job.work_mode = data.work_mode;
      }
    }

    const textToEmbed = [
      job.title,
      job.skills.join(' '),
      job.experience_level || '',
      (job.description || '').slice(0, 900),
      (job.requirements || '').slice(0, 400),
    ]
      .filter(Boolean)
      .join(' ')
      .slice(0, 2000);
    job.embedding = await getEmbedding(textToEmbed);
  } catch (error) {
    logger.error(
      `Failed to enrich job ${job.source_url} via LLM:`,
      error instanceof Error ? error.message : String(error)
    );
  }
  return job;
}

/**
 * Phase 3: out-of-band enrichment for rows saved without embeddings.
 * Fail-open per job. Safe to call from a cron or admin script.
 */
export async function enrichJobsMissingEmbeddings(
  limit: number = 40
): Promise<{ attempted: number; enriched: number; errors: string[] }> {
  const jobs = await jobRepository.findMissingEmbeddings(limit);
  return enrichJobsFromEntities(jobs);
}

/** Enrich concrete job entities (lazy match path). */
export async function enrichJobsFromEntities(
  jobs: Array<{
    title: string;
    company: string;
    location: string[];
    salary_min: number | null;
    salary_max: number | null;
    currency: string | null;
    description: string;
    requirements: string;
    skills: string[];
    experience_level: string | null;
    work_mode: string | null;
    source: string;
    source_url: string;
    role_family: import('./roleFamily').RoleFamily | null;
    posted_at: Date | null;
    source_meta: import('../utils/hhVacancyMeta').HhVacancyMeta | null;
  }>
): Promise<{ attempted: number; enriched: number; errors: string[] }> {
  let enriched = 0;
  const errors: string[] = [];

  for (const job of jobs) {
    try {
      const input: JobInput = {
        title: job.title,
        company: job.company,
        location: job.location,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        currency: job.currency,
        description: job.description,
        requirements: job.requirements,
        skills: job.skills,
        experience_level: job.experience_level,
        work_mode: job.work_mode,
        source: job.source,
        source_url: job.source_url,
        role_family: job.role_family,
        posted_at: job.posted_at,
        source_meta: job.source_meta,
      };
      const updated = await enrichJobWithLLM(input);
      if (updated.embedding && updated.embedding.length > 0) {
        await jobRepository.createOrUpdate(updated);
        enriched += 1;
      } else {
        errors.push(`${job.source_url}: empty embedding`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${job.source_url}: ${msg}`);
    }
  }

  logger.info(
    `Out-of-band enrich: attempted=${jobs.length} enriched=${enriched} errors=${errors.length}`
  );
  return { attempted: jobs.length, enriched, errors };
}

export async function getEmbedding(text: string, authToken?: string): Promise<number[]> {
  try {
    const response = await axios.post(
      `${AI_NLP_URL}/api/ai/embedding`,
      { text },
      {
        timeout: 15000,
        headers: authToken
          ? {
              Authorization: authToken.startsWith('Bearer ')
                ? authToken
                : `Bearer ${authToken}`,
            }
          : undefined,
      }
    );
    return response.data?.embedding || [];
  } catch (error) {
    logger.error(
      `Failed to get embedding:`,
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
}
