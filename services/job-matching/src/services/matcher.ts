/**
 * Job Matcher Service
 *
 * Оценивает соответствие вакансии профилю пользователя по шкале 0–100.
 * Итоговое решение выносится не только по сумме баллов, но и по
 * семейству профессий (role-family), чтобы не рекомендовать
 * PM-у разработчика, а QA-инженеру — аккаунт-менеджера.
 *
 * Вклад факторов (суммарно до 100, с бонусами clamp):
 *   - роль (фразы + токены desiredRole/позиций):  до 30
 *   - навыки (жёсткие и софт):                     до 25
 *   - пересечение опыта ↔ обязанности JD:         до 5
 *   - локация (совпадение или remote-friendly):    до 20
 *   - опыт (HH experience или experience_level):     до 15
 *   - режим работы (HH work_format / work_mode):   до 10
 *   - занятость / оформление / график / часы (HH):  до 19*
 *     * только если поле есть в вакансии; без профиля — нейтрально
 *   - softCap после family-multiplier: линейно до 88, хвост → max 97
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
  familyLabelRu,
  textIncludesPhrase,
} from './roleFamily';
import { enrichQuickPathCollectedData } from './quickPathEnrichment';
import {
  applyEnrichedToCollectedData,
  inferUserSeniorityFromYears,
} from './deriveProfileSignals';
import { getEnrichedFromCollected } from '../types/enrichedProfile';
import {
  matchHhExperienceFromMeta,
  matchHhVacancyConditions,
  resolveJobWorkMode,
} from './hhConditionsMatcher';
import {
  matchSalaryExpectation,
  salesChannelMismatchReason,
  seniorityMismatchReason,
  getDemoteReasons,
  demoteReasonLabels,
  isThinProfile,
} from './matchNoise';
import { findProfileCompanyExclusion, scoreDomainAffinity } from './preferenceSignals';
import {
  findVacancyFeedbackDemotion,
  scoreVacancyFeedbackLike,
} from './vacancyFeedbackSignals';
import { skillAppearsInText, skillsMatchByAlias, filterMeaningfulMissingSkills } from './skillLexicon';
import { scoreExperienceOverlap } from './experienceSignals';
import { dedupeMatchTiers } from './jobDedup';

/** Порог «Рекомендуем». */
export const MATCH_SCORE_THRESHOLD = 45;

/** Нижняя граница яруса «Слабое совпадение». */
export const WEAK_MATCH_SCORE_FLOOR = 25;

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
  /** Причины понижения из «Рекомендуем» в слабый ярус (если были). */
  demoteReasons?: string[];
  matchedSkills?: string[];
  missingSkills?: string[];
  /** 1-based ранг в своём ярусе после сортировки (tie-break). */
  rank?: number;
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
  /** Сколько вакансий в выборке относится к направлению пользователя (primary + adjacent). */
  familyCatalogCount: number;
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

  const withEnriched = applyEnrichedToCollectedData(raw);
  const enriched = enrichQuickPathCollectedData(withEnriched);
  const skillTokens = collectSkillStrings(enriched);
  if (skillTokens.length > 0) {
    const fromText = Array.isArray(enriched.skills) ? enriched.skills.map(String) : [];
    enriched.skills = [...new Set([...fromText, ...skillTokens])];
  }
  return enriched;
}

// ---------------------------------------------------------------------------
// Seniority inference from totalExperience
// ---------------------------------------------------------------------------

type SeniorityLevel = 'intern' | 'junior' | 'middle' | 'senior' | 'lead';

function inferUserSeniority(totalExperience: number | undefined): SeniorityLevel | null {
  return inferUserSeniorityFromYears(totalExperience);
}

function resolveUserSeniority(
  effective: CollectedData | null,
  storedSeniority?: SeniorityLevel | null
): SeniorityLevel | null {
  if (storedSeniority) return storedSeniority;
  if (!effective || effective.totalExperience == null) return null;
  const years =
    typeof effective.totalExperience === 'number'
      ? effective.totalExperience
      : parseFloat(String(effective.totalExperience).replace(/,/g, '.')) || 0;
  return inferUserSeniority(years);
}

const SENIORITY_RANK: Record<string, number> = {
  intern: 0,
  junior: 1,
  middle: 2,
  senior: 3,
  lead: 4,
};

