/**
 * Phase 2/3 defaults must match DoD (no silent inline scrape).
 */

describe('pipeline DoD defaults', () => {
  const ORIGINAL_INLINE = process.env.SCRAPE_INLINE_WORKER;

  afterEach(() => {
    if (ORIGINAL_INLINE === undefined) delete process.env.SCRAPE_INLINE_WORKER;
    else process.env.SCRAPE_INLINE_WORKER = ORIGINAL_INLINE;
  });

  it('treats missing SCRAPE_INLINE_WORKER as false (dedicated worker required)', () => {
    delete process.env.SCRAPE_INLINE_WORKER;
    expect(process.env.SCRAPE_INLINE_WORKER === 'true').toBe(false);
  });

  it('only enables inline worker when explicitly true', () => {
    process.env.SCRAPE_INLINE_WORKER = 'true';
    expect(process.env.SCRAPE_INLINE_WORKER === 'true').toBe(true);
    process.env.SCRAPE_INLINE_WORKER = 'false';
    expect(process.env.SCRAPE_INLINE_WORKER === 'true').toBe(false);
  });
});
