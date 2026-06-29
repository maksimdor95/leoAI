/**
 * Normalize external vacancy URLs for UI links.
 * Mock/demo jobs must not point at hh.ru with fake vacancy ids.
 */

const HH_VACANCY_ID_RE = /\/vacancy\/(\d+)/i;

/** Извлекает внешний ID вакансии (HH) из source + source_url. */
export function extractExternalVacancyId(source: string, sourceUrl: string): string | null {
  const raw = sourceUrl?.trim() || '';
  if (!raw || isDemoVacancySource(source, raw)) {
    return null;
  }
  if (source === 'hh.ru' || /hh\.ru/i.test(raw)) {
    return raw.match(HH_VACANCY_ID_RE)?.[1] ?? null;
  }
  return null;
}

export function buildHhVacancyUrl(vacancyId: string | number): string {
  return `https://hh.ru/vacancy/${vacancyId}`;
}

export function isDemoVacancySource(source: string, sourceUrl: string): boolean {
  if (source === 'demo' || source === 'mock') return true;
  const url = sourceUrl.trim().toLowerCase();
  return url.startsWith('demo://') || /\/vacancy\/mock-/i.test(url);
}

/**
 * Returns an https URL safe to show as "Открыть вакансию", or null.
 */
export function resolvePublicVacancyUrl(source: string, sourceUrl: string): string | null {
  const raw = sourceUrl?.trim() || '';
  if (!raw || isDemoVacancySource(source, raw)) {
    return null;
  }

  if (source === 'hh.ru' || /hh\.ru/i.test(raw)) {
    const id = raw.match(HH_VACANCY_ID_RE)?.[1];
    if (id) {
      return buildHhVacancyUrl(id);
    }
    // Generic listing pages are not a single vacancy.
    if (/\/vacancies\/?$/i.test(raw) || raw === 'https://hh.ru' || raw === 'https://hh.ru/') {
      return null;
    }
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
