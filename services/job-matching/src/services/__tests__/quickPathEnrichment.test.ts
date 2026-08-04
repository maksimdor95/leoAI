import { enrichQuickPathCollectedData, extractSalaryFromText } from '../quickPathEnrichment';
import {
  skillsForProfileText,
  extractSkillsFromTextWithLexicon,
  skillsMatchByAlias,
  skillAppearsInText,
  filterMeaningfulMissingSkills,
} from '../skillLexicon';

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

  it('matches HH product skill tags via aliases to resume wording', () => {
    expect(skillsMatchByAlias('Управление бэклогом', 'Управление бэклогом')).toBe(true);
    expect(skillsMatchByAlias('Продуктовые метрики', 'продуктовая аналитика')).toBe(true);
    expect(skillsMatchByAlias('Продуктовая стратегия', 'Product vision')).toBe(true);
    expect(skillsMatchByAlias('Стратегический менеджмент', 'Business Strategy')).toBe(true);
    expect(skillsMatchByAlias('Управление изменениями', 'управление изменениями')).toBe(true);
    expect(
      skillAppearsInText(
        'Product vision',
        'формирование видения и стратегии продукта, управление бэклогом'
      )
    ).toBe(true);
  });

  it('filters soft HH gaps when fit is already strong', () => {
    const gaps = filterMeaningfulMissingSkills(
      [
        'управление инновациями',
        'управление изменениями',
        'user story mapping',
        'SQL',
      ],
      ['Управление бэклогом', 'Agile Project Management', 'управление изменениями'],
      'product owner backlog agile scrum',
      { strongFit: true, max: 3 }
    );
    expect(gaps.map((g) => g.toLowerCase())).toEqual(
      expect.arrayContaining(['user story mapping', 'sql'])
    );
    expect(gaps.map((g) => g.toLowerCase())).not.toContain('управление инновациями');
    expect(gaps.map((g) => g.toLowerCase())).not.toContain('управление изменениями');
  });
});
