import { cleanJobTitle, guessOrgFromTitle } from '../normalizeJobCard';

describe('normalizeJobCard (connectors)', () => {
  it('keeps domain team context on HH-like titles', () => {
    const title = cleanJobTitle('Product Owner в команду внутренних сервисов', 'Домклик');
    expect(title).toBe('Product Owner в команду внутренних сервисов');
  });

  it('keeps parenthetical domain', () => {
    const title = cleanJobTitle(
      'Product Owner (B2B, Эквайринг, AI-ассистент)',
      'ПАО Сбербанк'
    );
    expect(title).toContain('Product Owner');
    expect(title).toContain('B2B');
  });

  it('lightens TG pitch but keeps company cue when role is short', () => {
    const raw =
      'Product в Авито · 📍Москва, Россия · Авито — это экосистема, объединяющая Месс';
    const org = guessOrgFromTitle(raw);
    expect(org).toMatch(/авито/i);
    const title = cleanJobTitle(raw, org);
    expect(title).not.toMatch(/экосистема/i);
    expect(title).toBe('Product в Авито');
  });
});
