/**
 * Env / limits for extended job sources.
 * Spec: docs/JOB_SOURCES_EXPANSION.md
 */

import type { ExtendedSourceId } from './types';

/** Default: all runnable sources (wave A + B). Ozon excluded (antibot). */
const DEFAULT_SOURCES: ExtendedSourceId[] = [
  'yandex',
  'mts',
  'wb',
  'alfa',
  'sber',
  'habr',
  'tg',
  'getmatch',
  'geekjob',
  'avito',
  'vk',
  'tbank',
];

/** Runnable connectors (ozon stays backlog / not in types as enabled). */
const RUNNABLE = new Set<ExtendedSourceId>(DEFAULT_SOURCES);

export function isExtendedJobSourcesEnabled(): boolean {
  return process.env.ENABLE_EXTENDED_JOB_SOURCES === 'true';
}

export function getExtendedSourceIds(): ExtendedSourceId[] {
  const raw = process.env.EXTENDED_JOB_SOURCES?.trim();
  if (!raw || raw.toLowerCase() === 'all') return [...DEFAULT_SOURCES];
  const parsed = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) as ExtendedSourceId[];
  return parsed.length > 0 ? parsed : [...DEFAULT_SOURCES];
}

export function isRunnableSource(id: ExtendedSourceId): boolean {
  return RUNNABLE.has(id);
}

export function getExtendedKeywordLimit(): number {
  const n = parseInt(process.env.EXTENDED_JOB_KEYWORD_LIMIT || '5', 10);
  return Number.isFinite(n) ? Math.min(12, Math.max(1, n)) : 5;
}

export function getExtendedMaxPerSource(): number {
  const n = parseInt(process.env.EXTENDED_JOB_MAX_PER_SOURCE || '40', 10);
  return Number.isFinite(n) ? Math.min(200, Math.max(5, n)) : 40;
}

/** Parallel connector fetch concurrency (Phase 5). */
export function getExtendedConnectorConcurrency(): number {
  const n = parseInt(process.env.EXTENDED_CONNECTOR_CONCURRENCY || '3', 10);
  return Number.isFinite(n) ? Math.min(8, Math.max(1, n)) : 3;
}

export function getScraperUserAgent(): string {
  return (
    process.env.SCRAPER_USER_AGENT ||
    'LeoAI-JobMatching/1.0 (+https://leo-ai.ru; career-sources)'
  );
}

export function isAlfaSslInsecure(): boolean {
  const raw = process.env.ALFA_SSL_INSECURE;
  if (raw === undefined || raw === '') return true;
  return raw === 'true' || raw === '1';
}
