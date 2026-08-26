/**
 * LEO Med Phase 1 scrape: HH + SuperJob + Med TG, tagged with med_role_id.
 * Gated by ENABLE_MED_VERTICAL. Does not change Jack IT seed keywords / cron.
 */

import type { JobInput } from '../../models/job';
import { logger } from '../../utils/logger';
import {
  persistScrapedJobs,
  scrapeCatalog,
  type ScrapeResult,
} from '../scraper';
import { isMedVerticalEnabled } from './config';
import { buildMedScrapeKeywords } from './keywords';
import { applyMedRoleMapping } from './mapRole';
import { fetchMedTelegramJobs } from './tgIngest';

export interface ScrapeMedOptions {
  keywords?: string[];
  locationId?: number;
  /** Include active Med TG channels (default true). */
  includeTg?: boolean;
}

function tagMedJobs(jobs: JobInput[]): JobInput[] {
  return jobs.map((job) => {
    const tagged = applyMedRoleMapping(job);
    return {
      ...job,
      med_role_id: tagged.med_role_id,
      med_level: tagged.med_level ?? null,
    };
  });
}

async function persistMedJobs(jobs: JobInput[]) {
  return persistScrapedJobs(tagMedJobs(jobs), { enrich: false });
}

/**
 * Medicine-filtered ingest. No-op result when flag is off.
 */
export async function scrapeMedCatalog(options: ScrapeMedOptions = {}): Promise<
  ScrapeResult & { medEnabled: boolean; keywordsUsed: string[] }
> {
  if (!isMedVerticalEnabled()) {
    logger.info('scrapeMedCatalog skipped: ENABLE_MED_VERTICAL is not true');
    return {
      medEnabled: false,
      keywordsUsed: [],
      success: false,
      jobsScraped: 0,
      jobsSaved: 0,
      sourcesUsed: [],
      mockJobsUsed: false,
      errors: ['ENABLE_MED_VERTICAL is not true'],
    };
  }

  const keywords =
    options.keywords && options.keywords.length > 0
      ? options.keywords
      : buildMedScrapeKeywords();
  const locationId = options.locationId && options.locationId > 0 ? options.locationId : 113;
  const includeTg = options.includeTg !== false;

  logger.info(
    `scrapeMedCatalog start keywords=${keywords.length} locationId=${locationId} tg=${includeTg}`
  );

  const boardResult = await scrapeCatalog(keywords, locationId, {
    families: ['hh', 'superjob'],
    allowMockFallback: false,
    enrich: false,
    enrichExtended: false,
    persist: persistMedJobs,
  });

  let tgScraped = 0;
  let tgSaved = 0;
  const tgErrors: string[] = [];
  const sourcesUsed = [...boardResult.sourcesUsed];
  const bySource = { ...(boardResult.bySource || {}) };

  if (includeTg) {
    try {
      const tgJobs = await fetchMedTelegramJobs(keywords);
      tgScraped = tgJobs.length;
      if (tgJobs.length > 0) {
        const tgPersist = await persistMedJobs(tgJobs);
        tgSaved = tgPersist.saved;
        tgErrors.push(...tgPersist.errors);
        for (const [src, counts] of Object.entries(tgPersist.bySource)) {
          if (!sourcesUsed.includes(src)) sourcesUsed.push(src);
          bySource[src] = counts;
        }
      }
    } catch (error: unknown) {
      tgErrors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const jobsScraped = boardResult.jobsScraped + tgScraped;
  const jobsSaved = boardResult.jobsSaved + tgSaved;
  const errors = [...boardResult.errors, ...tgErrors];

  return {
    medEnabled: true,
    keywordsUsed: keywords,
    success: errors.length === 0 || jobsSaved > 0,
    jobsScraped,
    jobsSaved,
    sourcesUsed,
    mockJobsUsed: false,
    errors,
    bySource,
    familyReports: boardResult.familyReports,
  };
}
