/**
 * Подписи и порядок полей анкеты Jack для боковой панели «Профиль».
 * Соответствует collectKey в services/conversation/src/scenario/jackScenario.ts
 */

import type { AppLocale } from '@/types/appSettings';

export type JackFieldDef = {
  key: string;
  label: string;
  section: string;
};

const OMIT_DISPLAY_KEYS = new Set([
  'clarifiedAnswer',
  'scenarioMode',
  'resumeUploadHint',
  /** Алиасы и обогащение quick/resume path — уже есть в основных полях */
  'desiredRole',
  'total_experience',
  'location',
  'skills',
  'workMode',
  'work_mode',
  /** STAR bank для Interview Prep (seed из enrichment) — не поле анкеты Jack */
  'starBank',
]);

/** Служебные ключи collectedData (RAG, флаги) — не показываем в «Профиль» */
function shouldOmitProfileKey(key: string): boolean {
  if (key.startsWith('__')) return true;
  if (key === '__enriched') return true;
  return OMIT_DISPLAY_KEYS.has(key);
}

export const JACK_PROFILE_FIELD_ORDER: JackFieldDef[] = [
  { section: 'Старт', key: 'readyToStart', label: 'Готовность начать' },
  { section: 'Старт', key: 'pauseChoice', label: 'Пауза' },
  { section: 'Старт', key: 'privacyConfirmed', label: 'Согласие с приватностью' },

  { section: 'Карьера', key: 'careerSummary', label: 'Краткий обзор карьеры' },
  { section: 'Карьера', key: 'totalExperience', label: 'Опыт работы (лет)' },
  { section: 'Карьера', key: 'positionsCount', label: 'Сколько позиций описать' },

  { section: 'Позиция 1', key: 'position_1_company', label: 'Компания и период' },
  { section: 'Позиция 1', key: 'position_1_role', label: 'Должность' },
  { section: 'Позиция 1', key: 'position_1_industry', label: 'Отрасль' },
  { section: 'Позиция 1', key: 'position_1_team', label: 'Команда' },
  { section: 'Позиция 1', key: 'position_1_responsibilities', label: 'Обязанности' },
  { section: 'Позиция 1', key: 'position_1_achievements', label: 'Достижения' },
  { section: 'Позиция 1', key: 'position_1_projects', label: 'Ключевые проекты' },

  { section: 'Позиция 2', key: 'position_2_company', label: 'Компания и период' },
  { section: 'Позиция 2', key: 'position_2_role', label: 'Должность' },
  { section: 'Позиция 2', key: 'position_2_industry', label: 'Отрасль' },
  { section: 'Позиция 2', key: 'position_2_team', label: 'Команда' },
  { section: 'Позиция 2', key: 'position_2_achievements', label: 'Достижения' },

  { section: 'Позиция 3', key: 'position_3_company', label: 'Компания и период' },
  { section: 'Позиция 3', key: 'position_3_role', label: 'Должность' },
  { section: 'Позиция 3', key: 'position_3_achievements', label: 'Достижения' },

  { section: 'Позиция 4', key: 'position_4_company', label: 'Компания и период' },
  { section: 'Позиция 4', key: 'position_4_role', label: 'Должность' },
  { section: 'Позиция 4', key: 'position_4_achievements', label: 'Достижения' },

  { section: 'Позиция 5', key: 'position_5_company', label: 'Компания и период' },
  { section: 'Позиция 5', key: 'position_5_role', label: 'Должность' },
  { section: 'Позиция 5', key: 'position_5_achievements', label: 'Достижения' },

  { section: 'Образование', key: 'education_main', label: 'Основное образование' },
  { section: 'Образование', key: 'education_additional', label: 'Доп. образование и сертификаты' },

  { section: 'Навыки', key: 'skills_hard', label: 'Технические навыки' },
  { section: 'Навыки', key: 'skills_soft', label: 'Управленческие навыки' },
  { section: 'Навыки', key: 'skills_languages', label: 'Языки' },

  { section: 'Поиск работы', key: 'desired_role', label: 'Желаемая должность' },
  { section: 'Поиск работы', key: 'desired_location', label: 'Локация и формат' },
  { section: 'Поиск работы', key: 'desired_salary', label: 'Зарплатные ожидания' },
  { section: 'Поиск работы', key: 'desired_culture', label: 'Культура и ценности' },
  { section: 'Поиск работы', key: 'desired_start', label: 'Когда готовы выйти' },

  { section: 'Завершение', key: 'additional_info', label: 'Дополнительно' },
  { section: 'Завершение', key: 'completionChoice', label: 'Заполнение пробелов' },
];

