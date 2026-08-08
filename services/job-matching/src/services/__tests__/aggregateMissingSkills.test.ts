import { aggregateMissingSkillsTop } from '../aggregateMissingSkills';

describe('aggregateMissingSkillsTop', () => {
  it('ranks by frequency and returns details', () => {
    const result = aggregateMissingSkillsTop(
      [
        { missingSkills: ['sql', 'jira'] },
        { missingSkills: ['sql', 'a/b'] },
        { missingSkills: ['sql'] },
        { missingSkills: ['roadmap'] },
      ],
      { amongTopN: 20, limit: 10, minCount: 0 }
    );
    expect(result.missingSkillsTop[0]).toBe('sql');
    expect(result.missingSkillsDetails[0]).toEqual({ skill: 'sql', count: 3 });
    expect(result.missingSkillsAmongTopN).toBe(4);
    expect(result.missingSkillsTotalUnique).toBe(4);
  });

  it('respects limit and amongTopN', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      missingSkills: [`skill-${i}`],
    }));
    const result = aggregateMissingSkillsTop(rows, {
      amongTopN: 3,
      limit: 2,
      minCount: 0,
    });
    expect(result.missingSkillsAmongTopN).toBe(3);
    expect(result.missingSkillsTop).toHaveLength(2);
    expect(result.missingSkillsTotalUnique).toBe(3);
  });

  it('hides gaps at or below minCount (default >35)', () => {
    const rows = [
      ...Array.from({ length: 40 }, () => ({ missingSkills: ['sql'] })),
      ...Array.from({ length: 20 }, () => ({ missingSkills: ['jira'] })),
    ];
    const result = aggregateMissingSkillsTop(rows, {
      amongTopN: 100,
      limit: 25,
      minCount: 35,
    });
    expect(result.missingSkillsTop).toEqual(['sql']);
    expect(result.missingSkillsDetails[0]?.count).toBe(40);
    expect(result.missingSkillsTotalUnique).toBe(2);
  });
});
