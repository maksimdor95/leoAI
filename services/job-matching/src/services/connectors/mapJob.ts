/**
 * Shared helpers: raw connector rows → JobInput.
 */

import type { JobInput } from '../../models/job';
import { classifyRoleFamily } from '../roleFamily';

export function guessWorkMode(
  text: string | null | undefined,
  remoteFlag?: boolean | null
): string | null {
  if (remoteFlag === true) return 'remote';
  if (remoteFlag === false) return null;
  const t = (text || '').toLowerCase();
  if (/удал|remote|удалён|удален/.test(t)) return 'remote';
  if (/гибрид|hybrid/.test(t)) return 'hybrid';
  if (/офис|office|в офисе/.test(t)) return 'office';
  return null;
}

export function guessExperienceLevel(text: string | null | undefined): string | null {
  const t = (text || '').toLowerCase();
  if (/intern|стаж[её]р|без опыта|no experience/.test(t)) return 'junior';
  if (/junior|джун|1–3|1-3|от 1/.test(t)) return 'junior';
  if (/senior|сеньор|lead|руководитель|от 5|5\+|more than 6|более 6/.test(t)) {
    return 'senior';
  }
  if (/middle|мидл|3–6|3-6|от 3/.test(t)) return 'middle';
  return null;
}

/** EN↔RU token aliases for soft keyword match (Phase 5). */
const TOKEN_ALIASES: Record<string, string[]> = {
  // Include common Latin translits of RU stems (T-Bank SSR slugs: produktovoj, analitik…)
  product: ['product', 'продукт', 'продакт', 'produkt', 'prodakt'],
  manager: ['manager', 'менеджер', 'menedzher'],
  owner: ['owner', 'владелец', 'vladelec'],
  backend: ['backend', 'бэкенд', 'бекенд'],
  frontend: ['frontend', 'фронтенд', 'фронт'],
  developer: ['developer', 'разработчик', 'программист', 'razrabotchik'],
  analyst: ['analyst', 'аналитик', 'analitik'],
  designer: ['designer', 'дизайнер', 'dizajner'],
  engineer: ['engineer', 'инженер', 'inzhener'],
  data: ['data', 'данных', 'дата'],
  lead: ['lead', 'лид', 'тимлид', 'timlid', 'руководитель'],
};

function expandKeywordToken(token: string): string[] {
  const base = token.toLowerCase();
  const aliases = TOKEN_ALIASES[base];
  return aliases && aliases.length > 0 ? aliases : [base];
}

export function keywordMatches(blob: string, keywords: string[]): boolean {
  if (!keywords.length) return true;
  const low = blob.toLowerCase();
  return keywords.some((kw) => {
    if (!kw) return false;
    const needle = kw.toLowerCase().trim();
    if (!needle) return false;
    if (low.includes(needle)) return true;
    // Soft match: phrase tokens (≥4) + RU/EN aliases.
    const tokens = needle.split(/[\s/|,+_-]+/).filter((t) => t.length >= 4);
    return tokens.some((t) => expandKeywordToken(t).some((alias) => low.includes(alias)));
  });
}

export function toLocationArray(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  const trimmed = value.trim();
  return trimmed ? [trimmed] : [];
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface MapJobParams {
  title: string;
  company: string;
  source: string;
  source_url: string;
  description?: string;
  requirements?: string;
  location?: string | string[] | null;
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string | null;
  work_mode?: string | null;
  experience_level?: string | null;
  posted_at?: Date | null;
  skills?: string[];
}

export function mapToJobInput(params: MapJobParams): JobInput {
  const title = params.title.trim();
  return {
    title,
    company: params.company.trim() || 'Unknown',
    location: toLocationArray(params.location),
    salary_min: params.salary_min ?? null,
    salary_max: params.salary_max ?? null,
    currency: params.currency ?? null,
    description: params.description?.trim() || title,
    requirements: params.requirements?.trim() || '',
    skills: params.skills ?? [],
    experience_level: params.experience_level ?? guessExperienceLevel(title),
    work_mode: params.work_mode ?? null,
    source_meta: null,
    source: params.source,
    source_url: params.source_url,
    role_family: classifyRoleFamily(title),
    posted_at: params.posted_at ?? null,
  };
}
