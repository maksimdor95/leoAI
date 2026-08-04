/**
 * Sber careers public API (publications gateway).
 * Spec: docs/JOB_SOURCES_EXPANSION.md
 *
 * Server-side text search not confirmed — client-side keyword filter.
 */

import axios from 'axios';
import { logger } from '../../utils/logger';
import { keywordMatches, mapToJobInput, stripHtml } from './mapJob';
import type { ConnectorFetchParams, ConnectorFetchResult, JobConnector } from './types';

const LIST_URL =
  'https://rabota.sber.ru/public/app-candidate-public-api-gateway/api/v1/publications';

interface SberVacancy {
  internalId?: number | string;
  requisitionId?: string;
  title?: string;
  company?: string;
  city?: string;
  region?: string;
  introduction?: string;
  duties?: string;
  requirements?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  publicationDate?: string;
  specialization?: string;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function detailUrl(item: SberVacancy): string {
  const id = item.internalId;
  if (id == null) return 'https://rabota.sber.ru/search/';
  const slug = slugify(String(item.title || 'vacancy'));
  return `https://rabota.sber.ru/search/${slug}-${id}/`;
}

export const sberConnector: JobConnector = {
  id: 'sber',
  jobSource: 'career_sber',

  async fetch(params: ConnectorFetchParams): Promise<ConnectorFetchResult> {
    const jobs = [];
    const seen = new Set<string>();
    const take = 50;
    let skip = 0;
    let total = Infinity;
    let pages = 0;

    while (skip < total && jobs.length < params.maxJobs && pages < 10) {
      const resp = await axios.get(LIST_URL, {
        timeout: 30000,
        params: { skip, take },
        headers: {
          'User-Agent': params.userAgent,
          Accept: 'application/json',
          Referer: 'https://rabota.sber.ru/search/',
        },
        validateStatus: (s) => s < 500,
      });

      if (resp.status !== 200) {
        logger.warn(`sber api → HTTP ${resp.status}`);
        break;
      }

      const payload = resp.data as {
        data?: { vacancies?: SberVacancy[]; total?: number };
      };
      const rows = payload.data?.vacancies || [];
      total = typeof payload.data?.total === 'number' ? payload.data.total : rows.length;
      pages += 1;

      if (rows.length === 0) break;

      for (const item of rows) {
        if (jobs.length >= params.maxJobs) break;
        const title = String(item.title || '').trim();
        if (!title || item.internalId == null) continue;

        const blob = [
          title,
          item.specialization,
          item.introduction,
          item.duties,
          item.requirements,
        ]
          .filter(Boolean)
          .join(' ');
        if (!keywordMatches(blob, params.keywords)) continue;

        const url = detailUrl(item);
        if (seen.has(url)) continue;
        seen.add(url);

        const desc =
          stripHtml(item.introduction || '') ||
          stripHtml(item.duties || '') ||
          title;
        const reqs = stripHtml(item.requirements || '');
        const loc = item.city || item.region || null;

        jobs.push(
          mapToJobInput({
            title,
            company: item.company || 'Сбер',
            source: 'career_sber',
            source_url: url,
            description: desc.slice(0, 5000),
            requirements: reqs.slice(0, 3000),
            location: loc,
            salary_min: item.salary_min ?? null,
            salary_max: item.salary_max ?? null,
            currency: 'RUR',
            posted_at: item.publicationDate ? new Date(item.publicationDate) : null,
          })
        );
      }

      skip += take;
    }

    return {
      sourceId: 'sber',
      sourcesUsedLabel: 'career-sber-api',
      jobs,
    };
  },
};
