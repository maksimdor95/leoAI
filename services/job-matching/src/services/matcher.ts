/**
 * Job Matcher Service
 *
 * Оценивает соответствие вакансии профилю пользователя по шкале 0–100.
 * Итоговое решение выносится не только по сумме баллов, но и по
 * семейству профессий (role-family), чтобы не рекомендовать
 * PM-у разработчика, а QA-инженеру — аккаунт-менеджера.
 *
 * Вклад факторов (суммарно до 100):
 *   - роль (фразы + токены desiredRole/позиций):  до 30
 *   - навыки (жёсткие и софт):                     до 25
 *   - локация (совпадение или remote-friendly):    до 20
 *   - опыт (сопоставление с experience_level):     до 15
 *   - режим работы (office/remote/hybrid):         до 10
 *
 * После суммирования применяется множитель от family-совпадения:
 *   - совпадающее семейство         × 1.00
 *   - смежное семейство             × 0.60
 *   - неизвестное семейство         × 0.75
 *   - конфликтующее семейство       × 0.20
 */

import { Job } from '../models/job';
import { CollectedData } from './userService';
import {
  classifyRoleFamily,
  classifyProfileRoles,
  RoleFamily,
} from './roleFamily';

/** Порог «Рекомендуем». */
export const MATCH_SCORE_THRESHOLD = 45;

/** Нижняя граница яруса «Слабое совпадение». */
export const WEAK_MATCH_SCORE_FLOOR = 25;

/** Сколько вакансий отдаём во втором ярусе. */
export const WEAK_MATCH_RETURN_LIMIT = 15;

/** Минимальная доля вакансий совпадающего/смежного семейства, чтобы каталог считался «здоровым». */
export const HEALTHY_FAMILY_SHARE = 0.15;

/**
 * Множители за family-совпадение. Применяются к итоговому скору.
 */
const FAMILY_MULTIPLIER = {
  same: 1.0,
  adjacent: 0.6,
  unknownJob: 0.75,
  unknownUser: 0.9,
  conflict: 0.2,
} as const;

/** Слова, которые не должны сами по себе давать баллы за «совпадение роли». */
const ROLE_STOPWORDS = new Set<string>([
  // грейды и уровни
  'senior', 'junior', 'middle', 'lead', 'head', 'chief', 'principal',
  'старший', 'младший', 'ведущий', 'главный', 'руководитель', 'директор',
  // общий шум, частый в careerSummary и позиционных описаниях
  'b2b', 'b2c', 'saas', 'retention', 'growth', 'revenue', 'monetization',
  'the', 'and', 'for', 'with', 'into', 'про',
  'года', 'год', 'лет', 'последние', 'первый',
  'вырос', 'начинал', 'затем', 'после',
  'команды', 'команда', 'команде', 'команду',
  'опыт', 'работы', 'работал', 'работаю',
  'department', 'отдел', 'отделе', 'отдела',
  'development', 'разработка', 'разработки',
  // дисциплины, часто встречающиеся в PM-саммари, но не являющиеся ролью
  'roadmap', 'discovery', 'delivery', 'backlog', 'pnl',
  'приоритизация', 'стратегия', 'экспертиза',
]);

export interface MatchingScore {
  job: Job;
  score: number; // 0-100
  reasons: string[];
  jobFamily: RoleFamily;
  familyMatch: 'same' | 'adjacent' | 'unknown' | 'conflict';
}

export interface MatchJobsStats {
  maxScore: number;
  jobsConsidered: number;
  aboveThreshold: number;
  weakTierTotal: number;
  /** Распределение вакансий по семействам — для диагностики каталога. */
  familyDistribution: Partial<Record<RoleFamily, number>>;
  /** Доля вакансий, попавших в primary или adjacent семейства пользователя. */
  familyRelevanceShare: number;
  primaryFamily: RoleFamily;
  adjacentFamilies: RoleFamily[];
}

export interface MatchJobsResult {
  matches: MatchingScore[];
  weakMatches: MatchingScore[];
  stats: MatchJobsStats;
}

function jobRecencyTimestamp(job: Job): number {
  const d = job.posted_at ?? job.created_at;
  if (d instanceof Date) return d.getTime();
  return new Date(d).getTime();
}

