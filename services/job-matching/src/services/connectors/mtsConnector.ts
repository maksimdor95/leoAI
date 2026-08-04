/**
 * MTS Jobs public JSON API (job.mts.ru/api/v2).
 * Spec: docs/JOB_SOURCES_EXPANSION.md
 */

import axios from 'axios';
import { logger } from '../../utils/logger';
import { guessExperienceLevel, guessWorkMode, keywordMatches, mapToJobInput } from './mapJob';
import type { ConnectorFetchParams, ConnectorFetchResult, JobConnector } from './types';

const LIST_URL = 'https://job.mts.ru/api/v2/vacancies';

interface MtsVacancy {
  title?: string;
  slug?: string;
  documentId?: string;
  salaryFrom?: number | null;
  salaryTo?: number | null;
  publishedAt?: string;
  experience?: { title?: string };
  region?: { title?: string };
  organization?: { title?: string };
  workFormats?: Array<{ title?: string }>;
  currency?: { title?: string };
  categories?: Array<{ title?: string }>;
}

function publicUrl(slug: string): string {
  return `https://job.mts.ru/vacancy/${encodeURIComponent(slug)}`;
}

export const mtsConnector: JobConnector = {
  id: 'mts',
  jobSource: 'career_mts',

  async fetch(params: ConnectorFetchParams): Promise<ConnectorFetchResult> {
    const jobs = [];
    const seen = new Set<string>();
    const pageSize = 50;
    let page = 1;
    let pageCount = 1;

    while (page <= pageCount && jobs.length < params.maxJobs && page <= 8) {
      const resp = await axios.get(LIST_URL, {
        timeout: 25000,
        params: {
          'pagination[page]': page,
          'pagination[pageSize]': pageSize,
        },
        headers: {
          'User-Agent': params.userAgent,
          Accept: 'application/json',
          Origin: 'https://job.mts.ru',
          Referer: 'https://job.mts.ru/vacancies',
        },
        validateStatus: (s) => s < 500,
      });

      if (resp.status !== 200) {
        logger.warn(`mts api → HTTP ${resp.status}`);
        break;
      }

      const payload = resp.data as {
        data?: MtsVacancy[];
        meta?: { pagination?: { pageCount?: number; total?: number } };
      };
      const rows = payload.data || [];
      pageCount = payload.meta?.pagination?.pageCount || page;

      for (const item of rows) {
        if (jobs.length >= params.maxJobs) break;
        const title = String(item.title || '').trim();
        const slug = String(item.slug || '').trim();
        if (!title || !slug) continue;

        const org = item.organization?.title || 'МТС';
        const cats = (item.categories || []).map((c) => c.title || '').join(' ');
        const blob = `${title} ${org} ${cats}`;
        if (!keywordMatches(blob, params.keywords)) continue;

        const url = publicUrl(slug);
        if (seen.has(url)) continue;
        seen.add(url);

        const formats = (item.workFormats || []).map((f) => f.title || '').join(' ');
        const exp = item.experience?.title || '';

        jobs.push(
          mapToJobInput({
            title,
            company: org,
            source: 'career_mts',
            source_url: url,
            description: title,
            location: item.region?.title || null,
            salary_min: item.salaryFrom ?? null,
            salary_max: item.salaryTo ?? null,
            currency: item.currency?.title === 'RUB' ? 'RUR' : item.currency?.title || 'RUR',
            work_mode: guessWorkMode(formats),
            experience_level: guessExperienceLevel(exp),
            posted_at: item.publishedAt ? new Date(item.publishedAt) : null,
          })
        );
      }

      page += 1;
      if (rows.length === 0) break;
    }

    return {
      sourceId: 'mts',
      sourcesUsedLabel: 'career-mts-api',
      jobs,
    };
  },
};
