import { mergeSkillsIntoList, parseSkillsList } from '../mergeSkillsList';
import { classifySkillGapBucket, partitionSkillsByBucket } from '../skillGapBucket';
import { matchCoursesForGaps } from '../insightCoursesCatalog';

describe('mergeSkillsIntoList', () => {
  it('parses comma-separated skills', () => {
    expect(parseSkillsList('SQL, Jira; A/B')).toEqual(['SQL', 'Jira', 'A/B']);
  });

  it('merges without duplicates (case-insensitive)', () => {
    const { next, added } = mergeSkillsIntoList('SQL, Jira', ['jira', 'A/B тесты']);
    expect(added).toEqual(['A/B тесты']);
    expect(next).toBe('SQL, Jira, A/B тесты');
  });

  it('handles empty current', () => {
    const { next, added } = mergeSkillsIntoList('', ['Roadmap']);
    expect(added).toEqual(['Roadmap']);
    expect(next).toBe('Roadmap');
  });
});

describe('skillGapBucket', () => {
  it('classifies soft leadership gaps', () => {
    expect(classifySkillGapBucket('постановка задач разработчикам')).toBe('soft');
    expect(classifySkillGapBucket('управление командой')).toBe('soft');
  });

  it('defaults technical gaps to hard', () => {
    expect(classifySkillGapBucket('продуктовые метрики')).toBe('hard');
    expect(classifySkillGapBucket('a/b тесты')).toBe('hard');
    expect(classifySkillGapBucket('SQL')).toBe('hard');
  });

  it('partitions mixed lists', () => {
    const { hard, soft } = partitionSkillsByBucket([
      'SQL',
      'постановка задач разработчикам',
      'JTBD',
    ]);
    expect(hard).toEqual(['SQL', 'JTBD']);
    expect(soft).toEqual(['постановка задач разработчикам']);
  });
});

describe('matchCoursesForGaps', () => {
  it('returns courses for matching gaps', () => {
    const courses = matchCoursesForGaps(['a/b тесты', 'продуктовые метрики']);
    expect(courses.length).toBeGreaterThan(0);
    expect(courses.some((c) => c.matchedGaps.length > 0)).toBe(true);
  });

  it('hides section when no alias match', () => {
    expect(matchCoursesForGaps(['космическая навигация'])).toEqual([]);
  });
});