// ---------------------------------------------------------------------------
// Подготовка данных пользователя
// ---------------------------------------------------------------------------

export function normalizeForMatch(raw: CollectedData | null): CollectedData | null {
  if (!raw) return null;

  const merged: CollectedData = { ...raw };

  const desiredRole =
    raw.desiredRole ||
    (typeof raw.desired_role === 'string' ? raw.desired_role : undefined);
  if (desiredRole) merged.desiredRole = desiredRole.trim();

  const skillTokens = collectSkillStrings(raw);
  if (skillTokens.length > 0) merged.skills = skillTokens;

  const locs = resolveLocationsFromCollected(raw);
  if (locs.length > 0) merged.location = locs;

  return merged;
}

function collectSkillStrings(raw: CollectedData): string[] {
  const out: string[] = [];
  const addFrom = (s: unknown) => {
    if (typeof s !== 'string' || !s.trim()) return;
    s.split(/[,;\n]/).forEach((p) => {
      const t = p.trim();
      if (t) out.push(t);
    });
  };

  if (Array.isArray(raw.skills)) {
    for (const x of raw.skills) {
      if (typeof x === 'string' && x.trim()) out.push(x.trim());
    }
  }
  addFrom(raw.skills_hard);
  addFrom(raw.skills_soft);

  const seen = new Set<string>();
  return out.filter((s) => {
    const k = s.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function resolveLocationsFromCollected(raw: CollectedData): string[] {
  if (Array.isArray(raw.location) && raw.location.length > 0) {
    return raw.location.map((x) => String(x));
  }
  const dl = raw.desired_location;
  if (typeof dl === 'string' && dl.trim()) {
    return dl
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(dl) && dl.length > 0) {
    return (dl as unknown[]).map((x) => String(x)).filter(Boolean);
  }
  return [];
}

function profilePositionRoles(data: CollectedData): string[] {
  const roles: string[] = [];
  for (let i = 1; i <= 5; i += 1) {
    const v = data[`position_${i}_role` as keyof CollectedData];
    if (typeof v === 'string' && v.trim()) roles.push(v);
  }
  return roles;
}

// ---------------------------------------------------------------------------
// Матчинг
// ---------------------------------------------------------------------------

export function matchJobs(
  jobs: Job[],
  collectedData: CollectedData | null,
  userPreferences?: {
    location?: string[];
    workMode?: string;
  }
): MatchJobsResult {
  const effective = normalizeForMatch(collectedData);

  const classification = effective
    ? classifyProfileRoles({
        desiredRole: effective.desiredRole || (effective.desired_role as string | undefined),
        positionRoles: profilePositionRoles(effective),
        careerSummary:
          typeof effective.careerSummary === 'string' ? effective.careerSummary : null,
      })
    : { primary: 'unknown' as RoleFamily, adjacent: [] as RoleFamily[], detected: [] as RoleFamily[] };

  const primaryFamily = classification.primary;
  const adjacentSet = new Set<RoleFamily>(classification.adjacent);

  const recommended: MatchingScore[] = [];
  const weakPool: MatchingScore[] = [];
  let maxScore = 0;
  const familyDistribution: Partial<Record<RoleFamily, number>> = {};
  let relevantCount = 0;

  for (const job of jobs) {
    const jobFamily = classifyRoleFamily(`${job.title}`);
    familyDistribution[jobFamily] = (familyDistribution[jobFamily] ?? 0) + 1;

    const familyMatch = resolveFamilyMatch(primaryFamily, jobFamily, adjacentSet);
    if (familyMatch === 'same' || familyMatch === 'adjacent') relevantCount += 1;

    const raw = calculateRawScore(job, effective, userPreferences);
    const multiplier = familyMultiplierFor(familyMatch);
    const finalScore = Math.min(100, Math.round(raw.score * multiplier));

    const reasons = [...raw.reasons];
    if (primaryFamily !== 'unknown' && jobFamily !== 'unknown') {
      if (familyMatch === 'same') {
        reasons.unshift(`Семейство роли совпадает: ${jobFamily}`);
      } else if (familyMatch === 'adjacent') {
        reasons.unshift(`Смежное семейство: ${jobFamily}`);
      } else if (familyMatch === 'conflict') {
        reasons.unshift(`Другое семейство (${jobFamily}), понижено`);
      }
    }

    if (finalScore > maxScore) maxScore = finalScore;

    const entry: MatchingScore = {
      job,
      score: finalScore,
      reasons,
      jobFamily,
      familyMatch,
    };

    if (finalScore >= MATCH_SCORE_THRESHOLD) {
      recommended.push(entry);
    } else if (finalScore >= WEAK_MATCH_SCORE_FLOOR) {
      weakPool.push(entry);
    }
  }

  const sortTier = (a: MatchingScore, b: MatchingScore) => {
    if (b.score !== a.score) return b.score - a.score;
    return jobRecencyTimestamp(b.job) - jobRecencyTimestamp(a.job);
  };

  recommended.sort(sortTier);
  weakPool.sort(sortTier);

  const familyRelevanceShare =
    jobs.length > 0 ? relevantCount / jobs.length : 0;

  return {
    matches: recommended,
    weakMatches: weakPool,
    stats: {
      maxScore,
      jobsConsidered: jobs.length,
      aboveThreshold: recommended.length,
      weakTierTotal: weakPool.length,
      familyDistribution,
      familyRelevanceShare,
      primaryFamily,
      adjacentFamilies: Array.from(adjacentSet),
    },
  };
}

function resolveFamilyMatch(
  userPrimary: RoleFamily,
  jobFamily: RoleFamily,
  adjacent: Set<RoleFamily>
): 'same' | 'adjacent' | 'unknown' | 'conflict' {
  if (userPrimary === 'unknown') return 'unknown';
  if (jobFamily === 'unknown') return 'unknown';
  if (userPrimary === jobFamily) return 'same';
  if (adjacent.has(jobFamily)) return 'adjacent';
  return 'conflict';
}

function familyMultiplierFor(match: 'same' | 'adjacent' | 'unknown' | 'conflict'): number {
  switch (match) {
    case 'same':
      return FAMILY_MULTIPLIER.same;
    case 'adjacent':
      return FAMILY_MULTIPLIER.adjacent;
    case 'unknown':
      // Если не смогли классифицировать заголовок вакансии — мягко понижаем,
      // чтобы не выталкивать на первые места нераспознанное.
      return FAMILY_MULTIPLIER.unknownJob;
    case 'conflict':
      return FAMILY_MULTIPLIER.conflict;
  }
}

function calculateRawScore(
  job: Job,
  collectedData: CollectedData | null,
  userPreferences?: {
    location?: string[];
    workMode?: string;
  }
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (!collectedData) {
    return { score: 20, reasons: ['Недостаточно данных о пользователе'] };
  }

  const locationScore = matchLocation(job, collectedData, userPreferences);
  score += locationScore.points;
  if (locationScore.reason) reasons.push(locationScore.reason);

  const experienceScore = matchExperience(job, collectedData);
  score += experienceScore.points;
  if (experienceScore.reason) reasons.push(experienceScore.reason);

  const skillsScore = matchSkills(job, collectedData);
  score += skillsScore.points;
  if (skillsScore.reason) reasons.push(skillsScore.reason);

  const roleScore = matchRole(job, collectedData);
  score += roleScore.points;
  if (roleScore.reason) reasons.push(roleScore.reason);

  const workModeScore = matchWorkMode(job, collectedData, userPreferences);
  score += workModeScore.points;
  if (workModeScore.reason) reasons.push(workModeScore.reason);

  return { score: Math.min(100, Math.round(score)), reasons };
}

// ---------- частные факторы ----------

function matchLocation(
  job: Job,
  collectedData: CollectedData,
  userPreferences?: { location?: string[] }
): { points: number; reason?: string } {
  const userLocations =
    (userPreferences?.location && userPreferences.location.length > 0
      ? userPreferences.location
      : undefined) ||
    (collectedData.location && collectedData.location.length > 0
      ? collectedData.location
      : undefined) ||
    [];

  if (userLocations.length === 0) {
    return { points: 8, reason: 'Локация не указана' };
  }

  const jobLocations = job.location.map((loc: string) => loc.toLowerCase());
  const userLocationsLower = userLocations.map((loc: string) => loc.toLowerCase());

  for (const userLoc of userLocationsLower) {
    for (const jobLoc of jobLocations) {
      if (jobLoc.includes(userLoc) || userLoc.includes(jobLoc)) {
        return { points: 20, reason: `Совпадение по локации: ${userLoc}` };
      }
    }
  }

  if (jobLocations.some((loc) => loc.includes('удаленно') || loc.includes('remote'))) {
    return { points: 16, reason: 'Удалённая работа' };
  }

  return { points: 0, reason: 'Несовпадение по локации' };
}

function matchExperience(
  job: Job,
  collectedData: CollectedData
): { points: number; reason?: string } {
  const rawExp: unknown = collectedData.totalExperience;
  const userExperience =
    typeof rawExp === 'number'
      ? rawExp
      : typeof rawExp === 'string'
        ? parseFloat(rawExp.replace(/,/g, '.')) || 0
        : 0;

  if (!job.experience_level) {
    return { points: 7, reason: 'Уровень опыта не указан в вакансии' };
  }

  let expectedExperience: number;
  switch (job.experience_level) {
    case 'junior':
      expectedExperience = 0;
      break;
    case 'middle':
      expectedExperience = 3;
      break;
    case 'senior':
      expectedExperience = 6;
      break;
    default:
      return { points: 7 };
  }

  const diff = Math.abs(userExperience - expectedExperience);
  if (diff === 0) {
    return { points: 15, reason: `Идеальное совпадение опыта: ${job.experience_level}` };
  } else if (diff <= 1) {
    return { points: 12, reason: `Близкое совпадение опыта: ${job.experience_level}` };
  } else if (diff <= 2) {
    return { points: 8, reason: `Частичное совпадение опыта: ${job.experience_level}` };
  } else if (diff <= 3) {
    return { points: 4, reason: `Отклонение по опыту: ${job.experience_level}` };
  }
  return { points: 0, reason: 'Несовпадение по опыту' };
}

function matchSkills(
  job: Job,
  collectedData: CollectedData
): { points: number; reason?: string } {
  const userSkills = Array.isArray(collectedData.skills) ? collectedData.skills : [];
  const jobText = `${job.title} ${job.description} ${job.requirements}`.toLowerCase();

  if (userSkills.length === 0) {
    return { points: 3, reason: 'Навыки не указаны' };
  }

  const userSkillsLower = userSkills.map((skill: string) => skill.toLowerCase());

  let textHits = 0;
  const matchedText = new Set<string>();
  for (const userSkill of userSkillsLower) {
    if (userSkill.length > 2 && jobText.includes(userSkill)) {
      textHits++;
      matchedText.add(userSkill);
    }
  }

  if (job.skills.length === 0) {
    if (textHits > 0) {
      const points = Math.min(18, 5 + textHits * 3);
      return {
        points,
        reason: `Навыки найдены в тексте вакансии (${textHits})`,
      };
    }
    return { points: 3, reason: 'В вакансии не выделены теги навыков' };
  }

  const jobSkillsLower = job.skills.map((skill: string) => skill.toLowerCase());

  const matchingSkills: string[] = [];
  for (const jobSkill of jobSkillsLower) {
    for (const userSkill of userSkillsLower) {
      if (jobSkill.includes(userSkill) || userSkill.includes(jobSkill)) {
        matchingSkills.push(jobSkill);
        break;
      }
    }
  }

  const textBonus = Math.min(6, textHits * 2);
  const matchRatio = matchingSkills.length / Math.max(jobSkillsLower.length, 1);
  let points = Math.round(matchRatio * 25) + textBonus;
  points = Math.min(25, points);

  if (matchingSkills.length > 0) {
    return {
      points,
      reason: `Совпадающие навыки: ${matchingSkills.slice(0, 3).join(', ')}`,
    };
  }

  if (textHits > 0) {
    return {
      points: Math.min(25, Math.max(points, 5 + textHits * 2)),
      reason: `Навыки встречаются в описании вакансии (${textHits})`,
    };
  }

  return { points: 0, reason: 'Нет совпадающих навыков' };
}

/**
 * Матчинг роли: фразы весят существенно больше, чем отдельные токены;
 * стоп-слова (senior/junior/b2b/saas/...) вообще не учитываются.
 */
function matchRole(
  job: Job,
  collectedData: CollectedData
): { points: number; reason?: string } {
  const phraseCandidates = collectRolePhrases(collectedData);
  const tokenCandidates = collectRoleTokens(collectedData);
  if (phraseCandidates.length === 0 && tokenCandidates.length === 0) {
    return { points: 3, reason: 'Желаемая должность не указана' };
  }

  const jobTitleLower = job.title.toLowerCase();

  let phraseHits = 0;
  const matchedPhrases: string[] = [];
  for (const phrase of phraseCandidates) {
    if (phrase.length < 4) continue;
    if (jobTitleLower.includes(phrase)) {
      phraseHits += 1;
      matchedPhrases.push(phrase);
    }
  }

  let tokenHits = 0;
  for (const token of tokenCandidates) {
    if (token.length <= 3) continue;
    if (ROLE_STOPWORDS.has(token)) continue;
    if (jobTitleLower.includes(token)) tokenHits += 1;
  }

  if (phraseHits === 0 && tokenHits === 0) {
    return { points: 0, reason: 'Несовпадение по должности' };
  }

  // Фраза = 18 за первую + 5 за каждую следующую, токены — по 2.
  const phrasePoints = phraseHits > 0 ? 18 + (phraseHits - 1) * 5 : 0;
  const tokenPoints = Math.min(10, tokenHits * 2);
  const points = Math.min(30, phrasePoints + tokenPoints);

  const reasonParts: string[] = [];
  if (matchedPhrases.length > 0) {
    reasonParts.push(`Совпадение фраз в должности: ${matchedPhrases.slice(0, 2).join(', ')}`);
  } else if (tokenHits > 0) {
    reasonParts.push('Частичное совпадение по должности');
  }

  return { points, reason: reasonParts.join('; ') || undefined };
}

/**
 * Список желаемых/исторических ролей, пригодный для phrase-матчинга заголовков.
 */
function collectRolePhrases(data: CollectedData): string[] {
  const raw: string[] = [];
  const push = (s: unknown) => {
    if (typeof s === 'string' && s.trim()) raw.push(s.toLowerCase().trim());
  };

  push(data.desiredRole);
  push(data.desired_role);
  for (let i = 1; i <= 5; i += 1) {
    push(data[`position_${i}_role` as keyof CollectedData]);
  }

  const expanded = new Set<string>();
  for (const item of raw) {
    // Разделяем на фрагменты по / и ,
    for (const fragment of item.split(/[/|;,]/)) {
      const trimmed = fragment.trim();
      if (!trimmed) continue;
      expanded.add(trimmed);
      // Если фраза длинная — добавим также укороченную без стоп-слов уровней.
      const cleaned = trimmed
        .split(/\s+/)
        .filter((w) => !ROLE_STOPWORDS.has(w))
        .join(' ')
        .trim();
      if (cleaned && cleaned !== trimmed && cleaned.length >= 4) {
        expanded.add(cleaned);
      }
    }
  }

  return Array.from(expanded).sort((a, b) => b.length - a.length);
}

function collectRoleTokens(data: CollectedData): string[] {
  const phrases = collectRolePhrases(data);
  const tokens = new Set<string>();
  for (const phrase of phrases) {
    for (const tok of phrase.split(/[\s,.;/|]+/)) {
      const clean = tok.trim();
      if (clean.length > 3 && !ROLE_STOPWORDS.has(clean)) tokens.add(clean);
    }
  }
  return Array.from(tokens);
}

function matchWorkMode(
  job: Job,
  collectedData: CollectedData,
  userPreferences?: { workMode?: string }
): { points: number; reason?: string } {
  const userWorkMode = userPreferences?.workMode || collectedData.workMode;
  if (!userWorkMode || !job.work_mode) {
    return { points: 4, reason: 'Режим работы не указан' };
  }

  const userModeLower = String(userWorkMode).toLowerCase();
  const jobModeLower = String(job.work_mode).toLowerCase();

  if (userModeLower === jobModeLower) {
    return { points: 10, reason: `Совпадение режима работы: ${job.work_mode}` };
  }

  if (
    (userModeLower === 'remote' && jobModeLower === 'hybrid') ||
    (userModeLower === 'hybrid' && jobModeLower === 'remote')
  ) {
    return { points: 7, reason: 'Частичное совпадение режима работы' };
  }

  return { points: 0, reason: 'Несовпадение режима работы' };
}
