/**
 * LEO Med HTML / open-data boards from med_sources.json.
 * Reuses Jack HTML list parser + mapJob helpers (fail-open per source).
 */

import axios from 'axios';
import { logger } from '../../utils/logger';
import { getScraperUserAgent } from '../connectors/config';
import { parseHtmlList, type CareerSite } from '../connectors/htmlCareerConnector';
import { mapToJobInput } from '../connectors/mapJob';
import type { JobInput } from '../../models/job';
import { listMedSources } from './catalog';
import type { MedSource } from './types';

const PER_SOURCE_LIMIT = 40;
const TOTAL_LIMIT = 200;

function listUrlsForSource(source: MedSource): string[] {
  const urls = [
    ...(source.list_urls || []),
    ...(source.list_url ? [source.list_url] : []),
  ]
    .map((u) => String(u || '').trim())
    .filter(Boolean);
  return [...new Set(urls)];
}

function asCareerSite(source: MedSource, listUrls: string[]): CareerSite {
  return {
    id: source.id,
    name: source.title,
    kind: 'html_list',
    list_urls: listUrls,
    link_contains: source.link_contains?.length
      ? source.link_contains
      : ['vacancy', 'vakans', 'job', 'карточ'],
    path_regex: source.path_regex,
  };
}

async function fetchTrudvsemApi(keywords: string[], limit: number): Promise<JobInput[]> {
  const text = keywords.slice(0, 3).join(' ') || 'врач';
  const url =
    `https://opendata.trudvsem.ru/api/v1/vacancies` +
    `?text=${encodeURIComponent(text)}&limit=${Math.min(100, limit)}`;
  const resp = await axios.get(url, {
    timeout: 20000,
    headers: { 'User-Agent': getScraperUserAgent(), Accept: 'application/json' },
    validateStatus: (s) => s < 500,
  });
  if (resp.status !== 200 || !resp.data) return [];

  const results = Array.isArray(resp.data?.results)
    ? resp.data.results
    : Array.isArray(resp.data?.vacancies)
      ? resp.data.vacancies
      : [];

  const jobs: JobInput[] = [];
  for (const row of results) {
    if (jobs.length >= limit) break;
    const vacancy = row?.vacancy || row;
    const title = String(vacancy?.job_name || vacancy?.vacancyName || vacancy?.title || '').trim();
    const company = String(
      vacancy?.company?.name || vacancy?.company_name || vacancy?.employer || 'Работа России'
    ).trim();
    const sourceUrl = String(
      vacancy?.vacancy_url || vacancy?.url || vacancy?.link || ''
    ).trim();
    if (!title || !sourceUrl) continue;
    jobs.push(
      mapToJobInput({
        title: title.slice(0, 200),
        company: company.slice(0, 200) || 'Работа России',
        source: 'trudvsem.ru',
        source_url: sourceUrl,
        description: String(vacancy?.duty || vacancy?.requirement || title).slice(0, 2500),
        location: vacancy?.region?.name ? String(vacancy.region.name) : 'Россия',
      })
    );
  }
  return jobs;
}

async function fetchHtmlSource(
  source: MedSource,
  keywords: string[],
  limit: number
): Promise<JobInput[]> {
  const listUrls = listUrlsForSource(source);
  if (listUrls.length === 0) {
    logger.info(`Med HTML ${source.id}: no list_urls — skip`);
    return [];
  }

  const site = asCareerSite(source, listUrls);
  const userAgent = getScraperUserAgent();
  const jobs: JobInput[] = [];
  const seen = new Set<string>();

  for (const listUrl of listUrls) {
    if (jobs.length >= limit) break;
    try {
      const resp = await axios.get<string>(listUrl, {
        timeout: 25000,
        headers: {
          'User-Agent': userAgent,
          'Accept-Language': 'ru,en;q=0.8',
          Accept: 'text/html,application/xhtml+xml',
        },
        responseType: 'text',
        validateStatus: (s) => s < 500,
        maxRedirects: 5,
      });
      if (resp.status !== 200) {
        logger.warn(`Med HTML ${source.id} ${listUrl} → HTTP ${resp.status}`);
        continue;
      }
      const found = parseHtmlList(
        resp.data,
        site,
        keywords,
        limit - jobs.length,
        listUrl
      );
      for (const job of found) {
        if (seen.has(job.source_url)) continue;
        seen.add(job.source_url);
        jobs.push({
          ...job,
          source: source.id,
          company: job.company || source.title,
        });
        if (jobs.length >= limit) break;
      }
    } catch (error: unknown) {
      logger.warn(
        `Med HTML ${source.id} failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  return jobs;
}

/** Active HTML boards (+ trudvsem open data). Never mixes Jack IT career sites. */
export async function fetchMedHtmlBoardJobs(
  keywords: string[],
  maxJobs = TOTAL_LIMIT
): Promise<JobInput[]> {
  const boards = listMedSources({ type: 'html', status: 'active' });
  if (boards.length === 0) {
    logger.info('Med HTML boards: none active in registry');
    return [];
  }

  const jobs: JobInput[] = [];
  const seen = new Set<string>();

  for (const source of boards) {
    if (jobs.length >= maxJobs) break;
    const room = Math.min(PER_SOURCE_LIMIT, maxJobs - jobs.length);
    try {
      const found =
        source.id === 'trudvsem.ru'
          ? await fetchTrudvsemApi(keywords, room)
          : await fetchHtmlSource(source, keywords, room);
      for (const job of found) {
        if (seen.has(job.source_url)) continue;
        seen.add(job.source_url);
        jobs.push(job);
        if (jobs.length >= maxJobs) break;
      }
      logger.info(`Med board ${source.id}: kept=${found.length}`);
    } catch (error: unknown) {
      logger.warn(
        `Med board ${source.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return jobs;
}
