/** Human-readable label for job board source (stored as hh.ru, superjob.ru, …). */
export function formatJobSourceLabel(source?: string | null): string | null {
  if (!source?.trim()) return null;
  const normalized = source.trim().toLowerCase();
  if (normalized === 'hh.ru' || normalized.includes('headhunter')) return 'HeadHunter';
  if (normalized === 'superjob.ru' || normalized.includes('superjob')) return 'SuperJob';
  return source.trim();
}
