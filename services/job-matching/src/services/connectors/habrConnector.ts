/**
 * Habr Career — RSS primary, HTML listing fallback.
 * Spec: docs/JOB_SOURCES_EXPANSION.md (wave B)
 */

import axios from 'axios';
import { logger } from '../../utils/logger';
import { guessWorkMode, keywordMatches, mapToJobInput, stripHtml } from './mapJob';
import type { ConnectorFetchParams, ConnectorFetchResult, JobConnector } from './types';

const BASE = 'https://career.habr.com';
const RSS_URL = `${BASE}/vacancies/rss`;
const HTML_URL = `${BASE}/vacancies`;

const TITLE_WRAP_RE = /Требуется\s+[«"](.+?)[»"](?:\s*\((.*?)\))?/i;
const SALARY_NUM_RE = /(?:от\s+)?([\d\s\u00a0]+)\s*(?:до\s+([\d\s\u00a0]+))?\s*₽/i;
const ITEM_RE = /<item>([\s\S]*?)<\/item>/gi;

function tagText(block: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(
    block
  );
  return stripHtml((m?.[1] ?? m?.[2] ?? '').trim());
}

function parseHabrTitle(raw: string): { title: string; location: string | null } {
  const cleaned = stripHtml(raw);
  const m = TITLE_WRAP_RE.exec(cleaned);
  if (!m) return { title: cleaned, location: null };
  const title = stripHtml(m[1] || cleaned);
  let location = stripHtml(m[2] || '') || null;
  if (location && /\d/.test(location) && location.includes('₽')) {
    location = null;
  }
  return { title: title || cleaned, location };
}

function parseSalary(blob: string): { min: number | null; max: number | null } {
  const m = SALARY_NUM_RE.exec(blob.replace(/\u00a0/g, ' '));
  if (!m) return { min: null, max: null };
  const toNum = (s: string | undefined) => {
    if (!s) return null;
    const digits = s.replace(/\D/g, '');
    return digits ? parseInt(digits, 10) : null;
  };
  return { min: toNum(m[1]), max: toNum(m[2]) };
}

function parseRss(xml: string, keywords: string[], maxJobs: number) {
  const jobs = [];
  const seen = new Set<string>();
  ITEM_RE.lastIndex = 0;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = ITEM_RE.exec(xml)) !== null && jobs.length < maxJobs) {
    const block = itemMatch[1] || '';
    const titleRaw = tagText(block, 'title');
    const link = tagText(block, 'link');
    const guid = tagText(block, 'guid');
    const author = tagText(block, 'author');
    const desc = tagText(block, 'description');
    if (!titleRaw || !link) continue;

    const { title, location } = parseHabrTitle(titleRaw);
    if (!keywordMatches(`${title} ${author} ${desc}`, keywords)) continue;

    const ext = guid || link.replace(/\/$/, '').split('/').pop() || link;
    if (seen.has(ext)) continue;
    seen.add(ext);

    const salary = parseSalary(`${titleRaw} ${desc}`);
    jobs.push(
      mapToJobInput({
        title: title.slice(0, 200),
        company: author || 'Habr Career',
        source: 'career.habr.com',
        source_url: link,
        description: desc.slice(0, 2000) || title,
        location,
        salary_min: salary.min,
        salary_max: salary.max,
        currency: salary.min || salary.max ? 'RUR' : null,
        work_mode: guessWorkMode(desc),
      })
    );
  }
  return jobs;
}

const CARD_RE =
  /<div class="vacancy-card">[\s\S]*?<a aria-label="([^"]+)" class="vacancy-card__backdrop-link" href="(\/vacancies\/\d+)"><\/a>([\s\S]*?)(?=<div class="vacancy-card">|$)/gi;
const COMPANY_RE = /<a[^>]+href="\/companies\/[^"]+"[^>]*>([^<]+)<\/a>/i;

function parseHtml(html: string, keywords: string[], maxJobs: number) {
  const jobs = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  CARD_RE.lastIndex = 0;
  while ((m = CARD_RE.exec(html)) !== null && jobs.length < maxJobs) {
    const title = stripHtml(m[1] || '');
    const href = m[2] || '';
    const body = m[3] || '';
    if (!title || !href) continue;
    const companyM = COMPANY_RE.exec(body);
    const company = companyM ? stripHtml(companyM[1]) : 'Habr Career';
    if (!keywordMatches(`${title} ${company} ${stripHtml(body).slice(0, 400)}`, keywords)) {
      continue;
    }
    const ext = href.replace(/\/$/, '').split('/').pop() || href;
    if (seen.has(ext)) continue;
    seen.add(ext);
    jobs.push(
      mapToJobInput({
        title: title.slice(0, 200),
        company,
        source: 'career.habr.com',
        source_url: `${BASE}${href}`,
        description: title,
        work_mode: guessWorkMode(body),
      })
    );
  }
  return jobs;
}

export const habrConnector: JobConnector = {
  id: 'habr',
  jobSource: 'career.habr.com',

  async fetch(params: ConnectorFetchParams): Promise<ConnectorFetchResult> {
    const headers = {
      'User-Agent': params.userAgent,
      Accept: 'application/rss+xml, application/xml, text/html, */*',
      'Accept-Language': 'ru,en;q=0.8',
    };

    const queries = params.keywords.length > 0 ? params.keywords.slice(0, 3) : [''];
    const all = [];
    const seenUrl = new Set<string>();

    for (const q of queries) {
      if (all.length >= params.maxJobs) break;
      const url = q ? `${RSS_URL}?q=${encodeURIComponent(q)}` : RSS_URL;
      try {
        const resp = await axios.get<string>(url, {
          timeout: 20000,
          headers,
          responseType: 'text',
          validateStatus: (s) => s < 500,
        });
        if (resp.status === 200 && typeof resp.data === 'string') {
          for (const job of parseRss(resp.data, params.keywords, params.maxJobs)) {
            if (seenUrl.has(job.source_url)) continue;
            seenUrl.add(job.source_url);
            all.push(job);
            if (all.length >= params.maxJobs) break;
          }
        }
      } catch (error: unknown) {
        logger.warn(
          `habr rss fetch failed (${q || 'all'}): ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    if (all.length === 0) {
      try {
        const resp = await axios.get<string>(HTML_URL, {
          timeout: 25000,
          headers,
          responseType: 'text',
          validateStatus: (s) => s < 500,
        });
        if (resp.status === 200 && typeof resp.data === 'string') {
          all.push(...parseHtml(resp.data, params.keywords, params.maxJobs));
        }
      } catch (error: unknown) {
        logger.warn(
          `habr html fallback failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    return {
      sourceId: 'habr',
      sourcesUsedLabel: 'career-habr',
      jobs: all.slice(0, params.maxJobs),
    };
  },
};
