/**
 * Registry of extended job connectors.
 * Spec: docs/JOB_SOURCES_EXPANSION.md
 */

import type { JobInput } from '../../models/job';
import { logger } from '../../utils/logger';
import { alfaConnector } from './alfaConnector';
import {
  getExtendedConnectorConcurrency,
  getExtendedKeywordLimit,
  getExtendedMaxPerSource,
  getExtendedSourceIds,
  getScraperUserAgent,
  isExtendedJobSourcesEnabled,
  isRunnableSource,
} from './config';
import { geekjobConnector } from './geekjobConnector';
import { getmatchConnector } from './getmatchConnector';
import { habrConnector } from './habrConnector';
import {
  avitoConnector,
  tbankConnector,
  vkConnector,
} from './htmlCareerConnector';
import { mtsConnector } from './mtsConnector';
import { sberConnector } from './sberConnector';
import { tgConnector } from './tgConnector';
import type { ConnectorFetchResult, ExtendedSourceId, JobConnector } from './types';
import { wbConnector } from './wbConnector';
import { yandexConnector } from './yandexConnector';

const ALL: Record<ExtendedSourceId, JobConnector> = {
  yandex: yandexConnector,
  mts: mtsConnector,
  wb: wbConnector,
  alfa: alfaConnector,
  sber: sberConnector,
  habr: habrConnector,
  tg: tgConnector,
  getmatch: getmatchConnector,
  geekjob: geekjobConnector,
  avito: avitoConnector,
  vk: vkConnector,
  tbank: tbankConnector,
};

export function resolveConnectors(): JobConnector[] {
  return getExtendedSourceIds()
    .map((id) => ALL[id])
    .filter((c): c is JobConnector => Boolean(c));
}

export interface ExtendedScrapeAggregate {
  jobs: JobInput[];
  sourcesUsed: string[];
  errors: string[];
}

export interface ExtendedScrapeHooks {
  /**
   * Called after each connector finishes (Kabi-style early persist).
   * Errors from the hook are collected into `errors` and do not abort the run.
   */
  afterConnector?: (batch: {
    connectorId: ExtendedSourceId;
    sourcesUsedLabel: string;
    jobs: JobInput[];
  }) => Promise<void>;
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = next;
      next += 1;
      if (idx >= items.length) return;
      await worker(items[idx]);
    }
  });
  await Promise.all(runners);
}

/**
 * Run enabled extended connectors with bounded parallelism (fail-open).
 * No-op when ENABLE_EXTENDED_JOB_SOURCES is not true.
 */
export async function scrapeExtendedSources(
  keywords: string[],
  hooks?: ExtendedScrapeHooks
): Promise<ExtendedScrapeAggregate> {
  const out: ExtendedScrapeAggregate = { jobs: [], sourcesUsed: [], errors: [] };

  if (!isExtendedJobSourcesEnabled()) {
    return out;
  }

  const keywordLimit = getExtendedKeywordLimit();
  const maxJobs = getExtendedMaxPerSource();
  const userAgent = getScraperUserAgent();
  const limitedKeywords = keywords.slice(0, keywordLimit);
  const connectors = resolveConnectors().filter((c) => {
    if (!isRunnableSource(c.id)) {
      logger.info(`Skipping non-runnable extended source: ${c.id}`);
      return false;
    }
    return true;
  });
  const concurrency = getExtendedConnectorConcurrency();

  logger.info(
    `Extended sources enabled: ${connectors.map((c) => c.id).join(', ')} ` +
      `(keywords=${limitedKeywords.length}, maxPerSource=${maxJobs}, concurrency=${concurrency})`
  );

  await runPool(connectors, concurrency, async (connector) => {
    try {
      const result: ConnectorFetchResult = await connector.fetch({
        keywords: limitedKeywords,
        maxJobs,
        userAgent,
      });
      if (result.jobs.length > 0) {
        out.jobs.push(...result.jobs);
        out.sourcesUsed.push(result.sourcesUsedLabel);
        logger.info(`Extended source ${connector.id}: ${result.jobs.length} jobs`);
      } else {
        logger.info(`Extended source ${connector.id}: 0 jobs`);
      }

      if (hooks?.afterConnector) {
        try {
          await hooks.afterConnector({
            connectorId: connector.id,
            sourcesUsedLabel: result.sourcesUsedLabel,
            jobs: result.jobs,
          });
        } catch (hookError: unknown) {
          const msg = hookError instanceof Error ? hookError.message : String(hookError);
          logger.warn(`Extended source ${connector.id} afterConnector failed: ${msg}`);
          out.errors.push(`${connector.id}:afterConnector: ${msg}`);
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn(`Extended source ${connector.id} failed: ${msg}`);
      out.errors.push(`${connector.id}: ${msg}`);
    }
  });

  return out;
}

export { ALL as extendedConnectorsById };
