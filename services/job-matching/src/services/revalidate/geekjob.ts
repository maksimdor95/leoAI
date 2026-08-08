/**
 * Geekjob.ru vacancy card probe (Phase 2).
 * Archive only on explicit 404/410.
 */

import type { Job } from '../../models/job';
import { getScraperUserAgent } from '../connectors/config';
import { probeHttpUrl } from './httpProbe';
import type { VacancyProbeResult, VacancyRevalidator } from './types';

const GEEKJOB_HOSTS = ['geekjob.ru', 'www.geekjob.ru'];
const GEEKJOB_VACANCY_PATH = /^\/vacancy\/[a-f0-9]{16,32}\/?$/i;

export const geekjobRevalidator: VacancyRevalidator = {
  id: 'geekjob',
  sources: ['geekjob.ru'],
  async probe(job: Job): Promise<VacancyProbeResult> {
    const url = job.source_url?.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return { status: 'skip', message: 'no geekjob url' };
    }
    if (!/geekjob\.ru\/vacancy\/[a-f0-9]{16,32}/i.test(url)) {
      return { status: 'skip', message: 'not a geekjob vacancy url' };
    }
    return probeHttpUrl(url, {
      timeoutMs: 12000,
      allowedHosts: GEEKJOB_HOSTS,
      requirePathMatch: GEEKJOB_VACANCY_PATH,
      headers: {
        'User-Agent': getScraperUserAgent(),
        'Accept-Language': 'ru,en;q=0.8',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
  },
};
