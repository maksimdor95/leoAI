/**
 * Alfa-Bank careers public API.
 * Spec: docs/JOB_SOURCES_EXPANSION.md
 *
 * Requires `take` query param (without it API returns items: []).
 * TLS: chain may include self-signed intermediate → ALFA_SSL_INSECURE.
 */

import https from 'https';
import axios from 'axios';
import { logger } from '../../utils/logger';
import { isAlfaSslInsecure } from './config';
import { guessWorkMode, mapToJobInput, stripHtml } from './mapJob';
import type { ConnectorFetchParams, ConnectorFetchResult, JobConnector } from './types';

const LIST_URL = 'https://job.alfabank.ru/api/vacancies';
const insecureAgent = new https.Agent({ rejectUnauthorized: false });

interface AlfaItem {
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  descriptionText?: string;
  requirements?: string;
  duties?: string;
  createdAt?: string;
  cityId?: string;
}

function detailUrl(slug: string | undefined, id: string): string {
  if (slug?.startsWith('/')) {
    return `https://job.alfabank.ru/vacancies${slug}`;
  }
  if (slug) {
    return `https://job.alfabank.ru/vacancies/${slug}`;
  }
  return `https://job.alfabank.ru/vacancies/${id}`;
}

export const alfaConnector: JobConnector = {
  id: 'alfa',
  jobSource: 'career_alfa',

  async fetch(params: ConnectorFetchParams): Promise<ConnectorFetchResult> {
    const jobs = [];
    const seen = new Set<string>();
    const keywords = params.keywords.length > 0 ? params.keywords : [''];
    const take = Math.min(50, params.maxJobs);
    const insecure = isAlfaSslInsecure();

    for (const text of keywords) {
      if (jobs.length >= params.maxJobs) break;
      let skip = 0;
      let total = Infinity;

      while (skip < total && jobs.length < params.maxJobs && skip < params.maxJobs * 2) {
        const resp = await axios.get(LIST_URL, {
          timeout: 30000,
          httpsAgent: insecure ? insecureAgent : undefined,
          params: {
            take,
            skip,
            ...(text ? { text } : {}),
          },
          headers: {
            'User-Agent': params.userAgent,
            Accept: 'application/json',
            Referer: 'https://job.alfabank.ru/vacancies',
          },
          validateStatus: (s) => s < 500,
        });

        if (resp.status !== 200) {
          logger.warn(`alfa api → HTTP ${resp.status}`);
          break;
        }

        const payload = resp.data as {
          total?: number;
          items?: AlfaItem[];
          take?: number;
        };
        const items = payload.items || [];
        total = typeof payload.total === 'number' ? payload.total : items.length;
        if (items.length === 0) break;

        for (const item of items) {
          if (jobs.length >= params.maxJobs) break;
          const title = String(item.name || '').trim();
          const id = String(item.id || '').trim();
          if (!title || !id) continue;

          const url = detailUrl(item.slug, id);
          if (seen.has(url)) continue;
          seen.add(url);

          const desc =
            stripHtml(item.descriptionText || item.description || item.duties || '') || title;
          const reqs = stripHtml(item.requirements || '');

          jobs.push(
            mapToJobInput({
              title,
              company: 'Альфа-Банк',
              source: 'career_alfa',
              source_url: url,
              description: desc.slice(0, 5000),
              requirements: reqs.slice(0, 3000),
              work_mode: guessWorkMode(item.slug || ''),
              posted_at: item.createdAt ? new Date(item.createdAt) : null,
            })
          );
        }

        skip += take;
        if (items.length < take) break;
      }
    }

    return {
      sourceId: 'alfa',
      sourcesUsedLabel: 'career-alfa-api',
      jobs,
    };
  },
};
