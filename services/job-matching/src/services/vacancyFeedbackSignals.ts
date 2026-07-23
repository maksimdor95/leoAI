/**
 * Сигналы свайпов вакансий (лайк / не матч) из session collectedData.vacancyFeedback.
 * Hard demote: disliked job id / company. Soft boost: liked company.
 */

import type { Job } from '../models/job';
import type { CollectedData } from './userService';

export type VacancyFeedback = {
  likedJobIds: string[];
  dislikedJobIds: string[];
  dislikedCompanies: string[];
  likedCompanies: string[];
  updatedAt?: string;
};

export function normalizeCompanyKey(company: string): string {
  return company.trim().toLowerCase().replace(/\s+/g, ' ');
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}

export function parseVacancyFeedback(
  collectedData: CollectedData | null | undefined
): VacancyFeedback | null {
  if (!collectedData) return null;
  const raw = collectedData.vacancyFeedback;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  return {
    likedJobIds: asStringArray(record.likedJobIds),
    dislikedJobIds: asStringArray(record.dislikedJobIds),
    dislikedCompanies: asStringArray(record.dislikedCompanies).map(normalizeCompanyKey),
    likedCompanies: asStringArray(record.likedCompanies).map(normalizeCompanyKey),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  };
}

export type VacancyFeedbackDemotion = {
  kind: 'job' | 'company';
  label: string;
};

/** Hard demote: конкретная вакансия или компания из дизлайков. */
export function findVacancyFeedbackDemotion(
  job: Job,
  collectedData: CollectedData | null | undefined
): VacancyFeedbackDemotion | null {
  const feedback = parseVacancyFeedback(collectedData);
  if (!feedback) return null;

  if (feedback.dislikedJobIds.includes(job.id)) {
    return { kind: 'job', label: job.title || job.id };
  }

  const companyKey = normalizeCompanyKey(job.company || '');
  if (!companyKey) return null;

  for (const disliked of feedback.dislikedCompanies) {
    if (!disliked) continue;
    if (companyKey === disliked || companyKey.includes(disliked) || disliked.includes(companyKey)) {
      return { kind: 'company', label: job.company };
    }
  }

  return null;
}

const LIKE_COMPANY_BOOST = 8;

/** Soft boost за лайкнутую компанию (без hard filter). */
export function scoreVacancyFeedbackLike(
  job: Job,
  collectedData: CollectedData | null | undefined
): { points: number; reason?: string } {
  const feedback = parseVacancyFeedback(collectedData);
  if (!feedback || feedback.likedCompanies.length === 0) {
    return { points: 0 };
  }

  const companyKey = normalizeCompanyKey(job.company || '');
  if (!companyKey) return { points: 0 };

  for (const liked of feedback.likedCompanies) {
    if (!liked) continue;
    if (companyKey === liked || companyKey.includes(liked) || liked.includes(companyKey)) {
      return {
        points: LIKE_COMPANY_BOOST,
        reason: `Компания нравится по вашим отметкам: ${job.company}`,
      };
    }
  }

  return { points: 0 };
}
