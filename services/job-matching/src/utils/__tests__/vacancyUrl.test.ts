import {
  buildHhVacancyUrl,
  extractExternalVacancyId,
  isDemoVacancySource,
  resolvePublicVacancyUrl,
} from '../vacancyUrl';

describe('vacancyUrl', () => {
  it('builds canonical hh vacancy url', () => {
    expect(buildHhVacancyUrl('12345678')).toBe('https://hh.ru/vacancy/12345678');
  });

  it('detects mock hh urls', () => {
    expect(
      isDemoVacancySource('hh.ru', 'https://hh.ru/vacancy/mock-1')
    ).toBe(true);
    expect(isDemoVacancySource('demo', 'demo://leo-ai/mock/1')).toBe(true);
  });

  it('normalizes numeric hh vacancy urls', () => {
    expect(
      resolvePublicVacancyUrl('hh.ru', 'https://hh.ru/vacancy/99887766?query=1')
    ).toBe('https://hh.ru/vacancy/99887766');
  });

  it('rejects mock and listing urls', () => {
    expect(resolvePublicVacancyUrl('hh.ru', 'https://hh.ru/vacancy/mock-1')).toBeNull();
    expect(resolvePublicVacancyUrl('hh.ru', 'https://hh.ru/vacancies')).toBeNull();
  });

  it('extracts hh vacancy id', () => {
    expect(extractExternalVacancyId('hh.ru', 'https://hh.ru/vacancy/99887766')).toBe('99887766');
    expect(extractExternalVacancyId('hh.ru', 'https://hh.ru/vacancy/mock-1')).toBeNull();
  });

  it('allows superjob https links', () => {
    expect(
      resolvePublicVacancyUrl(
        'superjob.ru',
        'https://www.superjob.ru/vakansii/product-manager-123.html'
      )
    ).toBe('https://www.superjob.ru/vakansii/product-manager-123.html');
  });
});
