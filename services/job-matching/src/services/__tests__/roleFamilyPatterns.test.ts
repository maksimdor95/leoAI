import { titleSearchPatternsForFamilies } from '../roleFamily';

describe('titleSearchPatternsForFamilies', () => {
  it('builds ILIKE patterns for product and adjacent families', () => {
    const patterns = titleSearchPatternsForFamilies(['product', 'analytics', 'project']);

    expect(patterns.length).toBeGreaterThan(5);
    expect(patterns.some((p) => p.toLowerCase().includes('product manager'))).toBe(true);
    expect(patterns.some((p) => p.toLowerCase().includes('аналитик'))).toBe(true);
    expect(patterns.some((p) => p.toLowerCase().includes('project manager'))).toBe(true);
  });
});
