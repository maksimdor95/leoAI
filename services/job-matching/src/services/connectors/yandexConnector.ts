/**
 * Yandex Jobs public JSON API.
 * Spec: docs/JOB_SOURCES_EXPANSION.md
 */

import axios from 'axios';
import { logger } from '../../utils/logger';
import { guessWorkMode, keywordMatches, mapToJobInput } from './mapJob';
import type { ConnectorFetchParams, ConnectorFetchResult, JobConnector } from './types';

const LIST_URL = 'https://yandex.ru/jobs/api/publications';
const VACANCY_TMPL = 'https://yandex.ru/jobs/vacancies/{slug}';

interface YandexItem {
  id?: number | string;
  title?: string;
  short_summary?: string;
  publication_slug_url?: string;
  redirect_url?: string;
  vacancy?: {
    cities?: Array<{ name?: string }>;
    work_modes?: unknown[];
  };
}

export const yandexConnector: JobConnector = {
  id: 'yandex',
  jobSource: 'career_yandex',

  async fetch(params: ConnectorFetchParams): Promise<ConnectorFetchResult> {
    const jobs = [];
    const seen = new Set<string>();
    let cursor: string | null = `${LIST_URL}?page_size=40`;
    let fetched = 0;

    while (cursor && jobs.length < params.maxJobs && fetched < 120) {
      const resp = await axios.get(cursor, {
        timeout: 25000,
        headers: {
          'User-Agent': params.userAgent,
          Accept: 'application/json',
          'Accept-Language': 'ru,en;q=0.8',
        },
        validateStatus: (s) => s < 500,
      });
      if (resp.status !== 200) {
        logger.warn(`yandex api → HTTP ${resp.status}`);
        break;
      }

      const payload = resp.data as {
        results?: YandexItem[];
        next?: string | null;
      };
      const results = payload.results || [];
      fetched += results.length;

      for (const item of results) {
        if (jobs.length >= params.maxJobs) break;
        const title = String(item.title || '').trim();
        if (!title) continue;
        const summary = String(item.short_summary || '');
        if (!keywordMatches(`${title} ${summary}`, params.keywords)) continue;

        const slug = item.publication_slug_url || '';
        const url =
          item.redirect_url ||
          (slug ? VACANCY_TMPL.replace('{slug}', String(slug)) : null);
        if (!url || seen.has(url)) continue;
        seen.add(url);

        const cities = (item.vacancy?.cities || [])
          .map((c) => c.name)
          .filter(Boolean) as string[];
        const modes = JSON.stringify(item.vacancy?.work_modes || []);

        jobs.push(
          mapToJobInput({
            title,
            company: 'Яндекс',
            source: 'career_yandex',
            source_url: url,
            description: summary || title,
            location: cities,
            work_mode: guessWorkMode(modes),
          })
        );
      }

      const next = payload.next;
      if (!next || !String(next).includes('yandex.ru') || String(next).includes('femida')) {
        break;
      }
      cursor = String(next).replace(/^http:\/\//, 'https://');
    }

    return {
      sourceId: 'yandex',
      sourcesUsedLabel: 'career-yandex-api',
      jobs,
    };
  },
};
