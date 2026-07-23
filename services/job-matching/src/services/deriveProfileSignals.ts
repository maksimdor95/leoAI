/**
 * Rule-based profile signal derivation for enrichment pipeline.
 */

import { CollectedData } from './userService';
import { classifyProfileRoles, RoleFamily } from './roleFamily';
import {
  enrichQuickPathCollectedData,
  extractCitiesFromDesiredLocation,
  extractWorkModeFromText,
  extractSalaryFromText,
} from './quickPathEnrichment';
import { parseSalaryMinRub } from './matchNoise';
import {
  extractSkillsFromTextWithLexicon,
  skillsForProfileText,
} from './skillLexicon';
import type {
  EnrichedProfile,
  JobPreferences,
  NormalizedSkill,
  SeniorityLevel,
} from '../types/enrichedProfile';
import { ENRICHED_COLLECTED_KEY, getEnrichedFromCollected } from '../types/enrichedProfile';

export type DeriveProfileSignalsResult = Pick<
  EnrichedProfile,
  'role_family' | 'seniority' | 'job_preferences' | 'normalized_skills'
>;

function profilePositionRoles(data: CollectedData): string[] {
  const roles: string[] = [];
  for (let i = 1; i <= 5; i += 1) {
    const v = data[`position_${i}_role` as keyof CollectedData];
    if (typeof v === 'string' && v.trim()) roles.push(v);
  }
  return roles;
}

export function inferUserSeniorityFromYears(totalExperience: number | undefined): SeniorityLevel | null {
  if (totalExperience == null || totalExperience <= 0) return null;
  if (totalExperience < 1) return 'intern';
  if (totalExperience < 3) return 'junior';
  if (totalExperience < 6) return 'middle';
  if (totalExperience < 10) return 'senior';
  return 'lead';
}

function inferSeniorityFromRoleText(role: string): SeniorityLevel | null {
  const lower = role.toLowerCase();
  if (/\b(intern|стаж[её]р|trainee|практикант)\b/.test(lower)) return 'intern';
  if (/\b(junior|джуниор|младш)\b/.test(lower)) return 'junior';
  if (/\b(middle|миддл|мидл)\b/.test(lower)) return 'middle';
  if (/\b(senior|сеньор|старш|ведущ)\b/.test(lower)) return 'senior';
  if (/\b(lead|head|chief|director|директор|руководитель|vp|cto|cpo|главн)\b/.test(lower)) {
    return 'lead';
  }
  return null;
}

