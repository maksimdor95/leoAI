/**
 * Build scrape keywords for LEO Med (doctor-first, then mid/junior).
 */

import { listOpenMedRoles } from './catalog';
import type { MedRoleLevel } from './types';

const BROAD_KEYWORDS = [
  'врач',
  'медицинская сестра',
  'медицинский брат',
  'фельдшер',
  'санитар',
  'рентгенолаборант',
] as const;

/** Popular specialty seeds so HH/SJ return dense med inventory quickly. */
const PRIORITY_TITLE_SUBSTRINGS = [
  'терапевт',
  'педиатр',
  'хирург',
  'анестезиолог',
  'невролог',
  'кардиолог',
  'стоматолог',
  'акушер',
  'психиатр',
  'офтальмолог',
  'травматолог',
  'эндокринолог',
  'уролог',
  'дерматовенеролог',
  'онколог',
  'рентгенолог',
  'ультразвуковой',
  'общей практики',
  'скорой медицинской',
  'участковая',
  'процедурной',
  'палатная',
];

export function getMedScrapeKeywordLimit(): number {
  const n = parseInt(process.env.MED_SCRAPE_KEYWORD_LIMIT || '24', 10);
  return Number.isFinite(n) ? Math.min(60, Math.max(6, n)) : 24;
}

/**
 * Keywords ordered: broad → doctor specialties → mid → junior.
 */
export function buildMedScrapeKeywords(limit = getMedScrapeKeywordLimit()): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string) => {
    const k = raw.trim();
    if (k.length < 3) return;
    const key = k.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(k);
  };

  for (const k of BROAD_KEYWORDS) push(k);

  const byLevel = (level: MedRoleLevel) => listOpenMedRoles(level);

  for (const role of byLevel('doctor')) {
    if (out.length >= limit) break;
    const title = role.title;
    if (PRIORITY_TITLE_SUBSTRINGS.some((s) => title.toLowerCase().includes(s))) {
      push(title);
    }
  }

  for (const role of byLevel('doctor')) {
    if (out.length >= limit) break;
    push(role.title);
  }

  for (const role of byLevel('mid')) {
    if (out.length >= limit) break;
    if (PRIORITY_TITLE_SUBSTRINGS.some((s) => role.title.toLowerCase().includes(s))) {
      push(role.title);
    }
  }

  for (const role of byLevel('mid')) {
    if (out.length >= limit) break;
    push(role.title);
  }

  for (const role of byLevel('junior')) {
    if (out.length >= limit) break;
    push(role.title);
  }

  return out.slice(0, limit);
}
