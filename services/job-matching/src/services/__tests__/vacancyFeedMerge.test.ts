import {
  applyVacancyNewBadges,
  collectVacancyIds,
  detectNewVacancyIds,
  hasEstablishedVacancyFeedHistory,
  mergeVacancyTierLists,
  sanitizeRestoredNewJobIds,
  shouldBaselineVacancyFeedLoad,
  syncVacancyListsFromApi,
} from '../../utils/vacancyFeedMerge';

type Item = { job: { id: string; title: string }; score: number };

function item(id: string, score: number, title = id): Item {
  return { job: { id, title }, score };
}

describe('vacancyFeedMerge', () => {
  describe('mergeVacancyTierLists', () => {
    it('keeps API order and appends jobs that dropped from the latest response', () => {
      const incoming = [item('b', 80), item('c', 70)];
      const existing = [item('a', 90), item('b', 75)];

      const merged = mergeVacancyTierLists(incoming, existing, new Set());

      expect(merged.map((entry) => entry.job.id)).toEqual(['b', 'c', 'a']);
      expect(merged[0]?.score).toBe(80);
    });
  });

  describe('syncVacancyListsFromApi', () => {
    it('moves jobs between tiers and preserves previously shown jobs', () => {
      const result = syncVacancyListsFromApi(
        [item('rec-1', 90)],
        [item('weak-2', 40)],
        [item('old-rec', 88), item('weak-2', 35)],
        [item('old-weak', 20)]
      );

      expect(result.recommended.map((entry) => entry.job.id)).toEqual(['rec-1', 'old-rec']);
      expect(result.weak.map((entry) => entry.job.id)).toEqual(['weak-2', 'old-weak']);
    });
  });

  describe('detectNewVacancyIds', () => {
    it('seeds known ids on first hydration without marking everything new', () => {
      const detection = detectNewVacancyIds(['a', 'b', 'c'], new Set(), new Set());

      expect(detection).toEqual({ newIds: [], seedKnownOnly: true });
    });

    it('returns only ids that are neither known nor viewed', () => {
      const detection = detectNewVacancyIds(
        ['a', 'b', 'c', 'd'],
        new Set(['a', 'b']),
        new Set(['c'])
      );

      expect(detection).toEqual({ newIds: ['d'], seedKnownOnly: false });
    });
  });

  describe('collectVacancyIds', () => {
    it('collects ids from both tiers', () => {
      const ids = collectVacancyIds([item('a', 1)], [item('b', 2)]);
      expect(Array.from(ids).sort()).toEqual(['a', 'b']);
    });
  });

  describe('applyVacancyNewBadges', () => {
    it('clears new badges for the current feed on baseline load', () => {
      const mergedIds = new Set(['a', 'b', 'c']);
      const prev = new Set(['a', 'b', 'c', 'saved']);

      const next = applyVacancyNewBadges(prev, mergedIds, ['b'], true);

      expect(Array.from(next).sort()).toEqual(['saved']);
    });

    it('adds delta ids on incremental refresh', () => {
      const mergedIds = new Set(['a', 'b', 'c']);
      const prev = new Set(['a', 'stale']);

      const next = applyVacancyNewBadges(prev, mergedIds, ['c'], false);

      expect(Array.from(next).sort()).toEqual(['a', 'c']);
    });
  });

  describe('shouldBaselineVacancyFeedLoad', () => {
    it('baselines first feed display when there is no established history', () => {
      expect(
        shouldBaselineVacancyFeedLoad({
          feedBaselined: false,
          hasEstablishedFeedHistory: false,
          currentFeedJobCount: 0,
        })
      ).toBe(true);
    });

    it('does not baseline when feed history already exists', () => {
      expect(
        shouldBaselineVacancyFeedLoad({
          feedBaselined: false,
          hasEstablishedFeedHistory: true,
          currentFeedJobCount: 0,
        })
      ).toBe(false);
    });

    it('does not baseline after the first feed was already baselined', () => {
      expect(
        shouldBaselineVacancyFeedLoad({
          feedBaselined: true,
          hasEstablishedFeedHistory: false,
          currentFeedJobCount: 0,
        })
      ).toBe(false);
    });
  });

  describe('sanitizeRestoredNewJobIds', () => {
    it('drops corrupted bulk new state from older sessions', () => {
      const mergedIds = new Set(['a', 'b', 'c', 'd', 'e']);
      const restored = sanitizeRestoredNewJobIds(
        {
          newJobIds: ['a', 'b', 'c', 'd', 'e'],
          knownJobIds: [],
        },
        new Set(),
        mergedIds
      );

      expect(restored.size).toBe(0);
    });

    it('keeps a small legitimate new set on refresh', () => {
      const mergedIds = new Set(['a', 'b', 'c', 'd', 'e', 'f']);
      const restored = sanitizeRestoredNewJobIds(
        {
          newJobIds: ['a', 'b'],
          knownJobIds: Array.from({ length: 25 }, (_, index) => `known-${index}`),
        },
        new Set(),
        mergedIds
      );

      expect(Array.from(restored).sort()).toEqual(['a', 'b']);
    });
  });

  describe('hasEstablishedVacancyFeedHistory', () => {
    it('requires a meaningful known-job history', () => {
      expect(hasEstablishedVacancyFeedHistory(19, 0)).toBe(false);
      expect(hasEstablishedVacancyFeedHistory(20, 0)).toBe(true);
    });
  });
});
