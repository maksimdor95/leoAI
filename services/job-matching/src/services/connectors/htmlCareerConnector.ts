/**
 * HTML career site listings (Avito / VK / T-Bank).
 * Spec: docs/JOB_SOURCES_EXPANSION.md (wave B)
 * T-Bank: Kabi parity — multi list_urls + path_regex matches in raw SSR/JSON.
 */

import axios from 'axios';
import catalog from '../data/career_sites.json';
import { logger } from '../../utils/logger';
import { keywordMatches, mapToJobInput, stripHtml } from './mapJob';
import type {
  ConnectorFetchParams,
  ConnectorFetchResult,
  ExtendedSourceId,
  JobConnector,
} from './types';

export interface CareerSite {
  id: string;
  name: string;
  kind: string;
  enabled?: boolean;
  list_url?: string;
  list_urls?: string[];
  path_regex?: string;
  path_exclude?: string[];
  link_contains?: string[];
}

const HREF_RE = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

function titleFromPath(path: string, anchor: string): string {
  const fromAnchor = stripHtml(anchor || '');
  if (fromAnchor.length >= 4 && !/откликн/i.test(fromAnchor)) {
    return fromAnchor.slice(0, 200);
  }
  const parts = path
    .replace(/\/$/, '')
    .split('/')
    .filter((p) => p && !/^\d+$/.test(p) && !/^[0-9a-f-]{8,}$/i.test(p));
  const slug = parts[parts.length - 1] || path;
  return stripHtml(slug.replace(/-/g, ' ')).slice(0, 200);
}

function resolveListUrls(site: CareerSite): string[] {
  const urls = [
    ...(site.list_urls || []),
    ...(site.list_url ? [site.list_url] : []),
  ]
    .map((u) => String(u || '').trim())
    .filter(Boolean);
  return [...new Set(urls)];
}

/** Exported for unit tests (Kabi parity). */
export function parseHtmlList(
  html: string,
  site: CareerSite,
  keywords: string[],
  maxJobs: number,
  listUrlOverride?: string
) {
  const jobs = [];
  const seen = new Set<string>();
  const listUrl = listUrlOverride || site.list_url || '';
  const pathRe = site.path_regex ? new RegExp(site.path_regex, 'i') : null;
  const excludes = (site.path_exclude || []).map((e) => e.toLowerCase());
  const linkContains = site.link_contains || ['vacancy'];

  // (href, anchor) — <a href> + raw path matches in SSR/JSON (T-Bank)
  const candidates: Array<{ href: string; anchor: string }> = [];
  HREF_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HREF_RE.exec(html)) !== null) {
    candidates.push({ href: m[1].trim(), anchor: m[2] || '' });
  }
  if (pathRe) {
    const globalRe = new RegExp(site.path_regex!, 'gi');
    let pm: RegExpExecArray | null;
    while ((pm = globalRe.exec(html)) !== null) {
      candidates.push({ href: pm[0], anchor: '' });
    }
  }

  for (const { href, anchor } of candidates) {
    if (jobs.length >= maxJobs) break;
    if (!href || href.startsWith('#') || href.toLowerCase().startsWith('javascript:')) {
      continue;
    }

    let full: string;
    try {
      full = new URL(href, listUrl).toString();
    } catch {
      continue;
    }
    full = full.split('?')[0].replace(/\/?$/, '/') ;

    let path = '';
    try {
      path = new URL(full).pathname || '';
    } catch {
      continue;
    }

    const low = full.toLowerCase();
    if (excludes.some((ex) => low.includes(ex) || path.toLowerCase().includes(ex))) {
      continue;
    }
    if (pathRe) {
      if (!pathRe.test(path)) continue;
    } else if (!linkContains.some((frag) => low.includes(frag.toLowerCase()))) {
      continue;
    }

    const title = titleFromPath(path, anchor);
    if (title.length < 4) continue;
    if (!keywordMatches(`${title} ${full}`, keywords)) continue;
    if (seen.has(full)) continue;
    seen.add(full);

    jobs.push(
      mapToJobInput({
        title: title.slice(0, 200),
        company: site.name,
        source: `career_${site.id}`,
        source_url: full,
        description: title,
      })
    );
  }
  return jobs;
}

function createHtmlCareerConnector(
  siteId: ExtendedSourceId,
  sourcesUsedLabel: string
): JobConnector {
  return {
    id: siteId,
    jobSource: `career_${siteId}`,
    async fetch(params: ConnectorFetchParams): Promise<ConnectorFetchResult> {
      const site = (catalog.sites as CareerSite[]).find((s) => s.id === siteId);
      if (!site || site.kind !== 'html_list') {
        return { sourceId: siteId, sourcesUsedLabel, jobs: [] };
      }
      const listUrls = resolveListUrls(site);
      if (listUrls.length === 0) {
        return { sourceId: siteId, sourcesUsedLabel, jobs: [] };
      }
      if (site.enabled === false) {
        logger.info(`career html ${siteId} disabled in catalog`);
        return { sourceId: siteId, sourcesUsedLabel, jobs: [] };
      }

      const jobs = [];
      const seen = new Set<string>();
      try {
        for (const listUrl of listUrls) {
          if (jobs.length >= params.maxJobs) break;
          const resp = await axios.get<string>(listUrl, {
            timeout: 30000,
            headers: {
              'User-Agent': params.userAgent,
              'Accept-Language': 'ru,en;q=0.8',
              Accept: 'text/html,application/xhtml+xml',
            },
            responseType: 'text',
            validateStatus: (s) => s < 500,
            maxRedirects: 5,
          });
          if (resp.status !== 200) {
            logger.warn(`career ${siteId} ${listUrl} → HTTP ${resp.status}`);
            continue;
          }
          const found = parseHtmlList(
            resp.data,
            site,
            params.keywords,
            params.maxJobs - jobs.length,
            listUrl
          );
          for (const job of found) {
            if (seen.has(job.source_url)) continue;
            seen.add(job.source_url);
            jobs.push(job);
            if (jobs.length >= params.maxJobs) break;
          }
        }
        return { sourceId: siteId, sourcesUsedLabel, jobs };
      } catch (error: unknown) {
        logger.warn(
          `career ${siteId} failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    },
  };
}

export const avitoConnector = createHtmlCareerConnector('avito', 'career-avito-html');
export const vkConnector = createHtmlCareerConnector('vk', 'career-vk-html');
export const tbankConnector = createHtmlCareerConnector('tbank', 'career-tbank-html');
