/**
 * Phase 0: extended-only ingest persists after each connector without HH/SJ.
 */

jest.mock('../connectors', () => {
  const actual = jest.requireActual('../connectors');
  return {
    ...actual,
    scrapeExtendedSources: jest.fn(),
  };
});

jest.mock('../../models/jobRepository', () => ({
  __esModule: true,
  default: {
    createOrUpdate: jest.fn().mockResolvedValue({ id: 'job-1' }),
  },
}));

import { scrapeExtendedSources } from '../connectors';
import jobRepository from '../../models/jobRepository';
import { scrapeExtendedOnly } from '../scraper';
import type { JobInput } from '../../models/job';

const scrapeExtendedSourcesMock = scrapeExtendedSources as jest.MockedFunction<
  typeof scrapeExtendedSources
>;
const createOrUpdateMock = jobRepository.createOrUpdate as jest.MockedFunction<
  typeof jobRepository.createOrUpdate
>;

function fakeJob(source: string, url: string): JobInput {
  return {
    title: 'Product Manager',
    company: 'TestCo',
    location: ['Москва'],
    salary_min: null,
    salary_max: null,
    currency: null,
    description: 'desc',
    requirements: '',
    skills: [],
    experience_level: null,
    work_mode: null,
    source,
    source_url: url,
    posted_at: null,
    role_family: null,
    source_meta: null,
  };
}

describe('scrapeExtendedOnly', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createOrUpdateMock.mockResolvedValue({ id: 'job-1' } as never);
  });

  it('persists each connector batch via afterConnector and skips HH', async () => {
    scrapeExtendedSourcesMock.mockImplementation(async (_keywords, hooks) => {
      const wb = [fakeJob('career_wb', 'https://example.com/wb/1')];
      const sber = [
        fakeJob('career_sber', 'https://example.com/sber/1'),
        fakeJob('career_sber', 'https://example.com/sber/2'),
      ];

      await hooks?.afterConnector?.({
        connectorId: 'wb',
        sourcesUsedLabel: 'career-wb-api',
        jobs: wb,
      });
      await hooks?.afterConnector?.({
        connectorId: 'sber',
        sourcesUsedLabel: 'career-sber-api',
        jobs: sber,
      });

      return {
        jobs: [...wb, ...sber],
        sourcesUsed: ['career-wb-api', 'career-sber-api'],
        errors: [],
      };
    });

    const result = await scrapeExtendedOnly(['Product Manager']);

    expect(result.success).toBe(true);
    expect(result.jobsScraped).toBe(3);
    expect(result.jobsSaved).toBe(3);
    expect(result.sourcesUsed).toEqual(['career-wb-api', 'career-sber-api']);
    expect(createOrUpdateMock).toHaveBeenCalledTimes(3);
    expect(createOrUpdateMock.mock.calls[0][0].source).toBe('career_wb');
  });

  it('survives empty connector batches and reports soft error when nothing fetched', async () => {
    scrapeExtendedSourcesMock.mockResolvedValue({
      jobs: [],
      sourcesUsed: [],
      errors: [],
    });

    const result = await scrapeExtendedOnly(['Product Manager']);

    expect(result.success).toBe(false);
    expect(result.jobsSaved).toBe(0);
    expect(createOrUpdateMock).not.toHaveBeenCalled();
    expect(result.errors.some((e) => /No extended jobs fetched/i.test(e))).toBe(true);
  });
});
