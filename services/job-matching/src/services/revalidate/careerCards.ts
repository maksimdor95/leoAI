/**
 * Career-site vacancy card probes (Phase 3).
 * GET source_url only; archive strictly on 404/410.
 * No HTML body heuristics; redirect off vacancy path → error.
 */

import https from 'https';
import type { Job } from '../../models/job';
import { getScraperUserAgent, isAlfaSslInsecure } from '../connectors/config';
import { probeHttpUrl } from './httpProbe';
import type { VacancyProbeResult, VacancyRevalidator } from './types';

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

type CareerCardSpec = {
  id: string;
  sources: string[];
  allowedHosts: string[];
  /** Soft check before GET — skip if URL doesn't look like a card. */
  urlHint: RegExp;
  requirePathMatch: RegExp;
  httpsAgent?: https.Agent;
};

function createCareerCardRevalidator(spec: CareerCardSpec): VacancyRevalidator {
  return {
    id: spec.id,
    sources: spec.sources,
    async probe(job: Job): Promise<VacancyProbeResult> {
      const url = job.source_url?.trim();
      if (!url || !/^https?:\/\//i.test(url)) {
        return { status: 'skip', message: `no ${spec.id} url` };
      }
      if (!spec.urlHint.test(url)) {
        return { status: 'skip', message: `not a ${spec.id} vacancy url` };
      }
      return probeHttpUrl(url, {
        timeoutMs: 15000,
        allowedHosts: spec.allowedHosts,
        requirePathMatch: spec.requirePathMatch,
        httpsAgent: spec.httpsAgent,
        headers: {
          'User-Agent': getScraperUserAgent(),
          'Accept-Language': 'ru,en;q=0.8',
          Accept: 'text/html,application/xhtml+xml,application/json',
        },
      });
    },
  };
}

/** WB public card: https://career.rwb.ru/vacancies/{id} */
export const wbRevalidator = createCareerCardRevalidator({
  id: 'career_wb',
  sources: ['career_wb'],
  allowedHosts: ['career.rwb.ru'],
  urlHint: /career\.rwb\.ru\/vacancies\/\d+/i,
  requirePathMatch: /^\/vacancies\/\d+\/?$/i,
});

/** MTS: https://job.mts.ru/vacancy/{slug} */
export const mtsRevalidator = createCareerCardRevalidator({
  id: 'career_mts',
  sources: ['career_mts'],
  allowedHosts: ['job.mts.ru'],
  urlHint: /job\.mts\.ru\/vacancy\//i,
  requirePathMatch: /^\/vacancy\/[^/]+\/?$/i,
});

/** Yandex Jobs card / redirect_url on yandex.ru */
export const yandexRevalidator = createCareerCardRevalidator({
  id: 'career_yandex',
  sources: ['career_yandex'],
  allowedHosts: ['yandex.ru', 'www.yandex.ru'],
  urlHint: /yandex\.ru\/jobs\/vacancies\//i,
  requirePathMatch: /^\/jobs\/vacancies\/[^/]+\/?$/i,
});

/** Alfa: https://job.alfabank.ru/vacancies/... */
export const alfaRevalidator: VacancyRevalidator = {
  id: 'career_alfa',
  sources: ['career_alfa'],
  async probe(job: Job): Promise<VacancyProbeResult> {
    const url = job.source_url?.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return { status: 'skip', message: 'no career_alfa url' };
    }
    if (!/job\.alfabank\.ru\/vacancies\//i.test(url)) {
      return { status: 'skip', message: 'not an alfa vacancy url' };
    }
    return probeHttpUrl(url, {
      timeoutMs: 20000,
      allowedHosts: ['job.alfabank.ru'],
      requirePathMatch: /^\/vacancies\/.+/i,
      httpsAgent: isAlfaSslInsecure() ? insecureAgent : undefined,
      headers: {
        'User-Agent': getScraperUserAgent(),
        'Accept-Language': 'ru,en;q=0.8',
        Accept: 'text/html,application/xhtml+xml',
        Referer: 'https://job.alfabank.ru/vacancies',
      },
    });
  },
};

/** Sber: https://rabota.sber.ru/search/{slug}-{internalId}/ */
export const sberRevalidator = createCareerCardRevalidator({
  id: 'career_sber',
  sources: ['career_sber'],
  allowedHosts: ['rabota.sber.ru'],
  urlHint: /rabota\.sber\.ru\/search\/.+/i,
  // Must keep an id-like suffix; bare /search/ is listing.
  requirePathMatch: /^\/search\/.+\d+\/?$/i,
});

export const CAREER_CARD_REVALIDATORS: VacancyRevalidator[] = [
  wbRevalidator,
  mtsRevalidator,
  yandexRevalidator,
  alfaRevalidator,
  sberRevalidator,
];
