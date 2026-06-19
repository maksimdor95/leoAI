import { enrichQuickPathCollectedData } from '../quickPathEnrichment';

describe('conversation quickPathEnrichment', () => {
  it('persists structured fields from quick answers', () => {
    const enriched = enrichQuickPathCollectedData({
      desired_role: 'Сотрудник склада',
      careerSummary: '5 лет в Озоне',
      desired_location: 'Подольск, 150 000',
    });

    expect(enriched.totalExperience).toBe(5);
    expect(enriched.location).toEqual(['Подольск']);
    expect(enriched.salaryExpectation).toMatch(/150/);
  });
});
