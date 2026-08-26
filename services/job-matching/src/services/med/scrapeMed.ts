/**
 * LEO Med scrape: HH + SuperJob + Med HTML boards + all Med TG.
 * Gated by ENABLE_MED_VERTICAL. Does not change Jack IT seed keywords / cron.
 */

import type { JobInput } from '../../models/job';
import { logger } from '../../utils/logger';
import {
  persistScrapedJobs,
  scrapeCatalog,
  type ScrapeResult,
} from '../scraper';
import { fetchMedHtmlBoardJobs } from './boardIngest';
import { isMedVerticalEnabled } from './config';
import { buildMedScrapeKeywords } from './keywords';
import { applyMedRoleMapping } from './mapRole';
import { fetchMedTelegramJobs } from './tgIngest';

export interface ScrapeMedOptions {
  keywords?: string[];
  locationId?: number;
  /** Include active Med TG channels (default true). */
  includeTg?: boolean;
  /** Include active HTML / open-data boards from registry (default true). */
  includeHtmlBoards?: boolean;
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
  const includeHtmlBoards = options.includeHtmlBoards !== false;

  logger.info(
    `scrapeMedCatalog start keywords=${keywords.length} locationId=${locationId} ` +
      `html=${includeHtmlBoards} tg=${includeTg}`
  );

  const boardResult = await scrapeCatalog(keywords, locationId, {
    families: ['hh', 'superjob'],
    allowMockFallback: false,
    enrich: false,
    enrichExtended: false,
    persist: persistMedJobs,
  });

  let htmlScraped = 0;
  let htmlSaved = 0;
  let tgScraped = 0;
  let tgSaved = 0;
  const extraErrors: string[] = [];
  const sourcesUsed = [...boardResult.sourcesUsed];
  const bySource = { ...(boardResult.bySource || {}) };

  const mergePersist = (persist: Awaited<ReturnType<typeof persistMedJobs>>) => {
    for (const [src, counts] of Object.entries(persist.bySource || {})) {
      if (!sourcesUsed.includes(src)) sourcesUsed.push(src);
      bySource[src] = counts;
    }
    extraErrors.push(...persist.errors);
    return persist.saved;
  };

  if (includeHtmlBoards) {
    try {
      const htmlJobs = await fetchMedHtmlBoardJobs(keywords);
      htmlScraped = htmlJobs.length;
      if (htmlJobs.length > 0) {
        htmlSaved = mergePersist(await persistMedJobs(htmlJobs));
      }
    } catch (error: unknown) {
      extraErrors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (includeTg) {
    try {
      const tgJobs = await fetchMedTelegramJobs(keywords);
      tgScraped = tgJobs.length;
      if (tgJobs.length > 0) {
        tgSaved = mergePersist(await persistMedJobs(tgJobs));
      }
    } catch (error: unknown) {
      extraErrors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const jobsScraped = boardResult.jobsScraped + htmlScraped + tgScraped;
  const jobsSaved = boardResult.jobsSaved + htmlSaved + tgSaved;
  const errors = [...boardResult.errors, ...extraErrors];

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
