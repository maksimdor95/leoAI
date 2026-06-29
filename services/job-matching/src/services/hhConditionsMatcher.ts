/**
 * Сопоставление условий вакансии HH (source_meta) с профилем пользователя.
 * Каждый фактор учитывается только если поле есть в вакансии; без данных в профиле — нейтрально.
 */

import { Job } from '../models/job';
import { CollectedData } from './userService';
import {
  HH_GPH_FORM_IDS,
  HH_LABOR_FORM_IDS,
  HhVacancyMeta,
  hhExperienceYearRange,
  resolveWorkModeFromFormatIds,
} from '../utils/hhVacancyMeta';

export type HhMatchFactorResult = { points: number; reason?: string };

const EMPLOYMENT_POINTS = 6;
const EMPLOYMENT_FORM_POINTS = 6;
const SCHEDULE_POINTS = 4;
const WORKING_HOURS_POINTS = 3;

function readUserNumber(data: CollectedData, ...keys: string[]): number | null {
  for (const key of keys) {
    const raw = data[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string' && raw.trim()) {
      const parsed = Number(raw.replace(',', '.'));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function readUserString(data: CollectedData, ...keys: string[]): string | null {
  for (const key of keys) {
    const raw = data[key];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
  }
  return null;
}

function readUserBoolean(data: CollectedData, ...keys: string[]): boolean | null {
  for (const key of keys) {
    const raw = data[key];
    if (typeof raw === 'boolean') return raw;
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;
  }
  return null;
}

function normalizeEmploymentId(value: string): string {
  return value.trim().toLowerCase();
}

/** Явное или эвристическое предпочтение занятости (full / part / project). */
export function resolveUserEmploymentPreference(data: CollectedData): string | null {
  const explicit = readUserString(
    data,
    'employmentPreference',
    'employment_preference',
    'desiredEmployment',
    'desired_employment'
  );
  if (explicit) return normalizeEmploymentId(explicit);

  const years = readUserNumber(data, 'totalExperience', 'total_experience');
  if (years != null && years >= 2) {
    return 'full';
  }
  return null;
}

export function resolveUserAcceptGph(data: CollectedData): boolean | null {
  return readUserBoolean(data, 'acceptGph', 'accept_gph', 'readyForGph', 'ready_for_gph');
}

export function resolveUserWorkSchedulePreference(data: CollectedData): string | null {
  return readUserString(
    data,
    'workSchedulePreference',
    'work_schedule_preference',
    'schedulePreference',
    'schedule_preference'
  );
}

export function resolveUserWorkingHoursPreference(data: CollectedData): string | null {
  return readUserString(
    data,
    'workingHoursPreference',
    'working_hours_preference',
    'workingHours',
    'working_hours'
  );
}

export function resolveJobWorkMode(job: Job): string | null {
  const meta = job.source_meta;
  if (meta?.workFormatIds?.length) {
    const fromMeta = resolveWorkModeFromFormatIds(
      meta.workFormatIds,
      meta.workFormatLabel ? [meta.workFormatLabel] : []
    );
    if (fromMeta) return fromMeta;
  }
  return job.work_mode;
}

export function matchHhExperienceFromMeta(
  job: Job,
  userExperienceYears: number
): HhMatchFactorResult | null {
  const meta = job.source_meta;
  const range = hhExperienceYearRange(meta?.experienceId);
  if (!range || !meta?.experienceLabel) {
    return null;
  }

  const label = meta.experienceLabel;
  const { minYears, maxYears } = range;

  if (userExperienceYears >= minYears && userExperienceYears <= maxYears) {
    return { points: 15, reason: `Опыт работы: ${label}` };
  }

  if (userExperienceYears < minYears) {
    const gap = minYears - userExperienceYears;
    if (gap >= 3) {
      return { points: 0, reason: `Опыт ниже требования вакансии: ${label}` };
    }
    if (gap >= 1) {
      return { points: 6, reason: `Частичное совпадение по опыту: ${label}` };
    }
    return { points: 10, reason: `Близко к требованию по опыту: ${label}` };
  }

  const over = userExperienceYears - maxYears;
  if (over <= 2) {
    return { points: 12, reason: `Опыт выше требования, но допустимо: ${label}` };
  }
  if (over <= 5) {
    return { points: 8, reason: `Опыт выше диапазона вакансии: ${label}` };
  }
  return { points: 4, reason: `Значительно больше опыта, чем в вакансии: ${label}` };
}

export function matchHhEmployment(
  meta: HhVacancyMeta,
  data: CollectedData
): HhMatchFactorResult | null {
  if (!meta.employmentId || !meta.employmentLabel) {
    return null;
  }

  const userPref = resolveUserEmploymentPreference(data);
  if (!userPref) {
    return null;
  }

  const vacancyId = normalizeEmploymentId(meta.employmentId);
  if (vacancyId === userPref || meta.employmentLabel.toLowerCase().includes(userPref)) {
    return {
      points: EMPLOYMENT_POINTS,
      reason: `Занятость: ${meta.employmentLabel}`,
    };
  }

  if (userPref === 'full' && (vacancyId === 'part' || vacancyId === 'project')) {
    return {
      points: -4,
      reason: `Занятость не совпадает: вакансия «${meta.employmentLabel}», профиль — полная`,
    };
  }

  return {
    points: 0,
    reason: `Занятость: ${meta.employmentLabel}`,
  };
}

export function matchHhEmploymentForms(
  meta: HhVacancyMeta,
  data: CollectedData
): HhMatchFactorResult | null {
  if (meta.employmentFormIds.length === 0 && meta.employmentForms.length === 0) {
    return null;
  }

  const formIds = meta.employmentFormIds.map((id) => id.toUpperCase());
  const hasLabor = formIds.some((id) => HH_LABOR_FORM_IDS.has(id));
  const hasGph = formIds.some((id) => HH_GPH_FORM_IDS.has(id));
  const formsLabel =
    meta.employmentForms.length > 0 ? meta.employmentForms.join(' · ') : null;

  const acceptGph = resolveUserAcceptGph(data);
  const acceptedForms = readUserString(data, 'employmentFormsAccepted', 'employment_forms_accepted');
  const acceptedIds = acceptedForms
    ? acceptedForms.split(/[,;|]/).map((part) => part.trim().toUpperCase()).filter(Boolean)
    : [];

  if (acceptGph === false && hasGph && !hasLabor) {
    return {
      points: -EMPLOYMENT_FORM_POINTS,
      reason: `Оформление только ГПХ, в профиле ГПХ не указан${formsLabel ? `: ${formsLabel}` : ''}`,
    };
  }

  if (acceptedIds.length > 0) {
    const overlap = formIds.some((id) => acceptedIds.includes(id));
    if (overlap) {
      return {
        points: EMPLOYMENT_FORM_POINTS,
        reason: `Подходящее оформление: ${formsLabel ?? meta.employmentFormIds.join(', ')}`,
      };
    }
    return {
      points: 0,
      reason: `Оформление не из предпочтений профиля: ${formsLabel ?? ''}`.trim(),
    };
  }

  if (acceptGph === true && hasGph) {
    return {
      points: 4,
      reason: `Доступно оформление с ГПХ: ${formsLabel ?? 'ГПХ'}`,
    };
  }

  if (hasLabor && hasGph) {
    return {
      points: 2,
      reason: `Гибкое оформление: ${formsLabel ?? 'трудовой договор или ГПХ'}`,
    };
  }

  if (formsLabel) {
    return { points: 0, reason: `Оформление: ${formsLabel}` };
  }

  return null;
}

export function matchHhWorkSchedule(
  meta: HhVacancyMeta,
  data: CollectedData
): HhMatchFactorResult | null {
  const hasSchedule =
    meta.workScheduleDayIds.length > 0 ||
    Boolean(meta.workScheduleDays) ||
    Boolean(meta.scheduleId);
  if (!hasSchedule) {
    return null;
  }

  const userPref = resolveUserWorkSchedulePreference(data);
  const scheduleLabel =
    meta.workScheduleDays || meta.scheduleLabel || meta.scheduleId || 'график указан';

  if (!userPref) {
    return { points: 0, reason: `График: ${scheduleLabel}` };
  }

  const userNorm = userPref.toUpperCase();
  const vacancyIds = meta.workScheduleDayIds.map((id) => id.toUpperCase());
  const vacancyMatch =
    vacancyIds.includes(userNorm) ||
    (meta.workScheduleDays && meta.workScheduleDays.toLowerCase().includes(userPref.toLowerCase())) ||
    (meta.scheduleId && meta.scheduleId.toUpperCase() === userNorm);

  if (vacancyMatch) {
    return { points: SCHEDULE_POINTS, reason: `График совпадает: ${scheduleLabel}` };
  }

  return { points: 0, reason: `График вакансии: ${scheduleLabel}` };
}

export function matchHhWorkingHours(
  meta: HhVacancyMeta,
  data: CollectedData
): HhMatchFactorResult | null {
  if (meta.workingHourIds.length === 0 && !meta.workingHours) {
    return null;
  }

  const userPref = resolveUserWorkingHoursPreference(data);
  const hoursLabel = meta.workingHours || meta.workingHourIds.join(', ');

  if (!userPref) {
    return { points: 0, reason: `Рабочие часы: ${hoursLabel}` };
  }

  const userNorm = userPref.toUpperCase();
  const match =
    meta.workingHourIds.some((id) => id.toUpperCase() === userNorm) ||
    hoursLabel.toLowerCase().includes(userPref.toLowerCase());

  if (match) {
    return { points: WORKING_HOURS_POINTS, reason: `Рабочие часы совпадают: ${hoursLabel}` };
  }

  return { points: 0, reason: `Рабочие часы вакансии: ${hoursLabel}` };
}

export function matchHhVacancyConditions(
  job: Job,
  collectedData: CollectedData
): { points: number; reasons: string[] } {
  const meta = job.source_meta;
  if (!meta) {
    return { points: 0, reasons: [] };
  }

  const reasons: string[] = [];
  let points = 0;

  const employment = matchHhEmployment(meta, collectedData);
  if (employment) {
    points += employment.points;
    if (employment.reason) reasons.push(employment.reason);
  }

  const forms = matchHhEmploymentForms(meta, collectedData);
  if (forms) {
    points += forms.points;
    if (forms.reason) reasons.push(forms.reason);
  }

  const schedule = matchHhWorkSchedule(meta, collectedData);
  if (schedule) {
    points += schedule.points;
    if (schedule.reason) reasons.push(schedule.reason);
  }

  const hours = matchHhWorkingHours(meta, collectedData);
  if (hours) {
    points += hours.points;
    if (hours.reason) reasons.push(hours.reason);
  }

  return { points, reasons };
}