function parseTotalExperience(raw: CollectedData): number | undefined {
  const v: unknown = raw.totalExperience;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = parseFloat(v.replace(/,/g, '.'));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function inferSkillLevel(
  skillName: string,
  seniority: SeniorityLevel | null,
  sourceText: string
): NormalizedSkill['level'] {
  const lower = sourceText.toLowerCase();
  const skillLower = skillName.toLowerCase();
  if (
    new RegExp(`(эксперт|expert|advanced|продвинут).{0,30}${skillLower}|${skillLower}.{0,30}(эксперт|expert|advanced)`).test(
      lower
    )
  ) {
    return 'expert';
  }
  if (seniority === 'senior' || seniority === 'lead') return 'advanced';
  if (seniority === 'middle') return 'intermediate';
  if (seniority === 'junior' || seniority === 'intern') return 'beginner';
  return 'intermediate';
}

function collectSkillSourceTexts(data: CollectedData): string {
  const parts: string[] = [];
  if (typeof data.careerSummary === 'string') parts.push(data.careerSummary);
  if (typeof data.skills_hard === 'string') parts.push(data.skills_hard);
  if (typeof data.skills_soft === 'string') parts.push(data.skills_soft);
  for (let i = 1; i <= 5; i += 1) {
    const ach = data[`position_${i}_achievements` as keyof CollectedData];
    if (typeof ach === 'string') parts.push(ach);
  }
  return parts.join('\n');
}

function buildJobPreferences(data: CollectedData): JobPreferences {
  const desiredRole =
    (typeof data.desiredRole === 'string' ? data.desiredRole : undefined) ||
    (typeof data.desired_role === 'string' ? data.desired_role : undefined);

  const locationText =
    (typeof data.desired_location === 'string' ? data.desired_location : '') ||
    (Array.isArray(data.location) ? data.location.join(', ') : '');

  const salaryText =
    (typeof data.salaryExpectation === 'string' ? data.salaryExpectation : undefined) ||
    (typeof data.desired_salary === 'string' ? data.desired_salary : undefined) ||
    extractSalaryFromText(locationText) ||
    undefined;

  const workModeRaw =
    (typeof data.workMode === 'string' ? data.workMode : undefined) ||
    extractWorkModeFromText(locationText);

  let work_format: JobPreferences['work_format'];
  if (workModeRaw === 'remote') work_format = 'remote';
  else if (workModeRaw === 'hybrid') work_format = 'hybrid';
  else if (workModeRaw === 'office') work_format = 'office';

  const cities = extractCitiesFromDesiredLocation(data.desired_location ?? data.location);
  const salaryMin =
    parseSalaryMinRub(data.salaryExpectation) ?? parseSalaryMinRub(data.desired_salary);

  const seniorityTarget = desiredRole ? inferSeniorityFromRoleText(desiredRole) : null;

  const prefs: JobPreferences = {
    target_role: desiredRole?.trim() || undefined,
    seniority_target: seniorityTarget ?? undefined,
    work_format,
    locations: cities.length > 0 ? cities : undefined,
    salary_min_rub: salaryMin ?? undefined,
    salary_text: salaryText,
    start_date:
      typeof data.desired_start === 'string' && data.desired_start.trim()
        ? data.desired_start.trim()
        : undefined,
    motivation:
      typeof data.desired_culture === 'string' && data.desired_culture.trim()
        ? data.desired_culture.trim()
        : undefined,
  };

  // Seed domains from position industries (LLM may enrich further)
  const industries: string[] = [];
  for (let i = 1; i <= 5; i += 1) {
    const ind = data[`position_${i}_industry` as keyof CollectedData];
    if (typeof ind === 'string' && ind.trim()) industries.push(ind.trim());
  }
  if (industries.length > 0) {
    prefs.domains = [...new Set(industries)].slice(0, 8);
  }

  // Seed red_flags from free-text exclusions («не рассматриваю банки», «убери ВТБ»)
  const exclusionHints = [
    typeof data.additional_info === 'string' ? data.additional_info : '',
    typeof data.additionalNotes === 'string' ? data.additionalNotes : '',
  ]
    .join(' ')
    .toLowerCase()
    .replace(/ё/g, 'е');
  const flags: string[] = [];
  if (
    /не рассматрив|убери|убрать|исключи|без банк/.test(exclusionHints) &&
    /банк/.test(exclusionHints)
  ) {
    flags.push('банки');
  }
  if (/гембл|казино|букмекер/.test(exclusionHints)) flags.push('гемблинг');
  if (/убери\s+втб|убрать\s+втб|исключи\s+втб|втб\s+не\s+рассматри/.test(exclusionHints)) {
    flags.push('ВТБ');
  }
  if (/убери\s+сбер|убрать\s+сбер|исключи\s+сбер|сбер\s+не\s+рассматри/.test(exclusionHints)) {
    flags.push('Сбер');
  }
  if (flags.length > 0) prefs.red_flags = [...new Set(flags)];

  return prefs;
}

function buildNormalizedSkills(
  data: CollectedData,
  seniority: SeniorityLevel | null
): NormalizedSkill[] {
  const desiredRole =
    (typeof data.desiredRole === 'string' ? data.desiredRole : undefined) ||
    (typeof data.desired_role === 'string' ? data.desired_role : undefined);
  const careerSummary = typeof data.careerSummary === 'string' ? data.careerSummary : '';
  const positionRoles = profilePositionRoles(data);
  const sourceText = collectSkillSourceTexts(data);

  const lexicon = skillsForProfileText({
    desiredRole,
    careerSummary,
    positionRoles,
  });

  const fromLexicon = extractSkillsFromTextWithLexicon(sourceText, lexicon);
  const manualParts: string[] = [];
  const addManual = (s: unknown) => {
    if (typeof s !== 'string' || !s.trim()) return;
    s.split(/[,;\n]/).forEach((p) => {
      const t = p.trim();
      if (t) manualParts.push(t);
    });
  };
  addManual(data.skills_hard);
  addManual(data.skills_soft);
  if (Array.isArray(data.skills)) {
    for (const x of data.skills) {
      if (typeof x === 'string' && x.trim()) manualParts.push(x.trim());
    }
  }

  const allNames = [...new Set([...fromLexicon, ...manualParts.map((s) => s.toLowerCase())])];
  return allNames.map((name) => ({
    name,
    level: inferSkillLevel(name, seniority, sourceText),
    source: manualParts.some((m) => m.toLowerCase() === name) ? ('chat' as const) : ('inferred' as const),
    confidence: manualParts.some((m) => m.toLowerCase() === name) ? 0.9 : 0.7,
  }));
}

export function deriveProfileSignals(raw: CollectedData | null): DeriveProfileSignalsResult {
  if (!raw) {
    return {};
  }

  const data = enrichQuickPathCollectedData({ ...raw });
  const classification = classifyProfileRoles({
    desiredRole:
      (typeof data.desiredRole === 'string' ? data.desiredRole : undefined) ||
      (typeof data.desired_role === 'string' ? data.desired_role : undefined),
    positionRoles: profilePositionRoles(data),
    careerSummary: typeof data.careerSummary === 'string' ? data.careerSummary : null,
  });

  const role_family: RoleFamily = classification.primary;
  const years = parseTotalExperience(data);
  let seniority =
    inferUserSeniorityFromYears(years) ??
    inferSeniorityFromRoleText(
      (typeof data.desired_role === 'string' ? data.desired_role : '') ||
        (typeof data.desiredRole === 'string' ? data.desiredRole : '')
    );

  const job_preferences = buildJobPreferences(data);
  const normalized_skills = buildNormalizedSkills(data, seniority);

  return {
    role_family: role_family !== 'unknown' ? role_family : undefined,
    seniority: seniority ?? undefined,
    job_preferences,
    normalized_skills: normalized_skills.length > 0 ? normalized_skills : undefined,
  };
}

/** Apply enriched snapshot fields onto collectedData for matching. */
export function applyEnrichedToCollectedData(data: CollectedData): CollectedData {
  const enriched = getEnrichedFromCollected(data as Record<string, unknown>);
  if (!enriched) return data;

  const merged: CollectedData = { ...data, [ENRICHED_COLLECTED_KEY]: enriched };

  const prefs = enriched.job_preferences;
  if (prefs?.locations?.length && !merged.location?.length) {
    merged.location = prefs.locations;
  }
  if (prefs?.work_format && !merged.workMode) {
    merged.workMode = prefs.work_format;
  }
  if (prefs?.salary_text && !merged.salaryExpectation) {
    merged.salaryExpectation = prefs.salary_text;
  }
  if (prefs?.target_role && !merged.desiredRole) {
    merged.desiredRole = prefs.target_role;
    merged.desired_role = prefs.target_role;
  }
  if (enriched.normalized_skills?.length) {
    const names = enriched.normalized_skills.map((s) => s.name);
    const existing = Array.isArray(merged.skills) ? merged.skills.map(String) : [];
    merged.skills = [...new Set([...existing, ...names])];
  }

  return merged;
}
