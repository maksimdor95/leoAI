/**
 * Cross-source vacancy dedup for match results.
 * Same role at the same employer from HH + career site → one card.
 * Priority: career_* > niche boards > HH/SJ > tg > other.
 */

import type { Job } from '../models/job';

export interface DedupableMatch {
  job: Job;
  score: number;
}

const COMPANY_ALIASES: Array<[RegExp, string]> = [
  [/сбербанк/gi, 'сбер'],
  [/сбер\b/gi, 'сбер'],
  [/яндекс/gi, 'яндекс'],
  [/yandex/gi, 'яндекс'],
  [/wildberries|wb\b|rwb/gi, 'wb'],
  [/альфа[-\s]?банк|alfabank/gi, 'альфа'],
  [/мтс\b|mts\b/gi, 'мтс'],
  [/тинькофф|т[-\s]?банк|tbank/gi, 'тбанк'],
  [/авито|avito/gi, 'авито'],
  [/\bvk\b|вконтакте/gi, 'vk'],
];

export function normalizeJobTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[«»"'`]/g, '')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[|/·•—–_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeCompanyName(company: string): string {
  let s = company.toLowerCase().trim();
  // Cyrillic legal forms — `\b` is unreliable for Cyrillic in JS.
  s = s.replace(/(?:^|[\s,.])(?:пао|оао|зао|ооо|ао)\.?(?=[\s,]|$)/gi, ' ');
  s = s.replace(/\b(?:llc|inc|ltd|pjsc|jsc)\b\.?/gi, ' ');
  for (const [re, canon] of COMPANY_ALIASES) {
    s = s.replace(re, canon);
  }
  return s.replace(/[^a-zа-яё0-9]+/gi, '').trim();
}

/** Fingerprint for cross-source collapse. Empty if too thin to trust. */
export function jobFingerprint(job: Pick<Job, 'title' | 'company'>): string | null {
  const title = normalizeJobTitle(job.title || '');
  const company = normalizeCompanyName(job.company || '');
  if (title.length < 8 || company.length < 2) return null;
  return `${company}::${title}`;
}

/**
 * Higher = preferred as the visible card.
 * career_* (employer site) wins over HeadHunter for the same vacancy.
 */
export function sourcePriority(source: string): number {
  const s = (source || '').toLowerCase().trim();
  if (s.startsWith('career_') || s === 'career.habr.com') return 100;
  if (s === 'geekjob.ru' || s === 'getmatch.ru') return 70;
  if (s === 'hh.ru' || s.includes('headhunter')) return 40;
  if (s === 'superjob.ru') return 35;
  if (s.startsWith('tg_')) return 20;
  if (s === 'demo') return 0;
  return 10;
}

function preferEntry(candidate: DedupableMatch, incumbent: DedupableMatch): boolean {
  const pNew = sourcePriority(candidate.job.source);
  const pOld = sourcePriority(incumbent.job.source);
  if (pNew !== pOld) return pNew > pOld;
  if (candidate.score !== incumbent.score) return candidate.score > incumbent.score;
  const tNew = candidate.job.posted_at ?? candidate.job.created_at;
  const tOld = incumbent.job.posted_at ?? incumbent.job.created_at;
  return new Date(tNew).getTime() > new Date(tOld).getTime();
}

/**
 * Collapse entries that share title+company fingerprint.
 * Entries without a reliable fingerprint are kept by job id.
 */
export function dedupeMatchEntries<T extends DedupableMatch>(entries: T[]): T[] {
  const winners = new Map<string, T>();

  for (const entry of entries) {
    const fp = jobFingerprint(entry.job);
    const key = fp ?? `id:${entry.job.id}`;
    const existing = winners.get(key);
    if (!existing || preferEntry(entry, existing)) {
      winners.set(key, entry);
    }
  }

  return Array.from(winners.values());
}

/**
 * Dedup recommended first, then drop weak copies of the same fingerprint.
 */
export function dedupeMatchTiers<T extends DedupableMatch>(
  recommended: T[],
  weak: T[]
): { recommended: T[]; weak: T[] } {
  const dedupedRecommended = dedupeMatchEntries(recommended);
  const recommendedKeys = new Set(
    dedupedRecommended.map((e) => jobFingerprint(e.job) ?? `id:${e.job.id}`)
  );

  const weakFiltered = weak.filter((e) => {
    const key = jobFingerprint(e.job) ?? `id:${e.job.id}`;
    return !recommendedKeys.has(key);
  });

  return {
    recommended: dedupedRecommended,
    weak: dedupeMatchEntries(weakFiltered),
  };
}
