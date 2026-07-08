import {
  applyVacancyNewBadges,
  collectVacancyIds,
  detectNewVacancyIds,
  ESTABLISHED_FEED_KNOWN_MIN,
  filterJobsByFavorite,
  filterJobsByNew,
  hasEstablishedVacancyFeedHistory,
  mergeVacancyTierLists,
  sanitizeRestoredNewJobIds,
  shouldBaselineVacancyFeedLoad,
  syncVacancyListsFromApi,
  type MatchedJobItemLike,
} from './vacancyFeedMerge';

export type { MatchedJobItemLike };
export type VacanciesFilter = 'all' | 'new' | 'favorite';

export {
  applyVacancyNewBadges,
  collectVacancyIds,
  detectNewVacancyIds,
  ESTABLISHED_FEED_KNOWN_MIN,
  filterJobsByFavorite,
  filterJobsByNew,
  hasEstablishedVacancyFeedHistory,
  mergeVacancyTierLists,
  sanitizeRestoredNewJobIds,
  shouldBaselineVacancyFeedLoad,
  syncVacancyListsFromApi,
};

export type VacancyFeedPersistedState = {
  viewedJobIds: string[];
  newJobIds: string[];
  knownJobIds: string[];
  favoriteJobIds: string[];
};

const STORAGE_PREFIX = 'leo:vacancy-feed:';

const EMPTY_PERSISTED: VacancyFeedPersistedState = {
  viewedJobIds: [],
  newJobIds: [],
  knownJobIds: [],
  favoriteJobIds: [],
};

function uniqueStrings(values: Iterable<string>): string[] {
  return Array.from(new Set(values));
}

function normalizePersistedState(raw: unknown): VacancyFeedPersistedState {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_PERSISTED };
  }
  const record = raw as Record<string, unknown>;
  const viewedJobIds = Array.isArray(record.viewedJobIds)
    ? uniqueStrings(record.viewedJobIds.filter((id): id is string => typeof id === 'string'))
    : [];
  const newJobIds = Array.isArray(record.newJobIds)
    ? uniqueStrings(record.newJobIds.filter((id): id is string => typeof id === 'string'))
    : [];
  const knownJobIds = Array.isArray(record.knownJobIds)
    ? uniqueStrings(record.knownJobIds.filter((id): id is string => typeof id === 'string'))
    : [];
  const favoriteJobIds = Array.isArray(record.favoriteJobIds)
    ? uniqueStrings(record.favoriteJobIds.filter((id): id is string => typeof id === 'string'))
    : [];
  return { viewedJobIds, newJobIds, knownJobIds, favoriteJobIds };
}

export function vacancyFeedStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function loadVacancyFeedState(userId: string): VacancyFeedPersistedState {
  if (typeof window === 'undefined') {
    return { ...EMPTY_PERSISTED };
  }
  try {
    const raw = localStorage.getItem(vacancyFeedStorageKey(userId));
    if (!raw) {
      return { ...EMPTY_PERSISTED };
    }
    return normalizePersistedState(JSON.parse(raw));
  } catch {
    return { ...EMPTY_PERSISTED };
  }
}

export function saveVacancyFeedState(userId: string, state: VacancyFeedPersistedState): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(
      vacancyFeedStorageKey(userId),
      JSON.stringify({
        viewedJobIds: uniqueStrings(state.viewedJobIds),
        newJobIds: uniqueStrings(state.newJobIds),
        knownJobIds: uniqueStrings(state.knownJobIds),
        favoriteJobIds: uniqueStrings(state.favoriteJobIds),
      })
    );
  } catch {
    // quota / private mode — best effort
  }
}

export function buildKnownJobIdSet(
  persisted: VacancyFeedPersistedState,
  serverViewedIds: Iterable<string>
): Set<string> {
  return new Set([...persisted.knownJobIds, ...persisted.viewedJobIds, ...serverViewedIds]);
}

export function buildViewedJobIdSet(
  persisted: VacancyFeedPersistedState,
  serverViewedIds: Iterable<string>
): Set<string> {
  return new Set([...persisted.viewedJobIds, ...serverViewedIds]);
}

export function restoreNewJobIds(
  persisted: VacancyFeedPersistedState,
  viewedIds: Set<string>
): Set<string> {
  return new Set(persisted.newJobIds.filter((id) => !viewedIds.has(id)));
}

export function markVacancyViewed(
  jobId: string,
  newJobIds: Set<string>,
  viewedIds: Set<string>,
  knownIds: Set<string>
): void {
  viewedIds.add(jobId);
  knownIds.add(jobId);
  newJobIds.delete(jobId);
}

export function toggleVacancyFavorite(jobId: string, favoriteIds: Set<string>): Set<string> {
  const next = new Set(favoriteIds);
  if (next.has(jobId)) {
    next.delete(jobId);
  } else {
    next.add(jobId);
  }
  return next;
}

export function toPersistedFeedState(
  newJobIds: Set<string>,
  viewedIds: Set<string>,
  knownIds: Set<string>,
  favoriteIds: Set<string>
): VacancyFeedPersistedState {
  return {
    newJobIds: Array.from(newJobIds),
    viewedJobIds: Array.from(viewedIds),
    knownJobIds: Array.from(knownIds),
    favoriteJobIds: Array.from(favoriteIds),
  };
}
