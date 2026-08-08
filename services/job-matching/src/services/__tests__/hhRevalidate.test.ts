import axios from 'axios';
import { probeHhVacancyStatus } from '../revalidate/hh';
import { extractSuperJobVacancyId, probeSuperJobVacancyStatus } from '../revalidate/superjob';
import { getmatchRevalidator } from '../revalidate/getmatch';
import { habrRevalidator } from '../revalidate/habr';
import { geekjobRevalidator } from '../revalidate/geekjob';
import {
  wbRevalidator,
  mtsRevalidator,
  yandexRevalidator,
  alfaRevalidator,
  sberRevalidator,
} from '../revalidate/careerCards';
import {
  getRevalidatorForSource,
  getRevalidateSourceList,
  resolveRevalidateSources,
} from '../revalidate/registry';
import { getRevalidateAfterHours, getRevalidateLimit } from '../revalidate/runRevalidate';
import { probeHttpUrl } from '../revalidate/httpProbe';
import type { Job } from '../../models/job';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
  isAxiosError: (e: unknown) =>
    Boolean(e && typeof e === 'object' && (e as { isAxiosError?: boolean }).isAxiosError),
}));

jest.mock('../scraper', () => ({
  fetchHhVacancyDetails: jest.fn(async () => ({
    title: 'PO',
    company: 'Acme',
    location: ['Москва'],
    description: 'd',
    requirements: 'r',
    skills: [],
    source: 'hh.ru',
    source_url: 'https://hh.ru/vacancy/1',
  })),
  fetchSuperJobVacancyDetails: jest.fn(async () => ({
    title: 'PO',
    company: 'Acme',
    location: ['Москва'],
    description: 'd',
    requirements: 'r',
    skills: [],
    source: 'superjob.ru',
    source_url: 'https://www.superjob.ru/vakansii/12345.html',
  })),
}));

jest.mock('../connectors/config', () => ({
  getScraperUserAgent: () => 'test-ua',
  isAlfaSslInsecure: () => true,
}));

const mockedGet = axios.get as jest.MockedFunction<typeof axios.get>;

function stubJob(partial: Pick<Job, 'source' | 'source_url'>): Job {
  return {
    id: '1',
    title: 'x',
    company: 'y',
    location: [],
    salary_min: null,
    salary_max: null,
    currency: null,
    description: '',
    requirements: '',
    skills: [],
    experience_level: null,
    work_mode: null,
    source_meta: null,
    role_family: null,
    posted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...partial,
  };
}

