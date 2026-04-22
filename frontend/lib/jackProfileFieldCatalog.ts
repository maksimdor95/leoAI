/**
 * Подписи и порядок полей анкеты Jack для боковой панели «Профиль».
 * Соответствует collectKey в services/conversation/src/scenario/jackScenario.ts
 */

export type JackFieldDef = {
  key: string;
  label: string;
  section: string;
};

const OMIT_DISPLAY_KEYS = new Set(['clarifiedAnswer']);

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

export function formatCollectedValue(value: unknown): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'string') {
    const t = value.trim();
    return t.length > 0 ? t : '—';
  }
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—';
  if (typeof value === 'boolean') return value ? 'да' : 'нет';
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
export function getJackProfileSidebarRows(collected: Record<string, unknown>): ProfileSidebarRow[] {
  const rows: ProfileSidebarRow[] = [];
  const used = new Set<string>();

  for (const def of JACK_PROFILE_FIELD_ORDER) {
    const raw = pickCollectedValue(collected, def.key);
    rows.push({
      section: def.section,
      label: def.label,
      key: def.key,
      value: formatCollectedValue(raw),
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
    if (used.has(key) || OMIT_DISPLAY_KEYS.has(key)) continue;
    const raw = collected[key];
    rows.push({
      section: 'Другое',
      label: key,
      key,
      value: formatCollectedValue(raw),
      filled: isCollectedFilled(raw),
    });
  }

  return rows;
}
