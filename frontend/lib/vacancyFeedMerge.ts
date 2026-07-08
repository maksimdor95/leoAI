/**
 * Pure vacancy feed merge/detect helpers (no browser APIs).
 * Keep logic in sync with services/job-matching/src/utils/vacancyFeedMerge.ts
 */

export type MatchedJobItemLike = {
  job: { id: string };
  score: number;
};

export function mergeVacancyTierLists<T extends MatchedJobItemLike>(
  incoming: T[],
  existing: T[],
  excludeIds: Set<string>
): T[] {
  const incomingIds = new Set(incoming.map((item) => item.job.id));
  const merged = [...incoming];
  for (const item of existing) {
    const id = item.job.id;
    if (!incomingIds.has(id) && !excludeIds.has(id)) {
      merged.push(item);
    }
  }
  return merged;
}

export function syncVacancyListsFromApi<T extends MatchedJobItemLike>(
  incomingRecommended: T[],
  incomingWeak: T[],
  currentRecommended: T[],
  currentWeak: T[]
): { recommended: T[]; weak: T[] } {
  const incomingRecommendedIds = new Set(incomingRecommended.map((item) => item.job.id));
  const incomingWeakIds = new Set(incomingWeak.map((item) => item.job.id));

  const cleanedCurrentRecommended = currentRecommended.filter(
    (item) => !incomingWeakIds.has(item.job.id)
  );
  const cleanedCurrentWeak = currentWeak.filter((item) => !incomingRecommendedIds.has(item.job.id));

  const recommended = mergeVacancyTierLists(
    incomingRecommended,
    cleanedCurrentRecommended,
    incomingWeakIds
  );
  const weak = mergeVacancyTierLists(incomingWeak, cleanedCurrentWeak, incomingRecommendedIds);

  return { recommended, weak };
}

export function collectVacancyIds<T extends MatchedJobItemLike>(
  recommended: T[],
  weak: T[]
): Set<string> {
  const ids = new Set<string>();
  for (const item of recommended) ids.add(item.job.id);
  for (const item of weak) ids.add(item.job.id);
  return ids;
}

export function detectNewVacancyIds(
  incomingIds: Iterable<string>,
  knownIds: Set<string>,
  viewedIds: Set<string>
): { newIds: string[]; seedKnownOnly: boolean } {
  if (knownIds.size === 0) {
    return { newIds: [], seedKnownOnly: true };
  }

  const newIds: string[] = [];
  for (const id of incomingIds) {
    if (!knownIds.has(id) && !viewedIds.has(id)) {
      newIds.push(id);
    }
  }
  return { newIds, seedKnownOnly: false };
}

/**
 * Apply "new" badges after a match refresh.
 * Baseline load (first display / reveal panel) clears "new" for the current feed.
 */
export function applyVacancyNewBadges(
  prev: Set<string>,
  mergedIds: Set<string>,
  newIds: Iterable<string>,
  isBaselineFeedLoad: boolean
): Set<string> {
  if (isBaselineFeedLoad) {
    return new Set([...prev].filter((id) => !mergedIds.has(id)));
  }

  const next = new Set([...prev].filter((id) => mergedIds.has(id)));
  for (const id of newIds) {
    next.add(id);
  }
  return next;
}

export function restoreNewJobIds(
  persisted: { newJobIds: string[] },
  viewedIds: Set<string>
): Set<string> {
  return new Set(persisted.newJobIds.filter((id) => !viewedIds.has(id)));
}

/** Enough known ids to treat feed history as established (page refresh, not first analysis). */
export const ESTABLISHED_FEED_KNOWN_MIN = 20;

export function hasEstablishedVacancyFeedHistory(
  persistedKnownJobCount: number,
  refKnownJobCount: number
): boolean {
  return Math.max(persistedKnownJobCount, refKnownJobCount) >= ESTABLISHED_FEED_KNOWN_MIN;
}

/**
 * Drop corrupted bulk "new" state saved by earlier buggy sessions.
 */
export function sanitizeRestoredNewJobIds(
  persisted: { newJobIds: string[]; knownJobIds: string[] },
  viewedIds: Set<string>,
  mergedIds: Set<string>
): Set<string> {
  const restored = restoreNewJobIds(persisted, viewedIds);
  if (restored.size === 0) {
    return restored;
  }

  const mergedSize = mergedIds.size;
  if (mergedSize === 0) {
    return restored.size > 50 ? new Set() : restored;
  }

  if (persisted.knownJobIds.length === 0 && restored.size > 50) {
    return new Set();
  }

  if (restored.size > mergedSize * 0.8) {
    return new Set();
  }

  return restored;
}

export function shouldBaselineVacancyFeedLoad(options: {
  feedBaselined: boolean;
  hasEstablishedFeedHistory: boolean;
  currentFeedJobCount: number;
}): boolean {
  if (options.feedBaselined || options.hasEstablishedFeedHistory) {
    return false;
  }
  return options.currentFeedJobCount === 0;
}

export function filterJobsByNew<T extends MatchedJobItemLike>(
  jobs: T[],
  newJobIds: Set<string>
): T[] {
  if (newJobIds.size === 0) {
    return [];
  }
  return jobs.filter((item) => newJobIds.has(item.job.id));
}

export function filterJobsByFavorite<T extends MatchedJobItemLike>(
  jobs: T[],
  favoriteJobIds: Set<string>
): T[] {
  if (favoriteJobIds.size === 0) {
    return [];
  }
  return jobs.filter((item) => favoriteJobIds.has(item.job.id));
}
