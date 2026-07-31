/**
 * Pure vacancy feed merge/detect helpers (no browser APIs — safe for unit tests).
 * Keep logic in sync with frontend/lib/vacancyFeedMerge.ts
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

/**
 * First display of the vacancy feed in this UI session → baseline (no "new" badges).
 * "New" only appears on later rematches after the feed was already shown.
 * Do not gate on cross-session localStorage history — that marked hundreds of jobs
 * as "new" on the first open of a fresh chat.
 */
export function shouldBaselineVacancyFeedLoad(options: {
  feedBaselined: boolean;
  /** @deprecated Ignored — kept for call-site compatibility. */
  hasEstablishedFeedHistory?: boolean;
  currentFeedJobCount: number;
}): boolean {
  if (options.feedBaselined) {
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

export function filterJobsByDismissed<T extends MatchedJobItemLike>(
  jobs: T[],
  dismissedJobIds: Set<string>
): T[] {
  if (dismissedJobIds.size === 0) {
    return jobs;
  }
  return jobs.filter((item) => !dismissedJobIds.has(item.job.id));
}

/** How many ids from `ids` are present in the current feed. */
export function countIdsInFeed(ids: Set<string>, feedIds: Set<string>): number {
  let count = 0;
  for (const id of ids) {
    if (feedIds.has(id)) count += 1;
  }
  return count;
}

/** Keep only favorites that still appear in the current match lists. */
export function pruneIdsToFeed(ids: Set<string>, feedIds: Set<string>): Set<string> {
  if (ids.size === 0) return new Set();
  if (feedIds.size === 0) return new Set();
  return new Set([...ids].filter((id) => feedIds.has(id)));
}

/**
 * Mark every "new" badge as viewed/known and clear the set.
 * Vacancies stay in the list — only the badge goes away.
 */
export function clearAllNewJobBadges(
  newJobIds: Set<string>,
  viewedIds: Set<string>,
  knownIds: Set<string>
): void {
  for (const id of newJobIds) {
    viewedIds.add(id);
    knownIds.add(id);
  }
  newJobIds.clear();
}

/** Confirm before bulk-clearing a large "new" pile (avoid mis-taps). */
export const CLEAR_NEW_CONFIRM_MIN = 20;
