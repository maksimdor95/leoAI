/**
 * Multi-source vacancy revalidation probes (Phase 0–3).
 * Fail-open: only archive on confident gone (404/410/archived).
 * HTML/career cards: no body heuristics; redirect off vacancy path → error.
 */

import type { Job, JobInput } from '../../models/job';

export type VacancyProbeResult =
  | { status: 'live'; fresh?: JobInput }
  | { status: 'gone'; reason: 'not_found' | 'archived' }
  | { status: 'error'; message: string }
  | { status: 'skip'; message: string };

export interface VacancyRevalidator {
  /** Stable source id(s) this revalidator owns (jobs.source). */
  sources: string[];
  id: string;
  probe(job: Job): Promise<VacancyProbeResult>;
}

export type RevalidateReport = {
  attempted: number;
  refreshed: number;
  archived: number;
  errors: number;
  skipped: number;
  bySource: Record<string, { attempted: number; refreshed: number; archived: number; errors: number }>;
};

export function emptyRevalidateReport(): RevalidateReport {
  return {
    attempted: 0,
    refreshed: 0,
    archived: 0,
    errors: 0,
    skipped: 0,
    bySource: {},
  };
}

export function bumpSource(
  report: RevalidateReport,
  source: string,
  field: 'attempted' | 'refreshed' | 'archived' | 'errors'
): void {
  if (!report.bySource[source]) {
    report.bySource[source] = { attempted: 0, refreshed: 0, archived: 0, errors: 0 };
  }
  report.bySource[source][field] += 1;
}
