import {
  parseTotalExperienceYearsFromText,
  resolveCollectValueForStep,
} from '../numericStepAnswers';

describe('parseTotalExperienceYearsFromText', () => {
  it('parses "7 лет QA Engineer"', () => {
    expect(parseTotalExperienceYearsFromText('7 лет QA Engineer')).toBe(7);
  });

  it('parses 10+ лет', () => {
    expect(parseTotalExperienceYearsFromText('10+ лет в банке')).toBe(10);
  });

  it('does not treat "7 лет назад" as experience span', () => {
    expect(parseTotalExperienceYearsFromText('уволился 7 лет назад')).toBeNull();
  });

  it('parses семь лет', () => {
    expect(parseTotalExperienceYearsFromText('семь лет в поддержке')).toBe(7);
  });
});

describe('resolveCollectValueForStep totalExperience', () => {
  it('returns number when text contains years', () => {
    expect(resolveCollectValueForStep('totalExperience', 'около 5 лет')).toBe(5);
  });
});
