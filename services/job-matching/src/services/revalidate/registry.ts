import { hhRevalidator } from './hh';
import { superjobRevalidator } from './superjob';
import { getmatchRevalidator } from './getmatch';
import { habrRevalidator } from './habr';
import { geekjobRevalidator } from './geekjob';
import { CAREER_CARD_REVALIDATORS } from './careerCards';
import type { VacancyRevalidator } from './types';

/**
 * Phase 0–3: HH + SJ + Getmatch + Habr + Geekjob + career JSON cards.
 * Avito / VK / T-Bank / TG → Phase 4.
 */
export const REVALIDATORS: VacancyRevalidator[] = [
  hhRevalidator,
  superjobRevalidator,
  getmatchRevalidator,
  habrRevalidator,
  geekjobRevalidator,
  ...CAREER_CARD_REVALIDATORS,
];

export function getRevalidatorForSource(source: string): VacancyRevalidator | null {
  const normalized = source.trim().toLowerCase();
  return REVALIDATORS.find((r) => r.sources.some((s) => s.toLowerCase() === normalized)) ?? null;
}

export function getRevalidateSourceList(): string[] {
  return REVALIDATORS.flatMap((r) => r.sources);
}

/**
 * Optional allowlist via JOB_REVALIDATE_SOURCES (comma-separated source ids
 * or revalidator ids, e.g. `hh.ru,habr,career_wb`). Empty = all registered.
 */
export function resolveRevalidateSources(override?: string[]): string[] {
  const all = getRevalidateSourceList();
  if (override?.length) {
    const wanted = new Set(override.map((s) => s.trim().toLowerCase()).filter(Boolean));
    return filterSources(all, wanted);
  }
  const raw = process.env.JOB_REVALIDATE_SOURCES?.trim();
  if (!raw) return all;
  const wanted = new Set(
    raw
      .split(/[,;\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  return filterSources(all, wanted);
}

function filterSources(all: string[], wanted: Set<string>): string[] {
  return all.filter((source) => {
    const s = source.toLowerCase();
    if (wanted.has(s)) return true;
    const revalidator = getRevalidatorForSource(source);
    return revalidator ? wanted.has(revalidator.id.toLowerCase()) : false;
  });
}
