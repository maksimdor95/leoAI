/**
 * Geekjob.ru connector (Kabi M7e parity).
 * Listing HTML + optional keyword soft-filter (multi-role, not product-only).
 */

import axios from 'axios';
import type { JobInput } from '../../models/job';
import { logger } from '../../utils/logger';
import { guessWorkMode, keywordMatches, mapToJobInput, stripHtml } from './mapJob';
import type { ConnectorFetchParams, ConnectorFetchResult, JobConnector } from './types';

const BASE = 'https://geekjob.ru';
const LIST = `${BASE}/vacancies`;
const ITEM_RE = /<li[^>]*class="[^"]*collection-item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
const HREF_VAC_RE = /href="(\/vacancy\/([a-f0-9]{16,32}))"/i;
const TITLE_RE = /class="title"[^>]*>([\s\S]*?)<\/a>/i;
const COMPANY_RE = /company-name"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i;
const MAX_PAGES = 5;

function clean(html: string): string {
  return stripHtml(html).replace(/\s+/g, ' ').trim();
}

function parseListing(html: string, keywords: string[], limit: number): JobInput[] {
  const jobs: JobInput[] = [];
  const seen = new Set<string>();
  const blocks = html.match(ITEM_RE) || [];

  for (const block of blocks) {
    if (jobs.length >= limit) break;
    const hm = block.match(HREF_VAC_RE);
    const tm = block.match(TITLE_RE);
    if (!hm || !tm) continue;
    const vacId = hm[2].toLowerCase();
    if (seen.has(vacId)) continue;
    const title = clean(tm[1]);
    if (title.length < 4) continue;
    const cm = block.match(COMPANY_RE);
    const company = cm ? clean(cm[1]) : 'Geekjob';
    const remote = /remote-label|>\s*remote\s*</i.test(block);
    const blob = `${title} ${company}`;
    if (!keywordMatches(blob, keywords)) continue;
    seen.add(vacId);
    jobs.push(
      mapToJobInput({
        title,
        company,
        source: 'geekjob.ru',
        source_url: `${BASE}${hm[1]}`,
        description: title,
        work_mode: remote ? 'remote' : guessWorkMode(block),
      })
    );
  }
  return jobs;
}

export const geekjobConnector: JobConnector = {
  id: 'geekjob',
  jobSource: 'geekjob.ru',
  async fetch(params: ConnectorFetchParams): Promise<ConnectorFetchResult> {
    const jobs: JobInput[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= MAX_PAGES && jobs.length < params.maxJobs; page += 1) {
      try {
        const url = page === 1 ? LIST : `${LIST}?page=${page}`;
        const res = await axios.get<string>(url, {
          timeout: 12000,
          headers: { 'User-Agent': params.userAgent, Accept: 'text/html' },
          responseType: 'text',
          validateStatus: (s) => s >= 200 && s < 400,
        });
        const batch = parseListing(String(res.data || ''), params.keywords, params.maxJobs);
        if (batch.length === 0 && page > 1) break;
        for (const job of batch) {
          if (seen.has(job.source_url)) continue;
          seen.add(job.source_url);
          jobs.push(job);
          if (jobs.length >= params.maxJobs) break;
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn(`Geekjob page ${page} failed: ${msg}`);
        break;
      }
    }

    return {
      sourceId: 'geekjob',
      sourcesUsedLabel: 'geekjob',
      jobs,
    };
  },
};
