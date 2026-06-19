import { deriveScrapeParams } from '../scrapeProfileParams';
import { CollectedData } from '../userService';

describe('deriveScrapeParams', () => {
  it('includes keywords from multiple adjacent families for product profile', () => {
    const profile: CollectedData = {
      desired_role: 'Head of Product / Group Product Manager',
      position_1_role: 'Senior Product Manager',
      careerSummary: 'Опыт в B2B SaaS, работал с аналитикой и проектами.',
    };

    const params = deriveScrapeParams(profile);

    expect(params.familyPrimary).toBe('product');
    expect(params.keywords.length).toBeGreaterThanOrEqual(8);
    expect(params.keywords).toEqual(
      expect.arrayContaining(['Product Manager', 'Head of Product', 'Бизнес-аналитик'])
    );
    expect(params.keywordSource).toBe('profile');
  });
});
