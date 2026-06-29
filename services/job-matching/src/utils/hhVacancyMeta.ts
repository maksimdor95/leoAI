/**
 * Human-readable vacancy conditions from HH API GET /vacancies/{id}.
 * @see https://github.com/hhru/api/blob/master/docs/vacancies.md
 */

export interface HhVacancyMeta {
  experienceLabel: string | null;
  experienceId: string | null;
  employmentLabel: string | null;
  employmentId: string | null;
  employmentForms: string[];
  employmentFormIds: string[];
  scheduleLabel: string | null;
  scheduleId: string | null;
  workScheduleDays: string | null;
  workScheduleDayIds: string[];
  workingHours: string | null;
  workingHourIds: string[];
  workFormatLabel: string | null;
  workFormatIds: string[];
}

type NamedEntity = { id?: string; name?: string };

function readName(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const name = (value as NamedEntity).name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

function readId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const id = (value as NamedEntity).id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

function readNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => readName(item))
    .filter((name): name is string => Boolean(name));
}

function readIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => readId(item))
    .filter((id): id is string => Boolean(id));
}

function joinLabels(labels: string[]): string | null {
  if (labels.length === 0) return null;
  return labels.join(' · ');
}

/** Map HH work_format to internal work_mode for matcher. */
export function mapHhWorkMode(vacancy: Record<string, unknown>): string | null {
  return resolveWorkModeFromFormatIds(readIds(vacancy.work_format), readNames(vacancy.work_format));
}

export function resolveWorkModeFromFormatIds(
  formatIds: string[],
  formatLabels: string[] = []
): string | null {
  const ids = formatIds.map((id) => id.toUpperCase());
  const labelsLower = formatLabels.map((label) => label.toLowerCase());

  if (ids.includes('REMOTE') || labelsLower.some((label) => label.includes('удал'))) {
    return 'remote';
  }
  if (ids.includes('HYBRID') || labelsLower.some((label) => label.includes('гибрид'))) {
    return 'hybrid';
  }
  if (
    ids.includes('ON_SITE') ||
    labelsLower.some((label) => label.includes('офис') || label.includes('на месте'))
  ) {
    return 'office';
  }

  return null;
}

export function extractHhVacancyMeta(vacancy: Record<string, unknown>): HhVacancyMeta {
  const employmentForms = readNames(vacancy.employment_form);
  const employmentFormIds = readIds(vacancy.employment_form);
  const workScheduleDayLabels = readNames(vacancy.work_schedule_by_days);
  const workScheduleDayIds = readIds(vacancy.work_schedule_by_days);
  const workingHourLabels = readNames(vacancy.working_hours);
  const workingHourIds = readIds(vacancy.working_hours);
  const workFormatLabels = readNames(vacancy.work_format);
  const workFormatIds = readIds(vacancy.work_format);

  const singleWorkFormat = readName(vacancy.work_format);
  const workFormatLabel =
    workFormatLabels.length > 0 ? joinLabels(workFormatLabels) : singleWorkFormat;

  return {
    experienceLabel: readName(vacancy.experience),
    experienceId: readId(vacancy.experience),
    employmentLabel: readName(vacancy.employment),
    employmentId: readId(vacancy.employment),
    employmentForms,
    employmentFormIds,
    scheduleLabel: readName(vacancy.schedule),
    scheduleId: readId(vacancy.schedule),
    workScheduleDays: joinLabels(workScheduleDayLabels),
    workScheduleDayIds,
    workingHours: joinLabels(workingHourLabels),
    workingHourIds,
    workFormatLabel,
    workFormatIds,
  };
}

/** HH experience.id → диапазон лет для матча. */
export function hhExperienceYearRange(experienceId: string | null | undefined): {
  minYears: number;
  maxYears: number;
} | null {
  switch (experienceId) {
    case 'noExperience':
      return { minYears: 0, maxYears: 0 };
    case 'between1And3':
      return { minYears: 1, maxYears: 3 };
    case 'between3And6':
      return { minYears: 3, maxYears: 6 };
    case 'moreThan6':
      return { minYears: 6, maxYears: 99 };
    default:
      return null;
  }
}

export const HH_LABOR_FORM_IDS = new Set([
  'FULL',
  'FULL_TIME',
  'EMPLOYMENT_CONTRACT',
]);

export const HH_GPH_FORM_IDS = new Set(['CIVIL_LAW', 'CIVIL_CONTRACT', 'GPH']);
