import { Job } from '../models/job';
import jobRepository from '../models/jobRepository';
import {
  extractExternalVacancyId,
  resolvePublicVacancyUrl,
} from '../utils/vacancyUrl';
import { fetchHhVacancyDetails } from './scraper';
import { probeHhVacancyStatus } from './hhRevalidate';
import { logger } from '../utils/logger';

import type { HhVacancyMeta } from '../utils/hhVacancyMeta';

export const JOB_STALE_DAYS = 7;

export interface JobDetailsPayload {
  job: Job;
  externalVacancyId: string | null;
  publicUrl: string | null;
  stale: boolean;
  conditions: HhVacancyMeta | null;
}

export function isJobStale(updatedAt: Date, staleDays = JOB_STALE_DAYS): boolean {
  const ageMs = Date.now() - updatedAt.getTime();
  return ageMs > staleDays * 24 * 60 * 60 * 1000;
}

export function buildJobDetailsPayload(job: Job): JobDetailsPayload {
  return {
    job,
    externalVacancyId: extractExternalVacancyId(job.source, job.source_url),
    publicUrl: resolvePublicVacancyUrl(job.source, job.source_url),
    stale: isJobStale(job.updated_at),
    conditions: job.source_meta,
  };
}

export function jobNeedsHhMetaRefresh(job: Job): boolean {
  return job.source === 'hh.ru' && !job.source_meta;
}

/** Подтягивает свежие данные с HH и upsert в БД. Gone → soft-archive. */
export async function refreshJobFromHh(job: Job): Promise<Job | null> {
  const externalId = extractExternalVacancyId(job.source, job.source_url);
  if (!externalId) {
    return null;
  }

  const probe = await probeHhVacancyStatus(externalId);
  if (probe.status === 'gone') {
    const archived = await jobRepository.archiveJob(job.id);
    logger.info(
      `[jobDetails] HH gone → archived job=${job.id} hhId=${externalId} reason=${probe.reason}`
    );
    return archived;
  }
  if (probe.status === 'error' || probe.status === 'skip') {
    const msg = probe.status === 'error' ? probe.message : probe.message;
    logger.warn(`[jobDetails] HH probe ${probe.status} job=${job.id}: ${msg}`);
    return null;
  }

  if (probe.fresh) {
    return jobRepository.createOrUpdate(probe.fresh);
  }

  const fresh = await fetchHhVacancyDetails(externalId);
  if (!fresh) {
    logger.warn(`[jobDetails] HH refresh failed for job=${job.id} hhId=${externalId}`);
    return null;
  }

  return jobRepository.createOrUpdate(fresh);
}
