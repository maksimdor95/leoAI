import { MATCH_SCAN_MAX, resolveMatchScanLimit } from '../jobRepository';

describe('resolveMatchScanLimit', () => {
  it('returns full catalog size when below max', () => {
    expect(resolveMatchScanLimit(3083)).toBe(3083);
    expect(resolveMatchScanLimit(1)).toBe(1);
  });

  it('caps at MATCH_SCAN_MAX for large catalogs', () => {
    expect(resolveMatchScanLimit(8000)).toBe(MATCH_SCAN_MAX);
    expect(resolveMatchScanLimit(MATCH_SCAN_MAX)).toBe(MATCH_SCAN_MAX);
  });

  it('returns MATCH_SCAN_MAX for empty catalog', () => {
    expect(resolveMatchScanLimit(0)).toBe(MATCH_SCAN_MAX);
  });
});
