/** Human-readable label for job board source (stored as hh.ru, superjob.ru, …). */
export function formatJobSourceLabel(source?: string | null): string | null {
  if (!source?.trim()) return null;
  const normalized = source.trim().toLowerCase();
  if (normalized === 'hh.ru' || normalized.includes('headhunter')) return 'HeadHunter';
  if (normalized === 'superjob.ru' || normalized.includes('superjob')) return 'SuperJob';
  if (normalized === 'geekjob.ru') return 'Geekjob';
  if (normalized === 'getmatch.ru') return 'Getmatch';
  if (normalized === 'career.habr.com') return 'Habr Career';
  if (normalized.startsWith('career_')) {
    const id = normalized.slice('career_'.length);
    const labels: Record<string, string> = {
      sber: 'Сбер Career',
      yandex: 'Яндекс Career',
      mts: 'МТС Career',
      wb: 'WB Career',
      alfa: 'Альфа Career',
      avito: 'Авито Career',
      vk: 'VK Career',
      tbank: 'Т-Банк Career',
    };
    return labels[id] || `Career ${id}`;
  }
  if (normalized.startsWith('tg_')) return 'Telegram';
  return source.trim();
}
