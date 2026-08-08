/**
 * Slim payload для /api/jobs/match — меньше RAM/JSON, меньше шанс OOM на ~5k.
 */

import type { Job } from '../models/job';
import type { MatchingScore } from './matcher';

const DESC_MAX = Math.min(2000, Math.max(200, Number(process.env.MATCH_JOB_DESC_MAX || 600)));
const REQ_MAX = Math.min(1000, Math.max(100, Number(process.env.MATCH_JOB_REQ_MAX || 400)));

export const MATCH_RETURN_RECOMMENDED_MAX = Math.min(
  500,
  Math.max(20, Number(process.env.MATCH_RETURN_RECOMMENDED_MAX || 120))
);
export const MATCH_RETURN_WEAK_MAX = Math.min(
  300,
  Math.max(10, Number(process.env.MATCH_RETURN_WEAK_MAX || 80))
);

/** Убирает embedding из in-memory job (после выборки кандидатов). */
export function stripJobEmbeddings(jobs: Job[]): void {
  for (const job of jobs) {
    if (job.embedding) {
      delete job.embedding;
    }
  }
}

export function slimJobForMatchResponse(job: Job): Record<string, unknown> {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    currency: job.currency,
    description: (job.description || '').slice(0, DESC_MAX),
    requirements: (job.requirements || '').slice(0, REQ_MAX),
    skills: Array.isArray(job.skills) ? job.skills.slice(0, 24) : [],
    experience_level: job.experience_level,
    work_mode: job.work_mode,
    source_meta: job.source_meta ?? null,
    source: job.source,
    source_url: job.source_url,
    role_family: job.role_family ?? null,
    posted_at: job.posted_at,
    created_at: job.created_at,
    updated_at: job.updated_at,
  };
}

export function mapMatchForResponse(match: MatchingScore, rank: number): Record<string, unknown> {
  return {
    job: slimJobForMatchResponse(match.job),
    score: match.score,
    rank,
    reasons: match.reasons,
    jobFamily: match.jobFamily,
    familyMatch: match.familyMatch,
    demoteReasons: match.demoteReasons ?? null,
    matchedSkills: match.matchedSkills ?? [],
    missingSkills: match.missingSkills ?? [],
  };
}
