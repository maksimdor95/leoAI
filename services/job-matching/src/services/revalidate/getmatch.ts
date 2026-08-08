/**
 * Getmatch vacancy probe via public card URL GET.
 */

import type { Job } from '../../models/job';
import { getScraperUserAgent } from '../connectors/config';
import { probeHttpUrl } from './httpProbe';
import type { VacancyProbeResult, VacancyRevalidator } from './types';

const GETMATCH_HOSTS = ['getmatch.ru', 'www.getmatch.ru'];
const GETMATCH_VACANCY_PATH = /^\/vacancies\/[^/]+\/?$/i;

export const getmatchRevalidator: VacancyRevalidator = {
  id: 'getmatch',
  sources: ['getmatch.ru'],
  async probe(job: Job): Promise<VacancyProbeResult> {
    const url = job.source_url?.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return { status: 'skip', message: 'no getmatch url' };
    }
    if (!/getmatch\.ru\/vacancies\//i.test(url)) {
      return { status: 'skip', message: 'not a getmatch vacancy url' };
    }
    return probeHttpUrl(url, {
      timeoutMs: 12000,
      allowedHosts: GETMATCH_HOSTS,
      requirePathMatch: GETMATCH_VACANCY_PATH,
      headers: {
        'User-Agent': getScraperUserAgent(),
        'Accept-Language': 'ru,en;q=0.8',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
  },
};
