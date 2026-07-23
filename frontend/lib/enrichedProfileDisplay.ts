import type { AppLocale } from '@/types/appSettings';
import type { ProfileSidebarRow } from '@/lib/jackProfileFieldCatalog';
import { toSecondPersonMarketFit } from '@/lib/marketFitCopy';

export type EnrichedProfileView = {
  version?: number;
  enrichedAt?: string;
  role_family?: string;
  seniority?: string;
  job_preferences?: {
    target_role?: string;
    work_format?: string;
    locations?: string[];
    salary_text?: string;
    motivation?: string;
    domains?: string[];
    red_flags?: string[];
  };
  normalized_skills?: Array<{ name: string; level?: string }>;
  profile_completeness?: number;
  missing_fields?: string[];
  market_fit_summary?: string;
  achievements_with_metrics?: Array<{
    achievement: string;
    metric_before?: string;
    metric_after?: string;
    company?: string;
  }>;
  /** true when built from collected/DB fields without full LEO enrichment */
  isFallback?: boolean;
};

const PROFILE_COMPLETENESS_SLOTS: Array<{
  id: string;
  labelRu: string;
  labelEn: string;
  check: (data: Record<string, unknown>) => boolean;
}> = [
  {
    id: 'career',
    labelRu: 'обзор карьеры',
    labelEn: 'career overview',
    check: (d) => isFilledValue(d.careerSummary),
  },
  {
    id: 'experience',
    labelRu: 'общий опыт',
    labelEn: 'total experience',
    check: (d) => isFilledValue(d.totalExperience),
  },
  {
    id: 'position',
    labelRu: 'опыт / позиции',
    labelEn: 'positions',
    check: (d) =>
      isFilledValue(d.position_1_company) ||
      isFilledValue(d.position_1_role) ||
      (typeof d.careerSummary === 'string' && d.careerSummary.trim().length > 40),
  },
  {
    id: 'education',
    labelRu: 'образование',
    labelEn: 'education',
    check: (d) => isFilledValue(d.education_main) || isFilledValue(d.education),
  },
  {
    id: 'role',
    labelRu: 'желаемая должность',
    labelEn: 'desired role',
    check: (d) => isFilledValue(d.desired_role) || isFilledValue(d.desiredRole),
  },
  {
    id: 'skills',
    labelRu: 'навыки',
    labelEn: 'skills',
    check: (d) => {
      if (isFilledValue(d.skills_hard) || isFilledValue(d.skills_soft)) return true;
      if (Array.isArray(d.skills) && d.skills.length > 0) return true;
      if (typeof d.skills === 'string' && d.skills.trim()) return true;
      return false;
    },
  },
  {
    id: 'location',
    labelRu: 'локация и формат',
    labelEn: 'location / work format',
    check: (d) =>
      isFilledValue(d.desired_location) ||
      isFilledValue(d.workMode) ||
      isFilledValue(d.workFormat) ||
      (Array.isArray(d.location) && d.location.length > 0) ||
      isFilledValue(d.location),
  },
  {
    id: 'salary',
    labelRu: 'ожидания по зарплате',
    labelEn: 'salary expectations',
    check: (d) => isFilledValue(d.desired_salary) || isFilledValue(d.salaryExpectation),
  },
];

function isFilledValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function computeDisplayCompleteness(
  collected: Record<string, unknown>,
  locale: AppLocale
): { profile_completeness: number; missing_fields: string[] } {
  const missing: string[] = [];
  for (const slot of PROFILE_COMPLETENESS_SLOTS) {
    if (!slot.check(collected)) {
      missing.push(locale === 'en' ? slot.labelEn : slot.labelRu);
    }
  }
  return {
    profile_completeness: Math.max(0, Math.min(1, 1 - missing.length / PROFILE_COMPLETENESS_SLOTS.length)),
    missing_fields: missing.slice(0, 8),
  };
}

