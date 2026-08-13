/**
 * Insight add→refresh scenarios (C1 smoke as unit guards).
 * Manual on staging: open «Усилить подбор», add gaps once, confirm list updates without second click.
 */
import { mergeSkillsIntoList } from '../mergeSkillsList';

describe('insight add flow (C1)', () => {
  it('first add merges new skills into profile fields', () => {
    const { next, added } = mergeSkillsIntoList('SQL', ['python', 'аналитическое мышление']);
    expect(added).toEqual(['python', 'аналитическое мышление']);
    expect(next).toContain('python');
  });

  it('second add of same skills is idempotent (no duplicate loop)', () => {
    const afterFirst = mergeSkillsIntoList('SQL', ['python', 'аналитическое мышление']).next;
    const second = mergeSkillsIntoList(afterFirst, ['python', 'аналитическое мышление']);
    expect(second.added).toEqual([]);
    expect(second.next).toBe(afterFirst);
  });

  it('closed-gap filter drops skills the user already added this session', () => {
    const closed = new Set(['python', 'sql']);
    const next = [
      { skill: 'python', count: 50 },
      { skill: 'управление командой', count: 44 },
    ].filter((d) => !closed.has(d.skill.toLowerCase()));
    expect(next.map((d) => d.skill)).toEqual(['управление командой']);
  });
});
