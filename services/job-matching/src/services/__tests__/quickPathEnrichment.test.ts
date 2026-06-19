import { enrichQuickPathCollectedData, extractSalaryFromText } from '../quickPathEnrichment';
import { skillsForProfileText, extractSkillsFromTextWithLexicon } from '../skillLexicon';

describe('quickPathEnrichment', () => {
  it('parses years, city, remote and salary from Quick Path fields', () => {
    const enriched = enrichQuickPathCollectedData({
      desired_role: 'Head of product',
      careerSummary: '10 лет в HR tech, SPIN, B2B SaaS',
      desired_location: 'Москва, удаленка, от 350 000 ₽',
    });

    expect(enriched.totalExperience).toBe(10);
    expect(enriched.location).toEqual(['Москва']);
    expect(enriched.workMode).toBe('remote');
    expect(enriched.salaryExpectation).toMatch(/350/);
    expect(enriched.skills).toEqual(expect.arrayContaining(['spin', 'b2b', 'saas']));
  });

  it('extracts salary in thousands shorthand', () => {
    expect(extractSalaryFromText('Подольск, от 150к')).toMatch(/150/);
  });
});

describe('skillLexicon', () => {
  it('includes sales skills for sales profile', () => {
    const lexicon = skillsForProfileText({
      desiredRole: 'Team Lead Sales B2B SaaS',
      careerSummary: 'SPIN, outbound, full cycle',
    });
    expect(lexicon).toEqual(expect.arrayContaining(['spin', 'bant', 'outbound']));
  });

  it('extracts wellbeing skills for psychologist profile', () => {
    const lexicon = skillsForProfileText({
      desiredRole: 'Корпоративный психолог',
      careerSummary: 'EAP, коучинг, MBTI',
    });
    const found = extractSkillsFromTextWithLexicon('EAP, коучинг, MBTI', lexicon);
    expect(found).toEqual(expect.arrayContaining(['eap', 'коучинг', 'mbti']));
  });
});
