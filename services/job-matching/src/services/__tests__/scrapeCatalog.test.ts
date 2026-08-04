/**
 * Phase 1: source families are isolated — HH failure must not block extended persist.
 */

import { scrapeCatalog } from '../scraper';
import type { JobInput } from '../../models/job';
import type { ExtendedScrapeAggregate, ExtendedScrapeHooks } from '../connectors';

function fakeJob(source: string, url: string): JobInput {
  return {
    title: 'Product Manager',
    company: 'TestCo',
    location: ['Москва'],
    description: 'desc',
    requirements: '',
    skills: [],
    source,
    source_url: url,
  };
}

describe('scrapeCatalog orchestrator', () => {
  it('persists extended even when HH fetch throws', async () => {
    const persisted: string[] = [];

    const result = await scrapeCatalog(['Product Manager'], 113, {
      families: ['hh', 'extended'],
      enrich: false,
      allowMockFallback: false,
      fetchHh: async () => {
        throw new Error('HH exploded');
      },
      fetchExtended: async (_keywords, hooks?: ExtendedScrapeHooks) => {
        const jobs = [fakeJob('career_wb', 'https://example.com/wb/iso')];
        await hooks?.afterConnector?.({
          connectorId: 'wb',
          sourcesUsedLabel: 'career-wb-api',
          jobs,
        });
        const out: ExtendedScrapeAggregate = {
          jobs,
          sourcesUsed: ['career-wb-api'],
          errors: [],
        };
        return out;
      },
      persist: async (jobs) => {
        for (const job of jobs) persisted.push(job.source);
        return {
          saved: jobs.length,
          errors: [],
          bySource: { [jobs[0]?.source || 'x']: { scraped: jobs.length, saved: jobs.length } },
        };
      },
    });

    expect(result.success).toBe(true);
    expect(result.jobsSaved).toBe(1);
    expect(persisted).toEqual(['career_wb']);
    expect(result.bySource?.['career_wb']?.saved).toBe(1);
    expect(result.sourcesUsed).toContain('career-wb-api');
    expect(result.errors.some((e) => /HH exploded/i.test(e))).toBe(true);
  });

  it('records family timeout without aborting siblings', async () => {
    const prev = process.env.SCRAPE_HH_TIMEOUT_MS;
    process.env.SCRAPE_HH_TIMEOUT_MS = '50';

    try {
      const result = await scrapeCatalog(['Product Manager'], 113, {
        families: ['hh', 'extended'],
        enrich: false,
        allowMockFallback: false,
        fetchHh: async () => {
          await new Promise((r) => setTimeout(r, 500));
          return [fakeJob('hh.ru', 'https://hh.ru/vacancy/1')];
        },
        fetchExtended: async (_keywords, hooks?: ExtendedScrapeHooks) => {
          const jobs = [fakeJob('career_sber', 'https://example.com/sber/iso')];
          await hooks?.afterConnector?.({
            connectorId: 'sber',
            sourcesUsedLabel: 'career-sber-api',
            jobs,
          });
          return { jobs, sourcesUsed: ['career-sber-api'], errors: [] };
        },
        persist: async (jobs) => ({
          saved: jobs.length,
          errors: [],
          bySource: { [jobs[0]?.source || 'x']: { scraped: jobs.length, saved: jobs.length } },
        }),
      });

      expect(result.jobsSaved).toBe(1);
      expect(result.sourcesUsed).toContain('career-sber-api');
      expect(result.errors.some((e) => /hh family timed out/i.test(e))).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.SCRAPE_HH_TIMEOUT_MS;
      else process.env.SCRAPE_HH_TIMEOUT_MS = prev;
    }
  });
});
