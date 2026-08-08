/**
 * Habr Career vacancy card probe (Phase 2).
 * Archive only on explicit 404/410.
 */

import type { Job } from '../../models/job';
import { getScraperUserAgent } from '../connectors/config';
import { probeHttpUrl } from './httpProbe';
import type { VacancyProbeResult, VacancyRevalidator } from './types';

const HABR_HOSTS = ['career.habr.com'];
const HABR_VACANCY_PATH = /^\/vacancies\/\d+\/?$/i;

export const habrRevalidator: VacancyRevalidator = {
  id: 'habr',
  sources: ['career.habr.com'],
  async probe(job: Job): Promise<VacancyProbeResult> {
    const url = job.source_url?.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return { status: 'skip', message: 'no habr url' };
    }
    if (!/career\.habr\.com\/vacancies\/\d+/i.test(url)) {
      return { status: 'skip', message: 'not a habr vacancy url' };
    }
    return probeHttpUrl(url, {
      timeoutMs: 12000,
      allowedHosts: HABR_HOSTS,
      requirePathMatch: HABR_VACANCY_PATH,
      headers: {
        'User-Agent': getScraperUserAgent(),
        'Accept-Language': 'ru,en;q=0.8',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
  },
};
