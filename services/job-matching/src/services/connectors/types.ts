/**
 * Extended job source connectors (M7-inspired).
 * Spec: docs/JOB_SOURCES_EXPANSION.md
 */

import type { JobInput } from '../../models/job';

export type ExtendedSourceId =
  | 'yandex'
  | 'mts'
  | 'wb'
  | 'alfa'
  | 'sber'
  | 'habr'
  | 'tg'
  | 'getmatch'
  | 'geekjob'
  | 'avito'
  | 'vk'
  | 'tbank';

export interface ConnectorFetchParams {
  keywords: string[];
  /** Soft cap of jobs returned from this connector for one scrape run. */
  maxJobs: number;
  userAgent: string;
}

export interface ConnectorFetchResult {
  sourceId: ExtendedSourceId;
  /** Value pushed into ScrapeResult.sourcesUsed */
  sourcesUsedLabel: string;
  jobs: JobInput[];
}

export interface JobConnector {
  id: ExtendedSourceId;
  /** Stable JobInput.source prefix / value */
  jobSource: string;
  fetch(params: ConnectorFetchParams): Promise<ConnectorFetchResult>;
}