const JACK_PROFILE_FIELD_ORDER_EN: JackFieldDef[] = [
  { section: 'Start', key: 'readyToStart', label: 'Ready to start' },
  { section: 'Start', key: 'pauseChoice', label: 'Pause' },
  { section: 'Start', key: 'privacyConfirmed', label: 'Privacy consent' },

  { section: 'Career', key: 'careerSummary', label: 'Career overview' },
  { section: 'Career', key: 'totalExperience', label: 'Years of experience' },
  { section: 'Career', key: 'positionsCount', label: 'Positions to describe' },

  { section: 'Position 1', key: 'position_1_company', label: 'Company and period' },
  { section: 'Position 1', key: 'position_1_role', label: 'Job title' },
  { section: 'Position 1', key: 'position_1_industry', label: 'Industry' },
  { section: 'Position 1', key: 'position_1_team', label: 'Team' },
  { section: 'Position 1', key: 'position_1_responsibilities', label: 'Responsibilities' },
  { section: 'Position 1', key: 'position_1_achievements', label: 'Achievements' },
  { section: 'Position 1', key: 'position_1_projects', label: 'Key projects' },

  { section: 'Position 2', key: 'position_2_company', label: 'Company and period' },
  { section: 'Position 2', key: 'position_2_role', label: 'Job title' },
  { section: 'Position 2', key: 'position_2_industry', label: 'Industry' },
  { section: 'Position 2', key: 'position_2_team', label: 'Team' },
  { section: 'Position 2', key: 'position_2_achievements', label: 'Achievements' },

  { section: 'Position 3', key: 'position_3_company', label: 'Company and period' },
  { section: 'Position 3', key: 'position_3_role', label: 'Job title' },
  { section: 'Position 3', key: 'position_3_achievements', label: 'Achievements' },

  { section: 'Position 4', key: 'position_4_company', label: 'Company and period' },
  { section: 'Position 4', key: 'position_4_role', label: 'Job title' },
  { section: 'Position 4', key: 'position_4_achievements', label: 'Achievements' },

  { section: 'Position 5', key: 'position_5_company', label: 'Company and period' },
  { section: 'Position 5', key: 'position_5_role', label: 'Job title' },
  { section: 'Position 5', key: 'position_5_achievements', label: 'Achievements' },

  { section: 'Education', key: 'education_main', label: 'Primary education' },
  { section: 'Education', key: 'education_additional', label: 'Additional education & certs' },

  { section: 'Skills', key: 'skills_hard', label: 'Technical skills' },
  { section: 'Skills', key: 'skills_soft', label: 'Leadership skills' },
  { section: 'Skills', key: 'skills_languages', label: 'Languages' },

  { section: 'Job search', key: 'desired_role', label: 'Target role' },
  { section: 'Job search', key: 'desired_location', label: 'Location & format' },
  { section: 'Job search', key: 'desired_salary', label: 'Salary expectations' },
  { section: 'Job search', key: 'desired_culture', label: 'Culture & values' },
  { section: 'Job search', key: 'desired_start', label: 'Earliest start date' },

  { section: 'Wrap-up', key: 'additional_info', label: 'Additional info' },
  { section: 'Wrap-up', key: 'completionChoice', label: 'Fill gaps' },
];

export function getJackProfileFieldOrder(locale: AppLocale): JackFieldDef[] {
  return locale === 'en' ? JACK_PROFILE_FIELD_ORDER_EN : JACK_PROFILE_FIELD_ORDER;
}

function pickCollectedValue(collected: Record<string, unknown>, key: string): unknown {
  switch (key) {
    case 'desired_role':
      return collected.desired_role ?? collected.desiredRole;
    case 'totalExperience':
      return collected.totalExperience ?? collected.total_experience;
    default:
      return collected[key];
  }
}

export function isCollectedFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return !Number.isNaN(value);
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  return false;
}

export function formatCollectedValue(value: unknown, locale: AppLocale = 'ru'): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'string') {
    const t = value.trim();
    return t.length > 0 ? t : '—';
  }
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—';
  if (typeof value === 'boolean') {
    if (locale === 'en') return value ? 'yes' : 'no';
    return value ? 'да' : 'нет';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    return value.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ');
  }
  try {
    return JSON.stringify(value, null, 0);
  } catch {
    return String(value);
  }
}

export type ProfileSidebarRow = {
  section: string;
  label: string;
  key: string;
  value: string;
  filled: boolean;
};

/** Строки для отображения: известные поля по сценарию + прочие ключи из collectedData */
export function getJackProfileSidebarRows(
  collected: Record<string, unknown>,
  locale: AppLocale = 'ru'
): ProfileSidebarRow[] {
  const rows: ProfileSidebarRow[] = [];
  const used = new Set<string>();
  const fieldOrder = getJackProfileFieldOrder(locale);
  const otherSection = locale === 'en' ? 'Other' : 'Другое';

  for (const def of fieldOrder) {
    const raw = pickCollectedValue(collected, def.key);
    rows.push({
      section: def.section,
      label: def.label,
      key: def.key,
      value: formatCollectedValue(raw, locale),
      filled: isCollectedFilled(raw),
    });
    used.add(def.key);
    if (def.key === 'desired_role') {
      used.add('desiredRole');
    }
    if (def.key === 'totalExperience') {
      used.add('total_experience');
    }
  }

  for (const key of Object.keys(collected)) {
    if (used.has(key) || shouldOmitProfileKey(key)) continue;
    const raw = collected[key];
    rows.push({
      section: otherSection,
      label: key,
      key,
      value: formatCollectedValue(raw, locale),
      filled: isCollectedFilled(raw),
    });
  }

  return rows;
}
