/**
 * Wildberries career public API (career.rwb.ru).
 * Spec: docs/JOB_SOURCES_EXPANSION.md
 */

import axios from 'axios';
import { logger } from '../../utils/logger';
import { guessExperienceLevel, guessWorkMode, mapToJobInput } from './mapJob';
import type { ConnectorFetchParams, ConnectorFetchResult, JobConnector } from './types';

const BASE = 'https://career.rwb.ru';
const LIST_URL = `${BASE}/crm-api/api/v1/pub/vacancies`;

interface WbVacancy {
  id?: number;
  name?: string;
  direction_title?: string;
  direction_role_title?: string;
  experience_type_title?: string;
  city_title?: string;
  employment_types?: Array<{ title?: string }>;
}

export const wbConnector: JobConnector = {
  id: 'wb',
  jobSource: 'career_wb',

  async fetch(params: ConnectorFetchParams): Promise<ConnectorFetchResult> {
    const jobs = [];
    const seen = new Set<string>();
    const keywords = params.keywords.slice(0, 5);
    // Empty title = full slice; also query per keyword for better recall.
    const queries = keywords.length > 0 ? keywords : [''];

    for (const titleQ of queries) {
      if (jobs.length >= params.maxJobs) break;
      const resp = await axios.get(LIST_URL, {
        timeout: 25000,
        params: {
          title: titleQ || undefined,
          limit: Math.min(50, params.maxJobs),
          offset: 0,
        },
        headers: {
          'User-Agent': params.userAgent,
          Accept: 'application/json',
          Referer: `${BASE}/`,
        },
        validateStatus: (s) => s < 500,
      });

      if (resp.status !== 200) {
        logger.warn(`wb api → HTTP ${resp.status}`);
        continue;
      }

      const payload = resp.data as { data?: { items?: WbVacancy[] } };
      const items = payload.data?.items || [];

      for (const item of items) {
        if (jobs.length >= params.maxJobs) break;
        const title = String(item.name || '').trim();
        const id = item.id;
        if (!title || id == null) continue;

        const url = `${BASE}/vacancies/${id}`;
        if (seen.has(url)) continue;
        seen.add(url);

        const emp = (item.employment_types || []).map((e) => e.title || '').join(' ');
        const loc = item.city_title || null;

        jobs.push(
          mapToJobInput({
            title,
            company: 'Wildberries',
            source: 'career_wb',
            source_url: url,
            description: [item.direction_role_title, item.direction_title]
              .filter(Boolean)
              .join(' · ') || title,
            location: loc,
            work_mode: guessWorkMode(emp),
            experience_level: guessExperienceLevel(item.experience_type_title),
          })
        );
      }
    }

    return {
      sourceId: 'wb',
      sourcesUsedLabel: 'career-wb-api',
      jobs,
    };
  },
};