function collectSkillStrings(raw: CollectedData): string[] {
  const out: string[] = [];
  const addFrom = (s: unknown) => {
    if (typeof s !== 'string' || !s.trim()) return;
    s.split(/[,;\n]/).forEach((p) => {
      const t = p.trim();
      if (t) out.push(t);
    });
  };

  // Always union chat/profile fields with enrichment — Insight one-click writes
  // skills_hard/skills_soft, while normalized_skills may lag until re-enrichment.
  const enrichedProfile = getEnrichedFromCollected(raw as Record<string, unknown>);
  if (enrichedProfile?.normalized_skills?.length) {
    for (const skill of enrichedProfile.normalized_skills) {
      if (skill?.name?.trim()) out.push(skill.name.trim());
    }
  }

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

function userPrefersRemote(
  collectedData: CollectedData,
  userPreferences?: { location?: string[]; workMode?: string }
): boolean {
  const mode = (userPreferences?.workMode || collectedData.workMode || '').toString().toLowerCase();
  return mode === 'remote' || mode === 'удаленно' || mode.includes('remote');
}

function jobIsRemoteFriendly(job: Job): boolean {
  const jobMode = (job.work_mode || '').toLowerCase();
  if (jobMode === 'remote' || jobMode === 'hybrid') return true;
  const jobLocations = job.location.map((loc) => loc.toLowerCase());
  return jobLocations.some(
    (loc) => loc.includes('удален') || loc.includes('remote') || loc.includes('дистанц')
  );
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
  const storedEnriched = effective
    ? getEnrichedFromCollected(effective as Record<string, unknown>)
    : null;

  const inferredClassification = effective
    ? classifyProfileRoles({
        desiredRole: effective.desiredRole || (effective.desired_role as string | undefined),
        positionRoles: profilePositionRoles(effective),
        careerSummary:
          typeof effective.careerSummary === 'string' ? effective.careerSummary : null,
      })
    : { primary: 'unknown' as RoleFamily, adjacent: [] as RoleFamily[], detected: [] as RoleFamily[] };

  const primaryFamily =
    (storedEnriched?.role_family as RoleFamily | undefined) ?? inferredClassification.primary;
  const adjacentSet = new Set<RoleFamily>(inferredClassification.adjacent);

  const recommended: MatchingScore[] = [];
  const weakPool: MatchingScore[] = [];
  let maxScore = 0;
  const familyDistribution: Partial<Record<RoleFamily, number>> = {};
  let relevantCount = 0;

  for (const job of jobs) {
    const jobFamily = job.role_family ?? classifyRoleFamily(`${job.title}`);
    familyDistribution[jobFamily] = (familyDistribution[jobFamily] ?? 0) + 1;

    const familyMatch = resolveFamilyMatch(primaryFamily, jobFamily, adjacentSet);
    if (familyMatch === 'same' || familyMatch === 'adjacent') relevantCount += 1;

    const raw = calculateRawScore(job, effective, userPreferences);
    const multiplier = familyMultiplierFor(familyMatch);
    // Небольшой discrimination bonus до softCap — чтобы топ не был плоским «все 92».
    const discrimination = scoreDiscriminationBonus(raw.matchedSkills, raw.reasons, familyMatch);
    const finalScore = softCapMatchScore(Math.round(raw.score * multiplier) + discrimination);

    const reasons = dedupeOverlapSkillReasons([...raw.reasons], raw.matchedSkills ?? []);
    if (primaryFamily !== 'unknown' && jobFamily !== 'unknown') {
      if (familyMatch === 'same') {
        reasons.unshift(`Направление совпадает: ${familyLabelRu(jobFamily)}`);
      } else if (familyMatch === 'adjacent') {
        reasons.unshift(`Смежное направление: ${familyLabelRu(jobFamily)}`);
      } else if (familyMatch === 'conflict') {
        reasons.unshift(`Другое направление (${familyLabelRu(jobFamily)}), скор снижен`);
      }
    }

    if (effective) {
      const channelReason = salesChannelMismatchReason(effective, job);
      if (channelReason) reasons.push(channelReason);
    }

    if (finalScore > maxScore) maxScore = finalScore;

    const userLevel = resolveUserSeniority(effective, storedEnriched?.seniority);
    const jobLevel = job.experience_level || inferLevelFromTitle(job.title);
    const thinProfile = effective ? isThinProfile(effective) : false;
    const demoteCodes =
      effective && finalScore >= MATCH_SCORE_THRESHOLD
        ? getDemoteReasons(job, effective, userLevel, jobLevel, raw.salaryHardMismatch, {
            familyMatch,
            score: finalScore,
            thinProfile,
          })
        : [];
    const demote = demoteCodes.length > 0;

    if (demote) {
      for (const label of demoteReasonLabels(demoteCodes)) {
        reasons.push(`Понижено: ${label}`);
      }
    }

    const entry: MatchingScore = {
      job,
      score: finalScore,
      reasons,
      jobFamily,
      familyMatch,
      demoteReasons: demote ? demoteReasonLabels(demoteCodes) : undefined,
      matchedSkills: raw.matchedSkills,
      missingSkills: raw.missingSkills,
    };

    if (finalScore >= MATCH_SCORE_THRESHOLD) {
      if (demote) {
        weakPool.push(entry);
      } else {
        recommended.push(entry);
      }
    } else if (finalScore >= WEAK_MATCH_SCORE_FLOOR) {
      weakPool.push(entry);
    }
  }

  recommended.sort(compareMatchTieBreak);
  weakPool.sort(compareMatchTieBreak);

  const deduped = dedupeMatchTiers(recommended, weakPool);
  const matches = assignRanks(deduped.recommended);
  const weakMatches = assignRanks(deduped.weak);

  const familyRelevanceShare =
    jobs.length > 0 ? relevantCount / jobs.length : 0;

  let familyCatalogCount = 0;
  if (primaryFamily !== 'unknown') {
    familyCatalogCount += familyDistribution[primaryFamily] ?? 0;
    for (const adj of adjacentSet) {
      familyCatalogCount += familyDistribution[adj] ?? 0;
    }
  }

  return {
    matches,
    weakMatches,
    stats: {
      maxScore,
      jobsConsidered: jobs.length,
      aboveThreshold: matches.length,
      weakTierTotal: weakMatches.length,
      familyDistribution,
      familyRelevanceShare,
      familyCatalogCount,
      primaryFamily,
      adjacentFamilies: Array.from(adjacentSet),
    },
  };
}

export function filterWeakMatchesForPresentation(
  weakMatches: MatchingScore[],
  primaryFamily: RoleFamily,
  catalogWarning: string | null
): MatchingScore[] {
  if (primaryFamily === 'unknown') {
    return weakMatches.filter((m) => m.jobFamily === 'unknown');
  }
  if (catalogWarning === 'catalog_family_mismatch') {
    const sameOrAdjacent = weakMatches.filter(
      (m) => m.familyMatch === 'same' || m.familyMatch === 'adjacent'
    );
    const unknownOnly = weakMatches.filter((m) => m.familyMatch === 'unknown');
    return [...sameOrAdjacent, ...unknownOnly];
  }
  return weakMatches.filter((m) => m.familyMatch !== 'conflict');
}

export function filterRecommendedMatchesForPresentation(
  matchedJobs: MatchingScore[],
  primaryFamily: RoleFamily
): MatchingScore[] {
  if (primaryFamily === 'unknown') {
    return matchedJobs.filter((m) => m.jobFamily === 'unknown');
  }
  const sameOrAdjacent = matchedJobs.filter(
    (m) => m.familyMatch === 'same' || m.familyMatch === 'adjacent'
  );
  return sameOrAdjacent.length > 0 ? sameOrAdjacent : matchedJobs;
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

/**
 * Сжимает хвост высоких скоров: 100 не должен быть массовым для любого PO.
 * Линейно до 88, дальше сжатие к потолку 97 (100 почти недостижим без идеального всего).
 */
export function softCapMatchScore(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (raw <= 88) return Math.min(100, Math.round(raw));
  const compressed = 88 + (raw - 88) * 0.32;
  return Math.min(97, Math.round(compressed));
}

/** 0–2 доп. балла до softCap для разведения одинаковых «сырых» скоров. */
export function scoreDiscriminationBonus(
  matchedSkills: string[] | undefined,
  reasons: string[],
  familyMatch: 'same' | 'adjacent' | 'unknown' | 'conflict'
): number {
  let bonus = 0;
  if (familyMatch === 'same') bonus += 1;
  const skills = matchedSkills?.length ?? 0;
  if (skills >= 3) bonus += 1;
  else if (skills >= 1 && reasons.some((r) => /опыт пересекается/i.test(r))) bonus += 1;
  return Math.min(2, bonus);
}

function skillFitSignal(m: MatchingScore): number {
  const skills = m.matchedSkills?.length ?? 0;
  const overlap = m.reasons.some((r) => /опыт пересекается/i.test(r)) ? 2 : 0;
  const family =
    m.familyMatch === 'same' ? 3 : m.familyMatch === 'adjacent' ? 2 : m.familyMatch === 'unknown' ? 1 : 0;
  return skills + overlap + family;
}

/** Сортировка яруса: score → skill/overlap/family fit → свежесть. */
export function compareMatchTieBreak(a: MatchingScore, b: MatchingScore): number {
  if (b.score !== a.score) return b.score - a.score;
  const fitDiff = skillFitSignal(b) - skillFitSignal(a);
  if (fitDiff !== 0) return fitDiff;
  return jobRecencyTimestamp(b.job) - jobRecencyTimestamp(a.job);
}

function assignRanks(matches: MatchingScore[]): MatchingScore[] {
  return matches.map((m, i) => ({ ...m, rank: i + 1 }));
}

/**
 * Убирает дубли skills ↔ overlap: если навык уже покрыт формулировкой
 * «Опыт пересекается с обязанностями», не повторяем его в «Совпадающие навыки».
 */
export function dedupeOverlapSkillReasons(
  reasons: string[],
  matchedSkills: string[]
): string[] {
  const overlapLine = reasons.find((r) => /опыт пересекается с обязанностями:/i.test(r));
  if (!overlapLine) return reasons;

  const overlapBlob = overlapLine.toLowerCase();
  const covered = new Set(
    matchedSkills
      .map((s) => s.toLowerCase().trim())
      .filter((s) => s.length >= 3 && (overlapBlob.includes(s) || skillTokenOverlapsDuty(s, overlapBlob)))
  );
  if (covered.size === 0) return reasons;

  return reasons.map((reason) => {
    if (!/^совпадающие навыки:/i.test(reason.trim())) return reason;
    const list = reason.split(':').slice(1).join(':');
    const kept = list
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && !covered.has(s.toLowerCase()));
    if (kept.length === 0) {
      return 'Совпадающие навыки отражены в пересечении опыта';
    }
    if (kept.length === list.split(',').map((s) => s.trim()).filter(Boolean).length) {
      return reason;
    }
    return `Совпадающие навыки: ${kept.join(', ')}`;
  });
}

function skillTokenOverlapsDuty(skill: string, overlapBlob: string): boolean {
  const tokens = skill.split(/[\s/,_-]+/).filter((t) => t.length >= 4);
  if (tokens.length === 0) return false;
  // agile ↔ Agile/Scrum, roadmap ↔ видение и стратегия продукта (roadmap в needles)
  const aliases: Record<string, string[]> = {
    agile: ['agile', 'scrum'],
    scrum: ['agile', 'scrum'],
    roadmap: ['стратеги', 'видение', 'roadmap'],
    backlog: ['бэклог', 'приоритет'],
    kpi: ['метрик', 'kpi'],
    metrics: ['метрик', 'kpi'],
  };
  for (const t of tokens) {
    const keys = aliases[t] ?? [t];
    if (keys.some((k) => overlapBlob.includes(k))) return true;
  }
  return false;
}

function calculateRawScore(
  job: Job,
  collectedData: CollectedData | null,
  userPreferences?: {
    location?: string[];
    workMode?: string;
  }
): {
  score: number;
  reasons: string[];
  salaryHardMismatch: boolean;
  matchedSkills?: string[];
  missingSkills?: string[];
} {
  let score = 0;
  const reasons: string[] = [];
  let salaryHardMismatch = false;

  if (!collectedData) {
    return { score: 20, reasons: ['Недостаточно данных о пользователе'], salaryHardMismatch: false };
  }

  // Порядок reasons: суть (роль/навыки) раньше HH-меты (график/часы),
  // чтобы «Почему матч» не выглядел как сравнение только тегов условий.
  const locationScore = matchLocation(job, collectedData, userPreferences);
  score += locationScore.points;
  if (locationScore.reason) reasons.push(locationScore.reason);

  const experienceScore = matchExperience(job, collectedData);
  score += experienceScore.points;
  if (experienceScore.reason) reasons.push(experienceScore.reason);

  const roleScore = matchRole(job, collectedData);
  score += roleScore.points;
  if (roleScore.reason) reasons.push(roleScore.reason);

  const skillsScore = matchSkills(job, collectedData);
  score += skillsScore.points;
  if (skillsScore.reason) reasons.push(skillsScore.reason);

  const experienceOverlap = scoreExperienceOverlap(job, collectedData);
  score += experienceOverlap.points;
  if (experienceOverlap.reason) reasons.push(experienceOverlap.reason);

  const strongSkillFit =
    skillsScore.points >= 12 || experienceOverlap.points >= 4 || (skillsScore.matchedSkills?.length ?? 0) >= 2;
  const meaningfulGaps = filterMeaningfulMissingSkills(
    skillsScore.missingSkills ?? [],
    collectSkillStrings(collectedData),
    [
      typeof collectedData.careerSummary === 'string' ? collectedData.careerSummary : '',
      ...collectSkillStrings(collectedData),
      ...Array.from({ length: 5 }, (_, i) => {
        const n = i + 1;
        return [
          collectedData[`position_${n}_responsibilities`],
          collectedData[`position_${n}_achievements`],
          collectedData[`position_${n}_role`],
        ]
          .filter((v) => typeof v === 'string')
          .join(' ');
      }),
    ]
      .join('\n')
      .toLowerCase(),
    {
      strongFit: strongSkillFit,
      max: strongSkillFit ? 1 : 3,
      coveredByOverlap: experienceOverlap.matchedLabels,
    }
  );
  if (meaningfulGaps.length > 0) {
    reasons.push(`Не хватает в профиле: ${meaningfulGaps.slice(0, 3).join(', ')}`);
  }
  // Для API/UI — отфильтрованные gaps
  skillsScore.missingSkills = meaningfulGaps;

  const workModeScore = matchWorkMode(job, collectedData, userPreferences);
  score += workModeScore.points;
  if (workModeScore.reason) reasons.push(workModeScore.reason);

  const hhConditions = matchHhVacancyConditions(job, collectedData);
  score += hhConditions.points;
  reasons.push(...hhConditions.reasons);

  const salaryScore = matchSalaryExpectation(job, collectedData);
  score += salaryScore.points;
  if (salaryScore.reason) reasons.push(salaryScore.reason);
  salaryHardMismatch = salaryScore.hardMismatch;

  const exclusion = findProfileCompanyExclusion(job, collectedData);
  if (exclusion) {
    score -= 45;
    reasons.push(`Исключено по вашему запросу: не рассматриваете «${exclusion.label}»`);
  }

  const swipeDemotion = findVacancyFeedbackDemotion(job, collectedData);
  if (swipeDemotion) {
    score -= 45;
    reasons.push(
      swipeDemotion.kind === 'job'
        ? 'Вы отметили эту вакансию как неподходящую'
        : `Компания отмечена как неподходящая: «${swipeDemotion.label}»`
    );
  }

  const likeBoost = scoreVacancyFeedbackLike(job, collectedData);
  score += likeBoost.points;
  if (likeBoost.reason) reasons.push(likeBoost.reason);

  const domainScore = scoreDomainAffinity(job, collectedData);
  score += domainScore.points;
  if (domainScore.reason) reasons.push(domainScore.reason);

  // Multi-signal bonus: reward jobs that match on 3+ factors well
  const strongFactors = [
    locationScore.points >= 16,
    experienceScore.points >= 12,
    skillsScore.points >= 15,
    roleScore.points >= 18,
    workModeScore.points >= 7,
  ].filter(Boolean).length;

  if (strongFactors >= 4) {
    score += 3;
    reasons.push('Бонус: высокое совпадение по 4+ факторам');
  } else if (strongFactors >= 3) {
    score += 1;
    reasons.push('Бонус: совпадение по 3 факторам');
  }

  // Freshness micro-bonus (0-3 points): newer jobs get slight preference
  const recency = jobRecencyTimestamp(job);
  const now = Date.now();
  const daysSincePosted = (now - recency) / (1000 * 60 * 60 * 24);
  if (daysSincePosted <= 3) {
    score += 3;
  } else if (daysSincePosted <= 7) {
    score += 2;
  } else if (daysSincePosted <= 14) {
    score += 1;
  }

  return {
    score: Math.min(100, Math.round(score)),
    reasons,
    salaryHardMismatch,
    matchedSkills: skillsScore.matchedSkills,
    missingSkills: skillsScore.missingSkills,
  };
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

  if (userPrefersRemote(collectedData, userPreferences) && !jobIsRemoteFriendly(job)) {
    return { points: -8, reason: 'Офис в другом городе при предпочтении удалёнки' };
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

  const hhExperience = matchHhExperienceFromMeta(job, userExperience);
  if (hhExperience) {
    return hhExperience;
  }

  // Determine job seniority from experience_level or title
  const jobLevel = job.experience_level || inferLevelFromTitle(job.title);

  if (!jobLevel) {
    // No level info at all — neutral score
    return { points: 7, reason: 'Уровень опыта не указан в вакансии' };
  }

  let expectedExperience: number;
  switch (jobLevel) {
    case 'intern':
      expectedExperience = 0;
      break;
    case 'junior':
      expectedExperience = 1;
      break;
    case 'middle':
      expectedExperience = 3;
      break;
    case 'senior':
      expectedExperience = 6;
      break;
    case 'lead':
      expectedExperience = 9;
      break;
    default:
      return { points: 7 };
  }

  // If user has no experience data, give neutral
  if (userExperience === 0) {
    return { points: 7, reason: 'Опыт пользователя не указан' };
  }

  const diff = Math.abs(userExperience - expectedExperience);

  // Seniority mismatch penalty: senior user should NOT see intern/junior jobs
  const userSeniority = inferUserSeniority(userExperience);
  const jobRank = SENIORITY_RANK[jobLevel] ?? 2;
  const userRank = userSeniority ? (SENIORITY_RANK[userSeniority] ?? 2) : 2;
  const rankGap = userRank - jobRank;

  const seniorityReason = seniorityMismatchReason(userSeniority, jobLevel);
  if (seniorityReason && rankGap >= 2) {
    // lead/senior → junior/intern: сильный штраф, чтобы не держать в топе «Рекомендуем»
    const penalty = rankGap >= 3 ? -14 : -10;
    return { points: penalty, reason: seniorityReason };
  }
  if (seniorityReason && userRank >= 3 && jobRank <= 1) {
    return { points: -12, reason: seniorityReason };
  }

  if (diff === 0) {
    return { points: 15, reason: `Идеальное совпадение опыта: ${jobLevel}` };
  } else if (diff <= 1) {
    return { points: 12, reason: `Близкое совпадение опыта: ${jobLevel}` };
  } else if (diff <= 2) {
    return { points: 8, reason: `Частичное совпадение опыта: ${jobLevel}` };
  } else if (diff <= 3) {
    return { points: 4, reason: `Отклонение по опыту: ${jobLevel}` };
  }
  return { points: 0, reason: `Несовпадение по опыту: вакансия ${jobLevel}` };
}

/**
 * Infer experience level from job title when experience_level field is missing.
 */
function inferLevelFromTitle(title: string): string | null {
  const lower = title.toLowerCase();
  if (/\b(стажер|стажёр|intern|практикант|trainee)\b/.test(lower)) return 'intern';
  if (/\b(junior|джуниор|младший)\b/.test(lower)) return 'junior';
  if (/\b(middle|миддл|мидл)\b/.test(lower)) return 'middle';
  if (/\b(senior|сеньор|старший|ведущий)\b/.test(lower)) return 'senior';
  if (/\b(lead|лид|руководитель|head|chief|главный|директор)\b/.test(lower)) return 'lead';
  return null;
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function matchSkills(
  job: Job,
  collectedData: CollectedData
): {
  points: number;
  reason?: string;
  matchedSkills?: string[];
  missingSkills?: string[];
} {
  const enrichedProfile = getEnrichedFromCollected(collectedData as Record<string, unknown>);
  const skillLevelWeight = (name: string): number => {
    const found = enrichedProfile?.normalized_skills?.find(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );
    if (!found?.level) return 1;
    if (found.level === 'expert') return 1.45;
    if (found.level === 'advanced') return 1.25;
    if (found.level === 'intermediate') return 1;
    return 0.55; // beginner
  };

  // Semantic bonus — не заменяет keyword match, а дополняет
  let semanticBonus = 0;
  let semanticReason: string | undefined;
  if (
    Array.isArray(collectedData.embedding) &&
    collectedData.embedding.length > 0 &&
    Array.isArray(job.embedding) &&
    job.embedding.length > 0
  ) {
    const similarity = cosineSimilarity(collectedData.embedding, job.embedding);
    if (similarity > 0.45) {
      semanticBonus = Math.min(10, Math.round((similarity - 0.45) * 2 * 10));
      semanticReason = `Семантическая близость профиля (${similarity.toFixed(2)})`;
    }
  }

  // Fallback to text-based matching
  const userSkills = collectSkillStrings(collectedData);
  const jobText = `${job.title} ${job.description} ${job.requirements}`.toLowerCase();

  if (userSkills.length === 0) {
    if (semanticBonus > 0) {
      return {
        points: Math.min(25, 3 + semanticBonus),
        reason: semanticReason,
      };
    }
    return { points: 3, reason: 'Навыки не указаны' };
  }

  const userSkillsLower = userSkills.map((skill: string) => skill.toLowerCase());

  let textHits = 0;
  let textHitWeight = 0;
  const matchedText = new Set<string>();
  for (const userSkill of userSkillsLower) {
    if (userSkill.length > 2 && skillAppearsInText(userSkill, jobText)) {
      textHits++;
      textHitWeight += skillLevelWeight(userSkill);
      matchedText.add(userSkill);
    }
  }

  if (job.skills.length === 0) {
    if (textHits > 0) {
      const points = Math.min(25, Math.round(4 + textHitWeight * 3) + semanticBonus);
      return {
        points,
        reason: [
          `Навыки найдены в тексте вакансии (${textHits})`,
          semanticReason,
        ]
          .filter(Boolean)
          .join('; '),
        matchedSkills: [...matchedText].slice(0, 3),
      };
    }
    if (semanticBonus > 0) {
      return { points: Math.min(25, 3 + semanticBonus), reason: semanticReason };
    }
    return { points: 3, reason: 'В вакансии не выделены теги навыков' };
  }

  const jobSkillsLower = job.skills.map((skill: string) => skill.toLowerCase());

  const matchingSkills: string[] = [];
  const missingSkills: string[] = [];
  for (const jobSkill of jobSkillsLower) {
    let matched = false;
    for (const userSkill of userSkillsLower) {
      if (skillsMatchByAlias(jobSkill, userSkill)) {
        matchingSkills.push(jobSkill);
        matched = true;
        break;
      }
    }
    if (!matched) missingSkills.push(jobSkill);
  }

  const textBonus = Math.min(6, textHits * 2);
  const weightedMatches = matchingSkills.reduce((sum, skill) => {
    const userSkill = userSkillsLower.find((u) => skillsMatchByAlias(skill, u));
    return sum + (userSkill ? skillLevelWeight(userSkill) : 1);
  }, 0);
  const matchRatio = weightedMatches / Math.max(jobSkillsLower.length, 1);
  let points = Math.round(matchRatio * 25) + textBonus + semanticBonus;
  points = Math.min(25, points);

  const withSemantic = (base: string) =>
    [base, semanticReason].filter(Boolean).join('; ');

  if (matchingSkills.length > 0) {
    return {
      points,
      reason: withSemantic(`Совпадающие навыки: ${matchingSkills.slice(0, 3).join(', ')}`),
      matchedSkills: matchingSkills.slice(0, 5),
      missingSkills: missingSkills.slice(0, 3),
    };
  }

  if (textHits > 0) {
    return {
      points: Math.min(25, Math.max(points, 5 + textHits * 2 + semanticBonus)),
      reason: withSemantic(`Навыки встречаются в описании вакансии (${textHits})`),
      matchedSkills: [...matchedText].slice(0, 3),
      missingSkills: missingSkills.slice(0, 3),
    };
  }

  if (semanticBonus > 0) {
    return { points: Math.min(25, semanticBonus), reason: semanticReason };
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
    if (textIncludesPhrase(jobTitleLower, phrase)) {
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
  const jobWorkMode = resolveJobWorkMode(job);
  if (!userWorkMode || !jobWorkMode) {
    return { points: 4, reason: 'Режим работы не указан' };
  }

  const userModeLower = String(userWorkMode).toLowerCase();
  const jobModeLower = String(jobWorkMode).toLowerCase();

  if (userModeLower === jobModeLower) {
    const label = job.source_meta?.workFormatLabel || jobWorkMode;
    return { points: 10, reason: `Совпадение формата работы: ${label}` };
  }

  if (
    (userModeLower === 'remote' && jobModeLower === 'hybrid') ||
    (userModeLower === 'hybrid' && jobModeLower === 'remote')
  ) {
    return { points: 7, reason: 'Частичное совпадение режима работы' };
  }

  return { points: 0, reason: 'Несовпадение режима работы' };
}