function parseSkillsList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0);
  }
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return raw
    .split(/[,;|/\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

function inferSeniorityFromExperience(years: number | undefined): string | undefined {
  if (years == null || years <= 0) return undefined;
  if (years < 1) return 'intern';
  if (years < 3) return 'junior';
  if (years < 6) return 'middle';
  if (years < 10) return 'senior';
  return 'lead';
}

function parseExperienceYears(collected: Record<string, unknown>): number | undefined {
  const raw = collected.totalExperience;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const n = parseFloat(raw.replace(/,/g, '.'));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Rule-based snapshot when `__enriched` is missing (same user, enrichment not run or failed). */
export function buildFallbackEnrichedProfile(
  collected: Record<string, unknown>
): EnrichedProfileView | null {
  const targetRole =
    (typeof collected.desired_role === 'string' && collected.desired_role.trim()) ||
    (typeof collected.desiredRole === 'string' && collected.desiredRole.trim()) ||
    (typeof collected.position_1_role === 'string' && collected.position_1_role.trim()) ||
    '';

  const skills = [
    ...parseSkillsList(collected.skills_hard),
    ...parseSkillsList(collected.skills),
    ...parseSkillsList(collected.skills_soft),
  ];
  const uniqueSkills = [...new Set(skills.map((s) => s.trim()).filter(Boolean))];

  const expYears = parseExperienceYears(collected);
  const location =
    typeof collected.desired_location === 'string'
      ? collected.desired_location.trim()
      : typeof collected.location === 'string'
        ? collected.location.trim()
        : '';

  const hasSignal = Boolean(targetRole || uniqueSkills.length > 0 || expYears != null || location);
  if (!hasSignal) return null;

  const completeness = computeDisplayCompleteness(collected, 'ru');

  return {
    isFallback: true,
    job_preferences: {
      target_role: targetRole || undefined,
      locations: location ? [location] : undefined,
      salary_text:
        typeof collected.desired_salary === 'string'
          ? collected.desired_salary
          : typeof collected.salaryExpectation === 'string'
            ? collected.salaryExpectation
            : undefined,
      red_flags:
        typeof collected.additional_info === 'string' && collected.additional_info.trim()
          ? [collected.additional_info.trim()]
          : undefined,
    },
    seniority: inferSeniorityFromExperience(expYears),
    normalized_skills: uniqueSkills.slice(0, 16).map((name) => ({ name })),
    profile_completeness: completeness.profile_completeness,
    missing_fields: completeness.missing_fields,
  };
}

/** Full LEO enrichment if present, otherwise rule-based snapshot from profile fields. */
export function resolveDisplayEnrichedProfile(
  collected: Record<string, unknown>,
  locale: AppLocale = 'ru'
): EnrichedProfileView | null {
  const stored = parseEnrichedProfile(collected);
  if (stored) {
    // Пересчитываем полноту по актуальным полям — не показываем устаревшие LLM-пробелы
    const skillsFromEnriched = stored.normalized_skills?.length
      ? stored.normalized_skills.map((s) => s.name)
      : [];
    const mergedForCheck: Record<string, unknown> = {
      ...collected,
      skills_hard:
        collected.skills_hard ||
        (skillsFromEnriched.length ? skillsFromEnriched.join(', ') : collected.skills_hard),
      desired_salary:
        collected.desired_salary ||
        stored.job_preferences?.salary_text ||
        collected.desired_salary,
      workMode: collected.workMode || stored.job_preferences?.work_format || collected.workMode,
    };
    const refreshed = computeDisplayCompleteness(mergedForCheck, locale);
    return {
      ...stored,
      isFallback: false,
      profile_completeness: refreshed.profile_completeness,
      missing_fields: refreshed.missing_fields,
      market_fit_summary: stored.market_fit_summary
        ? toSecondPersonMarketFit(stored.market_fit_summary)
        : stored.market_fit_summary,
    };
  }
  return buildFallbackEnrichedProfile(collected);
}

export function hasCareerSnapshotData(view: EnrichedProfileView | null): view is EnrichedProfileView {
  if (!view) return false;
  return Boolean(
    view.job_preferences?.target_role ||
      view.role_family ||
      view.seniority ||
      view.normalized_skills?.length ||
      typeof view.profile_completeness === 'number' ||
      view.market_fit_summary
  );
}

const FAMILY_LABELS: Record<string, string> = {
  product: 'Продукт',
  engineering: 'Разработка',
  analytics: 'Аналитика',
  design: 'Дизайн',
  marketing: 'Маркетинг',
  sales: 'Продажи',
  hr: 'HR',
  qa: 'QA',
  finance: 'Финансы',
  wellbeing: 'Wellbeing',
  unknown: 'Не определено',
};

const SENIORITY_LABELS: Record<string, string> = {
  intern: 'Стажёр',
  junior: 'Junior',
  middle: 'Middle',
  senior: 'Senior',
  lead: 'Lead / Head',
};

export function parseEnrichedProfile(collected: Record<string, unknown>): EnrichedProfileView | null {
  const raw = collected.__enriched;
  if (!raw || typeof raw !== 'object') return null;
  return raw as EnrichedProfileView;
}

export function getEnrichedProfileSidebarRows(
  collected: Record<string, unknown>,
  locale: AppLocale = 'ru'
): ProfileSidebarRow[] {
  const enriched = resolveDisplayEnrichedProfile(collected);
  if (!enriched) return [];

  const section = locale === 'en' ? 'LEO Profile' : 'Карьерный профиль LEO';
  const rows: ProfileSidebarRow[] = [];

  if (enriched.role_family) {
    rows.push({
      section,
      label: locale === 'en' ? 'Role family' : 'Направление',
      key: '__enriched.role_family',
      value: FAMILY_LABELS[enriched.role_family] ?? enriched.role_family,
      filled: true,
    });
  }
  if (enriched.seniority) {
    rows.push({
      section,
      label: locale === 'en' ? 'Seniority' : 'Уровень',
      key: '__enriched.seniority',
      value: SENIORITY_LABELS[enriched.seniority] ?? enriched.seniority,
      filled: true,
    });
  }
  const prefs = enriched.job_preferences;
  if (prefs?.target_role) {
    rows.push({
      section,
      label: locale === 'en' ? 'Target role' : 'Целевая роль',
      key: '__enriched.target_role',
      value: prefs.target_role,
      filled: true,
    });
  }
  if (prefs?.work_format || prefs?.locations?.length) {
    const loc = prefs.locations?.join(', ');
    rows.push({
      section,
      label: locale === 'en' ? 'Format & location' : 'Формат и локация',
      key: '__enriched.location',
      value: [prefs.work_format, loc].filter(Boolean).join(' · '),
      filled: true,
    });
  }
  if (prefs?.salary_text) {
    rows.push({
      section,
      label: locale === 'en' ? 'Salary' : 'Зарплата',
      key: '__enriched.salary',
      value: prefs.salary_text,
      filled: true,
    });
  }
  if (typeof enriched.profile_completeness === 'number') {
    rows.push({
      section,
      label: locale === 'en' ? 'Profile completeness' : 'Полнота профиля',
      key: '__enriched.completeness',
      value: `${Math.round(enriched.profile_completeness * 100)}%`,
      filled: true,
    });
  }
  if (enriched.missing_fields?.length) {
    rows.push({
      section,
      label: locale === 'en' ? 'Missing' : 'Не хватает',
      key: '__enriched.missing',
      value: enriched.missing_fields.slice(0, 3).join('; '),
      filled: true,
    });
  }
  if (enriched.normalized_skills?.length) {
    rows.push({
      section,
      label: locale === 'en' ? 'Key skills' : 'Ключевые навыки',
      key: '__enriched.skills',
      value: enriched.normalized_skills
        .slice(0, 8)
        .map((s) => (s.level ? `${s.name} (${s.level})` : s.name))
        .join(', '),
      filled: true,
    });
  }
  if (enriched.market_fit_summary) {
    rows.push({
      section,
      label: locale === 'en' ? 'Market overview' : 'Обзор рынка',
      key: '__enriched.market_fit',
      value: toSecondPersonMarketFit(enriched.market_fit_summary),
      filled: true,
    });
  }
  if (enriched.achievements_with_metrics?.length) {
    rows.push({
      section,
      label: locale === 'en' ? 'Achievements' : 'Достижения',
      key: '__enriched.achievements',
      value: enriched.achievements_with_metrics
        .slice(0, 3)
        .map((a) => {
          if (a.metric_before && a.metric_after) {
            return `${a.achievement} (${a.metric_before} → ${a.metric_after})`;
          }
          return a.achievement;
        })
        .join('; '),
      filled: true,
    });
  }

  return rows;
}
