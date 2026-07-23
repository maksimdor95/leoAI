/**
 * Слой 1: предпочтения профиля → скоринг вакансий.
 * domains / company_types / red_flags из __enriched + industries из позиций.
 */

import type { Job } from '../models/job';
import type { CollectedData } from './userService';
import { getEnrichedFromCollected } from '../types/enrichedProfile';
import {
  findMatchingCompanyExclusion,
  parseCompanyExclusions,
  type CompanyExclusionRule,
} from './companyExclusions';

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

/** Синонимы доменов / типов компаний → needles в тексте вакансии. */
const DOMAIN_CATALOG: Array<{ keys: string[]; label: string; needles: string[] }> = [
  {
    keys: ['product', 'продукт', 'product management', 'cpo', 'product lead'],
    label: 'product',
    needles: ['product', 'продукт', 'cpo', 'product owner', 'product manager', 'продакт'],
  },
  {
    keys: ['saas', 'b2b saas', 'software', 'it', 'tech', 'технологи', 'цифров'],
    label: 'IT / SaaS',
    needles: ['saas', 'b2b', 'software', 'it ', ' tech', 'стартап', 'startup', 'платформ', 'digital'],
  },
  {
    keys: ['ecommerce', 'e-com', 'ecom', 'ритейл', 'retail', 'marketplace'],
    label: 'e-commerce / retail',
    needles: ['e-com', 'ecommerce', 'ecom', 'ритейл', 'retail', 'marketplace', 'маркетплейс', 'магазин'],
  },
  {
    keys: ['fintech', 'финтех', 'финанс', 'banking', 'банк'],
    label: 'fintech / finance',
    needles: ['финтех', 'fintech', 'банк', 'bank', 'финанс', 'payment', 'платеж'],
  },
  {
    keys: ['telecom', 'телеком', 'медиа', 'media', 'advertising', 'маркетинг'],
    label: 'telecom / media',
    needles: ['телеком', 'telecom', 'медиа', 'media', 'реклам', 'advertis', 'маркетинг'],
  },
  {
    keys: ['edtech', 'образование', 'hrtech', 'healthcare', 'health', 'medtech'],
    label: 'edtech / health',
    needles: ['edtech', 'образован', 'healthcare', 'health', 'medtech', 'медицин', 'hr tech', 'hrtech'],
  },
  {
    keys: ['game', 'gaming', 'игр'],
    label: 'gaming',
    needles: ['game', 'gaming', 'игр', 'mobile game'],
  },
];

function jobHaystack(job: Job): string {
  return normalizeText(
    [job.company, job.title, job.description?.slice(0, 1200) || '', ...(job.skills || [])].join(' ')
  );
}

/** Домены из enrichment + industries позиций + company_types. */
export function collectPreferredDomains(data: CollectedData | null | undefined): string[] {
  if (!data) return [];
  const out: string[] = [];
  const enriched = getEnrichedFromCollected(data as Record<string, unknown>);
  const prefs = enriched?.job_preferences;
  if (prefs?.domains?.length) {
    for (const d of prefs.domains) {
      if (typeof d === 'string' && d.trim()) out.push(d.trim());
    }
  }
  if (prefs?.company_types?.length) {
    for (const d of prefs.company_types) {
      if (typeof d === 'string' && d.trim()) out.push(d.trim());
    }
  }
  for (let i = 1; i <= 5; i += 1) {
    const ind = data[`position_${i}_industry` as keyof CollectedData];
    if (typeof ind === 'string' && ind.trim()) out.push(ind.trim());
  }
  if (typeof data.desired_culture === 'string' && data.desired_culture.trim()) {
    out.push(data.desired_culture.trim());
  }
  return out;
}

function resolveDomainEntries(preferred: string[]): Array<{ label: string; needles: string[] }> {
  const resolved: Array<{ label: string; needles: string[] }> = [];
  const seen = new Set<string>();
  for (const raw of preferred) {
    const n = normalizeText(raw);
    for (const entry of DOMAIN_CATALOG) {
      if (entry.keys.some((k) => n.includes(normalizeText(k)) || normalizeText(k).includes(n))) {
        if (!seen.has(entry.label)) {
          seen.add(entry.label);
          resolved.push({ label: entry.label, needles: entry.needles });
        }
      }
    }
  }
  return resolved;
}

/**
 * Soft affinity: совпадение доменов опыта/предпочтений с вакансией.
 * Возвращает −8…+12 баллов.
 */
export function scoreDomainAffinity(
  job: Job,
  data: CollectedData | null | undefined
): { points: number; reason?: string } {
  const preferred = collectPreferredDomains(data);
  if (preferred.length === 0) return { points: 0 };

  const entries = resolveDomainEntries(preferred);
  if (entries.length === 0) return { points: 0 };

  const hay = jobHaystack(job);
  const matched: string[] = [];
  for (const entry of entries) {
    if (entry.needles.some((needle) => hay.includes(normalizeText(needle)))) {
      matched.push(entry.label);
    }
  }

  if (matched.length === 0) {
    // Есть явные предпочтения, но вакансия из другого домена — мягкий штраф
    return {
      points: -4,
      reason: 'Домен вакансии слабо совпадает с вашим опытом/предпочтениями',
    };
  }

  const points = Math.min(12, 4 + matched.length * 4);
  return {
    points,
    reason: `Домен совпадает: ${matched.slice(0, 3).join(', ')}`,
  };
}

/**
 * Exclusions: текст профиля + red_flags из __enriched.
 * Подмешиваем red_flags в collectedData-подобный объект для parseCompanyExclusions.
 */
export function findProfileCompanyExclusion(
  job: Job,
  data: CollectedData | null | undefined
): CompanyExclusionRule | null {
  if (!data) return null;

  const enriched = getEnrichedFromCollected(data as Record<string, unknown>);
  const redFlags = enriched?.job_preferences?.red_flags ?? [];
  const redFlagText = redFlags
    .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
    .join('. ');

  const merged: CollectedData = {
    ...data,
    additional_info: [String(data.additional_info || ''), redFlagText]
      .filter((s) => s.trim())
      .join('. '),
  };

  // Прямое совпадение red_flag строк как needles (напр. «Сбер», «банки»)
  const direct = findMatchingCompanyExclusion(job, merged);
  if (direct) return direct;

  if (redFlags.length > 0) {
    const hay = jobHaystack(job);
    for (const flag of redFlags) {
      if (typeof flag !== 'string' || flag.trim().length < 3) continue;
      const f = normalizeText(flag);
      // «не банки» / «банки» / название компании
      const catalogHit = parseCompanyExclusions({
        additional_info: `не рассматриваю ${flag}`,
      });
      for (const rule of catalogHit) {
        if (rule.needles.some((n) => hay.includes(normalizeText(n)))) {
          return rule;
        }
      }
      if (hay.includes(f)) {
        return { label: flag.trim(), needles: [f] };
      }
    }
  }

  return null;
}

export { findMatchingCompanyExclusion, parseCompanyExclusions };
