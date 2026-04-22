/**
 * Profile-driven scraping parameters.
 *
 * Преобразует `CollectedData` пользователя в параметры для scraper'а:
 * - ключевые слова из role-family + желаемой роли;
 * - locationId HH для указанной локации.
 *
 * Цель: больше не таскать JS/React/Python для продакт-менеджера.
 */

import { CollectedData } from './userService';
import { classifyProfileRoles, keywordsForFamily, RoleFamily } from './roleFamily';

/** HH area IDs для часто встречающихся городов. Fallback — вся Россия (113). */
const HH_AREA_BY_CITY: Record<string, number> = {
  'москва': 1,
  'санкт-петербург': 2,
  'спб': 2,
  'новосибирск': 4,
  'екатеринбург': 3,
  'казань': 88,
  'нижний новгород': 66,
  'краснодар': 53,
  'ростов-на-дону': 76,
  'самара': 78,
  'уфа': 99,
  'челябинск': 104,
  'пермь': 72,
  'воронеж': 26,
  'волгоград': 24,
  'саратов': 79,
  'минск': 1001,
  'алматы': 160,
  'ташкент': 2759,
  'тбилиси': 2396,
};

/** HH area по-умолчанию — Россия целиком. */
const HH_DEFAULT_AREA = 113;

export interface ScrapeParams {
  keywords: string[];
  locationId: number;
  /** Human-readable отладка для логов / API. */
  familyPrimary: RoleFamily;
  familyAdjacent: RoleFamily[];
  /** Расширения источников не зависят от пользователя, но держим место для них. */
  keywordSource: 'profile' | 'fallback';
}

/**
 * Резолвит ключевые слова: основная family + до одного смежного
 * (если их ключи не пересекаются) + 1–2 "собственных" фрагмента
 * желаемой роли (например, "Head of Product") для повышения точности.
 */
function resolveKeywords(
  desiredRole: string | null | undefined,
  primary: RoleFamily,
  adjacent: RoleFamily[]
): string[] {
  const set = new Set<string>();

  // Сначала — самые точные запросы из фразы желаемой роли.
  if (desiredRole) {
    for (const fragment of desiredRole.split(/[/|;,]/)) {
      const trimmed = fragment.trim();
      if (trimmed.length >= 4) set.add(trimmed);
    }
  }

  for (const kw of keywordsForFamily(primary)) {
    set.add(kw);
  }

  // Берём первое смежное семейство для разнообразия каталога,
  // но не более 3 ключевых слов из него.
  if (adjacent.length > 0) {
    const adjKeywords = keywordsForFamily(adjacent[0]).slice(0, 3);
    for (const kw of adjKeywords) set.add(kw);
  }

  return Array.from(set);
}

function resolveLocationId(loc: string | null | undefined): number {
  if (!loc) return HH_DEFAULT_AREA;
  const lower = loc.toLowerCase();
  for (const [city, id] of Object.entries(HH_AREA_BY_CITY)) {
    if (lower.includes(city)) return id;
  }
  return HH_DEFAULT_AREA;
}

/** Для CollectedData поле desired_location — произвольная строка; достаём город. */
function extractCity(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // "Москва, гибрид 2-3 дня в офисе" → "Москва"
  const first = raw.split(/[,;]/)[0]?.trim();
  return first || null;
}

export function deriveScrapeParams(data: CollectedData | null | undefined): ScrapeParams {
  if (!data) {
    return {
      keywords: [],
      locationId: HH_DEFAULT_AREA,
      familyPrimary: 'unknown',
      familyAdjacent: [],
      keywordSource: 'fallback',
    };
  }

  const desiredRole =
    (typeof data.desiredRole === 'string' && data.desiredRole.trim()) ||
    (typeof data.desired_role === 'string' && data.desired_role.trim()) ||
    null;

  const positionRoles: string[] = [];
  for (let i = 1; i <= 5; i += 1) {
    const v = data[`position_${i}_role` as keyof CollectedData];
    if (typeof v === 'string' && v.trim()) positionRoles.push(v);
  }

  const classification = classifyProfileRoles({
    desiredRole,
    positionRoles,
    careerSummary: typeof data.careerSummary === 'string' ? data.careerSummary : null,
  });

  const city =
    extractCity(data.desired_location) ??
    (Array.isArray(data.location) && data.location.length > 0
      ? String(data.location[0])
      : null);

  const locationId = resolveLocationId(city);
  const keywords = resolveKeywords(
    desiredRole,
    classification.primary,
    classification.adjacent
  );

  return {
    keywords,
    locationId,
    familyPrimary: classification.primary,
    familyAdjacent: classification.adjacent,
    keywordSource: keywords.length > 0 ? 'profile' : 'fallback',
  };
}

/** HH area для случаев, когда нужно подставить дефолт без профиля. */
export const HH_AREA_DEFAULT = HH_DEFAULT_AREA;