describe('revalidate Phase 0–3', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    delete process.env.JOB_REVALIDATE_AFTER_HOURS;
    delete process.env.JOB_REVALIDATE_LIMIT;
    delete process.env.JOB_REVALIDATE_SOURCES;
    delete process.env.SUPERJOB_API_KEY;
  });

  it('registry includes boards + career cards', () => {
    const sources = getRevalidateSourceList();
    expect(sources).toEqual(
      expect.arrayContaining([
        'hh.ru',
        'superjob.ru',
        'getmatch.ru',
        'career.habr.com',
        'geekjob.ru',
        'career_wb',
        'career_mts',
        'career_yandex',
        'career_alfa',
        'career_sber',
      ])
    );
    expect(getRevalidatorForSource('career.habr.com')?.id).toBe('habr');
    expect(getRevalidatorForSource('career_wb')?.id).toBe('career_wb');
  });

  it('JOB_REVALIDATE_SOURCES filters by source or revalidator id', () => {
    process.env.JOB_REVALIDATE_SOURCES = 'habr,career_wb';
    expect(resolveRevalidateSources()).toEqual(['career.habr.com', 'career_wb']);
  });

  it('defaults: after 24h, limit 40', () => {
    expect(getRevalidateAfterHours()).toBe(24);
    expect(getRevalidateLimit()).toBe(40);
  });

  it('HH probe: 404 → gone', async () => {
    mockedGet.mockResolvedValue({ status: 404, data: {} });
    await expect(probeHhVacancyStatus('123')).resolves.toEqual({
      status: 'gone',
      reason: 'not_found',
    });
  });

  it('HH probe: archived → gone', async () => {
    mockedGet.mockResolvedValue({ status: 200, data: { archived: true } });
    await expect(probeHhVacancyStatus('123')).resolves.toEqual({
      status: 'gone',
      reason: 'archived',
    });
  });

  it('HH probe: live returns fresh payload', async () => {
    mockedGet.mockResolvedValue({ status: 200, data: { archived: false } });
    const result = await probeHhVacancyStatus('123');
    expect(result.status).toBe('live');
    if (result.status === 'live') {
      expect(result.fresh?.source).toBe('hh.ru');
    }
  });

  it('extracts SuperJob id from url', () => {
    expect(extractSuperJobVacancyId('https://www.superjob.ru/vakansii/987654.html')).toBe(
      '987654'
    );
  });

  it('SuperJob probe skips without API key', async () => {
    const result = await probeSuperJobVacancyStatus('1');
    expect(result).toEqual({ status: 'skip', message: 'SUPERJOB_API_KEY not set' });
  });

  it('SuperJob probe: 404 → gone', async () => {
    process.env.SUPERJOB_API_KEY = 'test';
    mockedGet.mockResolvedValue({ status: 404, data: {} });
    await expect(probeSuperJobVacancyStatus('99')).resolves.toEqual({
      status: 'gone',
      reason: 'not_found',
    });
  });

  it('httpProbe: 404 → gone, 200 → live, 403/timeout → error', async () => {
    mockedGet.mockResolvedValueOnce({ status: 404, data: '' });
    await expect(probeHttpUrl('https://getmatch.ru/vacancies/1')).resolves.toEqual({
      status: 'gone',
      reason: 'not_found',
    });

    mockedGet.mockResolvedValueOnce({ status: 200, data: '<html/>' });
    await expect(probeHttpUrl('https://getmatch.ru/vacancies/1')).resolves.toEqual({
      status: 'live',
    });

    mockedGet.mockResolvedValueOnce({ status: 403, data: 'blocked' });
    const forbidden = await probeHttpUrl('https://getmatch.ru/vacancies/1');
    expect(forbidden.status).toBe('error');

    mockedGet.mockRejectedValueOnce({ isAxiosError: true, message: 'timeout' });
    const err = await probeHttpUrl('https://getmatch.ru/vacancies/1');
    expect(err.status).toBe('error');
  });

  it('httpProbe: redirect to listing → error (not gone)', async () => {
    mockedGet.mockResolvedValueOnce({
      status: 200,
      data: '<html/>',
      config: { url: 'https://career.habr.com/vacancies' },
      request: { res: { responseUrl: 'https://career.habr.com/vacancies' } },
    });
    const result = await probeHttpUrl('https://career.habr.com/vacancies/123', {
      allowedHosts: ['career.habr.com'],
      requirePathMatch: /^\/vacancies\/\d+\/?$/i,
    });
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toMatch(/redirected away/);
    }
  });

  it('Getmatch revalidator skips non-vacancy urls', async () => {
    const result = await getmatchRevalidator.probe(
      stubJob({ source: 'getmatch.ru', source_url: 'https://getmatch.ru/' })
    );
    expect(result.status).toBe('skip');
  });

  it('Habr: 404 → gone, 200 → live', async () => {
    mockedGet.mockResolvedValueOnce({
      status: 404,
      data: '',
      config: { url: 'https://career.habr.com/vacancies/1' },
      request: { res: { responseUrl: 'https://career.habr.com/vacancies/1' } },
    });
    await expect(
      habrRevalidator.probe(
        stubJob({ source: 'career.habr.com', source_url: 'https://career.habr.com/vacancies/1' })
      )
    ).resolves.toEqual({ status: 'gone', reason: 'not_found' });

    mockedGet.mockResolvedValueOnce({
      status: 200,
      data: '<html/>',
      config: { url: 'https://career.habr.com/vacancies/1' },
      request: { res: { responseUrl: 'https://career.habr.com/vacancies/1' } },
    });
    await expect(
      habrRevalidator.probe(
        stubJob({ source: 'career.habr.com', source_url: 'https://career.habr.com/vacancies/1' })
      )
    ).resolves.toEqual({ status: 'live' });
  });

  it('Geekjob: 410 → gone', async () => {
    mockedGet.mockResolvedValueOnce({
      status: 410,
      data: '',
      config: { url: 'https://geekjob.ru/vacancy/abcdef0123456789abcdef01' },
      request: {
        res: { responseUrl: 'https://geekjob.ru/vacancy/abcdef0123456789abcdef01' },
      },
    });
    await expect(
      geekjobRevalidator.probe(
        stubJob({
          source: 'geekjob.ru',
          source_url: 'https://geekjob.ru/vacancy/abcdef0123456789abcdef01',
        })
      )
    ).resolves.toEqual({ status: 'gone', reason: 'not_found' });
  });

  it('Career cards: WB/MTS/Yandex/Alfa/Sber 404 → gone, 500 → error', async () => {
    const cases: Array<{ probe: typeof wbRevalidator; url: string; source: string }> = [
      {
        probe: wbRevalidator,
        source: 'career_wb',
        url: 'https://career.rwb.ru/vacancies/42',
      },
      {
        probe: mtsRevalidator,
        source: 'career_mts',
        url: 'https://job.mts.ru/vacancy/product-manager',
      },
      {
        probe: yandexRevalidator,
        source: 'career_yandex',
        url: 'https://yandex.ru/jobs/vacancies/backend-dev',
      },
      {
        probe: alfaRevalidator,
        source: 'career_alfa',
        url: 'https://job.alfabank.ru/vacancies/123',
      },
      {
        probe: sberRevalidator,
        source: 'career_sber',
        url: 'https://rabota.sber.ru/search/po-999/',
      },
    ];

    for (const c of cases) {
      mockedGet.mockResolvedValueOnce({
        status: 404,
        data: '',
        config: { url: c.url },
        request: { res: { responseUrl: c.url } },
      });
      await expect(c.probe.probe(stubJob({ source: c.source, source_url: c.url }))).resolves.toEqual(
        { status: 'gone', reason: 'not_found' }
      );

      // validateStatus < 500 → axios throws on 500 → fail-open error (not archive)
      mockedGet.mockRejectedValueOnce({
        isAxiosError: true,
        message: 'Request failed with status code 500',
        response: { status: 500 },
      });
      const err = await c.probe.probe(stubJob({ source: c.source, source_url: c.url }));
      expect(err.status).toBe('error');
    }
  });

  it('Sber listing URL without id → skip', async () => {
    const result = await sberRevalidator.probe(
      stubJob({ source: 'career_sber', source_url: 'https://rabota.sber.ru/search/' })
    );
    expect(result.status).toBe('skip');
  });
});
