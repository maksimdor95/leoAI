/**
 * Layer 2: embedding текста профиля для retrieval / semantic bonus.
 */

import { getEmbedding } from './enrichment';
import type { CollectedData } from './userService';
import { getEnrichedFromCollected } from '../types/enrichedProfile';
import { logger } from '../utils/logger';

/** Собирает компактный текст профиля для embedding (роль, skills, summary, red flags). */
export function buildProfileEmbeddingText(data: CollectedData): string {
  const parts: string[] = [];
  const role =
    (typeof data.desiredRole === 'string' && data.desiredRole) ||
    (typeof data.desired_role === 'string' && data.desired_role) ||
    '';
  if (role) parts.push(`Роль: ${role}`);

  if (typeof data.careerSummary === 'string' && data.careerSummary.trim()) {
    parts.push(`Опыт: ${data.careerSummary.trim().slice(0, 600)}`);
  }

  const skills: string[] = [];
  if (typeof data.skills_hard === 'string') skills.push(data.skills_hard);
  if (typeof data.skills_soft === 'string') skills.push(data.skills_soft);
  if (Array.isArray(data.skills)) {
    for (const s of data.skills) {
      if (typeof s === 'string') skills.push(s);
    }
  }
  const enriched = getEnrichedFromCollected(data as Record<string, unknown>);
  if (enriched?.normalized_skills?.length) {
    skills.push(...enriched.normalized_skills.map((s) => s.name));
  }
  if (skills.length) parts.push(`Навыки: ${[...new Set(skills)].join(', ').slice(0, 500)}`);

  const loc =
    (typeof data.desired_location === 'string' && data.desired_location) ||
    (Array.isArray(data.location) ? data.location.join(', ') : '');
  if (loc) parts.push(`Локация: ${loc}`);

  const flags = [
    ...(enriched?.job_preferences?.red_flags ?? []),
    typeof data.additional_info === 'string' ? data.additional_info : '',
  ].filter((f) => typeof f === 'string' && f.trim());
  if (flags.length) parts.push(`Исключения: ${flags.join('; ').slice(0, 200)}`);

  if (enriched?.job_preferences?.domains?.length) {
    parts.push(`Домены: ${enriched.job_preferences.domains.join(', ')}`);
  }

  return parts.join('\n').slice(0, 2000);
}

/**
 * Гарантирует embedding на collectedData (in-place). Fail-open: пустой массив при ошибке.
 */
export async function ensureProfileEmbedding(
  data: CollectedData | null,
  authToken?: string
): Promise<CollectedData | null> {
  if (!data) return null;
  if (Array.isArray(data.embedding) && data.embedding.length > 0) {
    return data;
  }

  const text = buildProfileEmbeddingText(data);
  if (text.trim().length < 20) {
    return data;
  }

  try {
    const embedding = await getEmbedding(text, authToken);
    if (embedding.length > 0) {
      data.embedding = embedding;
      logger.info(`Profile embedding generated (${embedding.length} dims, textLen=${text.length})`);
    }
  } catch (err) {
    logger.warn(`Profile embedding failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  return data;
}
