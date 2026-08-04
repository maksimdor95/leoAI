/**
 * Getmatch via public TG channel t.me/s/g_jobchannel.
 * Spec: docs/JOB_SOURCES_EXPANSION.md (wave B)
 */

import axios from 'axios';
import { logger } from '../../utils/logger';
import { guessWorkMode, keywordMatches, mapToJobInput, stripHtml } from './mapJob';
import { getTgAxiosProxyConfig } from './tgHttpProxy';
import type { ConnectorFetchParams, ConnectorFetchResult, JobConnector } from './types';

const TG_URL = 'https://t.me/s/g_jobchannel';
const VAC_RE = /https?:\/\/(?:www\.)?getmatch\.ru\/vacancies\/(\d+)/gi;
const MSG_SPLIT = 'tgme_widget_message_wrap';
const TEXT_RE = /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
const TITLE_TAG_RE = /<title[^>]*>([^<]+)<\/title>/i;

function titleFromMessage(text: string): string {
  let cut = text.trim().replace(/^[🔶🔸▪️•\-\s]+/, '');
  cut = cut.split(/\s+Локация\s*:/i)[0] || cut;
  cut = cut.split(/\s+Отклик/i)[0] || cut;
  cut = cut.trim().replace(/^[·—\-|]+/, '').trim();
  if (cut.length >= 8) return cut.slice(0, 200);
  return text.slice(0, 120) || 'Вакансия Getmatch';
}

function locationRemote(text: string): { location: string | null; remote: boolean } {
  const remote = /#?Удаленк|#?Remote|удалённ|удаленн/i.test(text);
  const locs = [...text.matchAll(/#([A-Za-zА-Яа-яёЁ_]+)/g)].map((m) => m[1]);
  const nice = locs
    .filter((loc) => !['удаленка', 'remote', 'hybrid', 'гибрид'].includes(loc.toLowerCase()))
    .map((loc) => loc.replace(/_/g, ' '))
    .slice(0, 4);
  return { location: nice.join(', ') || null, remote };
}

function parseGetmatchChannel(html: string, keywords: string[], limit: number) {
  const jobs = [];
  const seen = new Set<string>();
  for (const block of html.split(MSG_SPLIT).slice(1)) {
    if (jobs.length >= limit) break;
    const textM = TEXT_RE.exec(block);
    const text = textM
      ? stripHtml(textM[1].replace(/<br\s*\/?>/gi, '\n'))
      : stripHtml(block);
    if (!keywordMatches(text, keywords)) continue;

    VAC_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = VAC_RE.exec(block)) !== null) {
      const vacId = m[1];
      if (seen.has(vacId)) continue;
      seen.add(vacId);
      const { location, remote } = locationRemote(text);
      jobs.push(
        mapToJobInput({
          title: titleFromMessage(text),
          company: 'Getmatch',
          source: 'getmatch.ru',
          source_url: `https://getmatch.ru/vacancies/${vacId}`,
          description: text.slice(0, 2000),
          location,
          work_mode: remote ? 'remote' : guessWorkMode(text),
        })
      );
      if (jobs.length >= limit) break;
    }
  }
  return jobs;
}

async function enrichTitle(
  html: string,
  currentTitle: string
): Promise<{ title: string; company: string | null }> {
  const m = TITLE_TAG_RE.exec(html);
  if (!m) return { title: currentTitle, company: null };
  let raw = stripHtml(m[1]);
  raw = raw.replace(/^Вакансия\s+/i, '');
  raw = raw.split(/\s+—\s+getmatch/i)[0] || raw;
  const parts = raw.split(/,\s*работа в\s+/i);
  const title = (parts[0] || raw).trim().slice(0, 200);
  let company: string | null = null;
  if (parts[1]) {
    company = parts[1].split(',')[0]?.trim().slice(0, 120) || null;
  }
  if (
    title &&
    (!currentTitle || currentTitle.startsWith('🔶') || currentTitle.length > 120)
  ) {
    return { title, company };
  }
  return { title: currentTitle, company };
}

export const getmatchConnector: JobConnector = {
  id: 'getmatch',
  jobSource: 'getmatch.ru',

  async fetch(params: ConnectorFetchParams): Promise<ConnectorFetchResult> {
    const headers = {
      'User-Agent': params.userAgent,
      'Accept-Language': 'ru,en;q=0.8',
    };

    let html = '';
    try {
      const resp = await axios.get<string>(TG_URL, {
        timeout: 20000,
        headers,
        responseType: 'text',
        validateStatus: (s) => s < 500,
        ...getTgAxiosProxyConfig(),
      });
      if (resp.status !== 200) {
        logger.warn(`getmatch tg → HTTP ${resp.status}`);
        return { sourceId: 'getmatch', sourcesUsedLabel: 'getmatch', jobs: [] };
      }
      html = resp.data;
    } catch (error: unknown) {
      logger.warn(
        `getmatch tg fetch failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return { sourceId: 'getmatch', sourcesUsedLabel: 'getmatch', jobs: [] };
    }

    const jobs = parseGetmatchChannel(html, params.keywords, params.maxJobs);

    // Best-effort enrich first few pages
    for (const job of jobs.slice(0, 8)) {
      try {
        const page = await axios.get<string>(job.source_url, {
          timeout: 10000,
          headers,
          responseType: 'text',
          validateStatus: (s) => s < 500,
          ...getTgAxiosProxyConfig(),
        });
        if (page.status === 200) {
          const enriched = await enrichTitle(page.data, job.title);
          job.title = enriched.title;
          if (enriched.company) job.company = enriched.company;
        }
      } catch {
        // ignore enrich errors
      }
    }

    return {
      sourceId: 'getmatch',
      sourcesUsedLabel: 'getmatch',
      jobs,
    };
  },
};
