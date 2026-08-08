/**
 * Multi-source revalidation orchestrator (Phase 0–3).
 */

import jobRepository from '../../models/jobRepository';
import { logger } from '../../utils/logger';
import { getRevalidatorForSource, resolveRevalidateSources } from './registry';
import {
  bumpSource,
  emptyRevalidateReport,
  type RevalidateReport,
} from './types';

/** Jobs not touched for this many hours (default 24). */
export function getRevalidateAfterHours(): number {
  const parsed = parseInt(process.env.JOB_REVALIDATE_AFTER_HOURS || '24', 10);
  return Number.isFinite(parsed) ? Math.min(168, Math.max(1, parsed)) : 24;
}

export function getRevalidateLimit(): number {
  const n = parseInt(process.env.JOB_REVALIDATE_LIMIT || '40', 10);
  return Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : 40;
}

function getRevalidateDelayMs(): number {
  const n = parseInt(process.env.JOB_REVALIDATE_DELAY_MS || '250', 10);
  return Number.isFinite(n) ? Math.min(2000, Math.max(0, n)) : 250;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Revalidate oldest stale active jobs across registered sources.
 * Fail-open on transient errors (do not archive).
 */
export async function revalidateStaleJobs(options?: {
  olderThanHours?: number;
  limit?: number;
  delayMs?: number;
  sources?: string[];
}): Promise<RevalidateReport> {
  const olderThanHours = options?.olderThanHours ?? getRevalidateAfterHours();
  const limit = options?.limit ?? getRevalidateLimit();
  const delayMs = options?.delayMs ?? getRevalidateDelayMs();
  const sources = resolveRevalidateSources(options?.sources);

  const report = emptyRevalidateReport();

  if (sources.length === 0) {
    logger.warn('revalidate: no sources matched JOB_REVALIDATE_SOURCES / options');
    return report;
  }

  const candidates = await jobRepository.findDueForRevalidate({
    sources,
    olderThanHours,
    limit,
  });

  for (const job of candidates) {
    report.attempted += 1;
    bumpSource(report, job.source, 'attempted');

    const revalidator = getRevalidatorForSource(job.source);
    if (!revalidator) {
      report.skipped += 1;
      continue;
    }

    const probe = await revalidator.probe(job);

    if (probe.status === 'skip') {
      report.skipped += 1;
      logger.info(`revalidate skip job=${job.id} source=${job.source}: ${probe.message}`);
    } else if (probe.status === 'gone') {
      await jobRepository.archiveJob(job.id);
      report.archived += 1;
      bumpSource(report, job.source, 'archived');
      logger.info(
        `revalidate archived job=${job.id} source=${job.source} reason=${probe.reason}`
      );
    } else if (probe.status === 'live') {
      if (probe.fresh) {
        await jobRepository.createOrUpdate(probe.fresh);
        report.refreshed += 1;
        bumpSource(report, job.source, 'refreshed');
      } else {
        await jobRepository.touchJob(job.id);
        report.refreshed += 1;
        bumpSource(report, job.source, 'refreshed');
      }
    } else {
      report.errors += 1;
      bumpSource(report, job.source, 'errors');
      logger.warn(
        `revalidate error job=${job.id} source=${job.source}: ${probe.message}`
      );
    }

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  logger.info(
    `revalidate done: attempted=${report.attempted} refreshed=${report.refreshed} ` +
      `archived=${report.archived} errors=${report.errors} skipped=${report.skipped} ` +
      `bySource=${JSON.stringify(report.bySource)}`
  );
  return report;
}

/** @deprecated Use revalidateStaleJobs — kept for call-site compatibility. */
export async function revalidateStaleHhJobs(options?: {
  olderThanHours?: number;
  limit?: number;
  delayMs?: number;
}): Promise<RevalidateReport> {
  return revalidateStaleJobs({
    ...options,
    sources: ['hh.ru'],
  });
}
