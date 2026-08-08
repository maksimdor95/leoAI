/**
 * Backward-compatible exports for HH revalidate.
 * Implementation lives in ./revalidate/*
 */

export { probeHhVacancyStatus } from './revalidate/hh';
export type { VacancyProbeResult as HhVacancyProbeResult } from './revalidate/types';
export {
  revalidateStaleJobs,
  revalidateStaleHhJobs,
  getRevalidateAfterHours,
  getRevalidateLimit,
} from './revalidate/runRevalidate';
export type { RevalidateReport as RevalidateHhReport } from './revalidate/types';

/** @deprecated Use getRevalidateAfterHours */
export { getRevalidateAfterHours as getHhRevalidateAfterHours } from './revalidate/runRevalidate';
/** @deprecated Use getRevalidateLimit */
export { getRevalidateLimit as getHhRevalidateLimit } from './revalidate/runRevalidate';
