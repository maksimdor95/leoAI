import {
  cleanJobTitle,
  guessOrgFromTitle,
  normalizeVacancyCardFields,
} from '../normalizeVacancyCard';

describe('normalizeVacancyCardFields', () => {
  it('keeps «в команду …» domain on Domclick-style titles', () => {
    const out = normalizeVacancyCardFields({
      title: 'Product Owner в команду внутренних сервисов',
      company: 'Домклик',
      source: 'hh.ru',
    });
    expect(out.title).toBe('Product Owner в команду внутренних сервисов');
    expect(out.company).toBe('Домклик');
  });

  it('keeps mortgage team domain', () => {
    const out = normalizeVacancyCardFields({
      title: 'Product Owner в команду «Ипотека»',
      company: 'Домклик',
      source: 'hh.ru',
    });
    expect(out.title).toMatch(/ипотека/i);
    expect(out.title).toMatch(/Product Owner/i);
  });

  it('turns TG pitch into light title without wiping domain', () => {
    const raw =
      'Product в Авито · 📍Москва, Россия · Авито — это экосистема, объединяющая Месс';
    const out = normalizeVacancyCardFields({
      title: raw,
      company: 'peersjobboard',
      source: 'tg_peersjobboard',
    });
    expect(out.title).toBe('Product в Авито');
    expect(out.title).not.toMatch(/экосистема/i);
    expect(out.company.toLowerCase()).toContain('авито');
    expect(out.company).not.toBe('peersjobboard');
  });

  it('extracts org from «роль в Компании» but not from «в команду»', () => {
    expect(guessOrgFromTitle('GenAI Product в Альфа-Банке · 📍Москва')).toMatch(/альфа/i);
    expect(guessOrgFromTitle('Product Owner в команду внутренних сервисов')).toBeNull();
    expect(
      cleanJobTitle('Product Owner в команду внутренних сервисов', 'Домклик')
    ).toBe('Product Owner в команду внутренних сервисов');
  });
});
