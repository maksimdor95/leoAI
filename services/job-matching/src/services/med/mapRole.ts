/**
 * Map vacancy title → med_role_id (Phase 1).
 * Alias / title substring match with confidence; unmatched → unknown bucket.
 */

import { listMedRoles } from './catalog';
import type { MedRole, MedRoleLevel } from './types';

export const MED_UNKNOWN_ROLE_ID = 'unknown';

export type MedMapConfidence = 'exact' | 'alias' | 'partial' | 'unknown';

export interface MedRoleMatch {
  med_role_id: string;
  level: MedRoleLevel | null;
  confidence: MedMapConfidence;
  title: string | null;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'`]/g, '')
    .replace(/[-–—_/.,;:()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Colloquial vacancy wording → nomenclature-friendly phrases. */
function expandColloquial(normalized: string): string {
  return normalized
    .replace(/медсестр[а-я]*/g, 'медицинская сестра')
    .replace(/медбрат[а-я]*/g, 'медицинский брат');
}

function scoreCandidate(haystack: string, needle: string): { score: number; kind: MedMapConfidence } | null {
  if (!needle || needle.length < 3) return null;
  if (haystack === needle) return { score: 100, kind: 'exact' };
  if (haystack.includes(needle)) {
    const coverage = needle.length / Math.max(haystack.length, 1);
    return { score: 70 + Math.min(25, Math.round(coverage * 25)), kind: 'partial' };
  }
  return null;
}

/**
 * Best med role for a vacancy title. Always returns a result;
 * unmapped titles get med_role_id=unknown (still Med vertical).
 */
export function mapVacancyToMedRole(title: string): MedRoleMatch {
  const haystack = expandColloquial(normalize(title || ''));
  if (!haystack) {
    return {
      med_role_id: MED_UNKNOWN_ROLE_ID,
      level: null,
      confidence: 'unknown',
      title: null,
    };
  }

  let best: { role: MedRole; score: number; kind: MedMapConfidence } | null = null;

  for (const role of listMedRoles()) {
    const titleNorm = expandColloquial(normalize(role.title));
    const titleHit = scoreCandidate(haystack, titleNorm);
    if (titleHit && (!best || titleHit.score > best.score)) {
      best = { role, score: titleHit.score, kind: titleHit.kind === 'exact' ? 'exact' : 'partial' };
    }

    // Prefer gender-primary short form without the parenthetical twin
    const primary = titleNorm.split(' медицинский ')[0]?.split(' младший ')[0]?.trim();
    if (primary && primary.length >= 8 && primary !== titleNorm) {
      const primaryHit = scoreCandidate(haystack, primary);
      if (primaryHit && (!best || primaryHit.score > best.score)) {
        best = {
          role,
          score: primaryHit.score,
          kind: primaryHit.kind === 'exact' ? 'alias' : 'partial',
        };
      }
    }

    for (const alias of role.aliases || []) {
      const aliasNorm = expandColloquial(normalize(alias));
      const aliasHit = scoreCandidate(haystack, aliasNorm);
      if (!aliasHit) continue;
      const kind: MedMapConfidence = aliasHit.kind === 'exact' ? 'alias' : 'partial';
      const score = kind === 'alias' ? Math.max(aliasHit.score, 90) : aliasHit.score;
      if (!best || score > best.score) {
        best = { role, score, kind };
      }
    }
  }

  if (best && best.score >= 70) {
    return {
      med_role_id: best.role.id,
      level: best.role.level,
      confidence: best.kind,
      title: best.role.title,
    };
  }

  return {
    med_role_id: MED_UNKNOWN_ROLE_ID,
    level: null,
    confidence: 'unknown',
    title: null,
  };
}

/** Tag JobInput-like object with med mapping fields. */
export function applyMedRoleMapping<T extends { title: string }>(
  job: T
): T & { med_role_id: string; med_level: MedRoleLevel | null; med_map_confidence: MedMapConfidence } {
  const match = mapVacancyToMedRole(job.title);
  return {
    ...job,
    med_role_id: match.med_role_id,
    med_level: match.level,
    med_map_confidence: match.confidence,
  };
}
