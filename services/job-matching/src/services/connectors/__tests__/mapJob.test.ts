import {
  guessExperienceLevel,
  guessWorkMode,
  keywordMatches,
  mapToJobInput,
  stripHtml,
  toLocationArray,
} from '../mapJob';
import {
  getExtendedSourceIds,
  isExtendedJobSourcesEnabled,
  isRunnableSource,
} from '../config';

describe('connectors/mapJob', () => {
  it('maps core fields and classifies role family', () => {
    const job = mapToJobInput({
      title: 'Product Manager',
      company: 'Яндекс',
      source: 'career_yandex',
      source_url: 'https://yandex.ru/jobs/vacancies/foo',
      description: 'Развитие продукта',
      location: 'Москва',
      work_mode: 'hybrid',
    });

    expect(job.source).toBe('career_yandex');
    expect(job.company).toBe('Яндекс');
    expect(job.location).toEqual(['Москва']);
    expect(job.work_mode).toBe('hybrid');
    expect(job.source_meta).toBeNull();
    expect(job.role_family).toBeTruthy();
  });

  it('guesses work mode and experience from text', () => {
    expect(guessWorkMode('Работа удалённо')).toBe('remote');
    expect(guessWorkMode('офис', false)).toBeNull();
    expect(guessWorkMode(null, true)).toBe('remote');
    expect(guessExperienceLevel('Senior Backend')).toBe('senior');
    expect(guessExperienceLevel('опыт 3-6 лет')).toBe('middle');
  });

  it('filters by keywords case-insensitively', () => {
    expect(keywordMatches('Product Manager Москва', ['product'])).toBe(true);
    expect(keywordMatches('DevOps Engineer', ['product', 'аналитик'])).toBe(false);
    expect(keywordMatches('anything', [])).toBe(true);
  });

  it('soft-matches tokens so English phrase hits RU title fragments', () => {
    expect(keywordMatches('Менеджер продукта Москва', ['Product Manager'])).toBe(true);
    expect(keywordMatches('Senior Backend Developer', ['Data Analyst'])).toBe(false);
  });

  it('soft-matches T-Bank Latin translit slugs (produktovoj, analitik, timlid)', () => {
    expect(
      keywordMatches(
        'timlid-produktovoj-analitiki-ekvajring /career/it/vacancy/',
        ['Product Manager', 'Product Owner']
      )
    ).toBe(true);
    expect(keywordMatches('produktovyj-analitik-v-copilot', ['Data Analyst'])).toBe(true);
  });

  it('strips html and normalizes locations', () => {
    expect(stripHtml('<b>Привет</b><br/>мир')).toContain('Привет');
    expect(toLocationArray('СПб')).toEqual(['СПб']);
    expect(toLocationArray(['Москва', '  '])).toEqual(['Москва']);
  });
});

describe('connectors/config flags', () => {
  const ORIGINAL_ENABLE = process.env.ENABLE_EXTENDED_JOB_SOURCES;
  const ORIGINAL_SOURCES = process.env.EXTENDED_JOB_SOURCES;

  afterEach(() => {
    if (ORIGINAL_ENABLE === undefined) delete process.env.ENABLE_EXTENDED_JOB_SOURCES;
    else process.env.ENABLE_EXTENDED_JOB_SOURCES = ORIGINAL_ENABLE;
    if (ORIGINAL_SOURCES === undefined) delete process.env.EXTENDED_JOB_SOURCES;
    else process.env.EXTENDED_JOB_SOURCES = ORIGINAL_SOURCES;
  });

  it('is off by default', () => {
    delete process.env.ENABLE_EXTENDED_JOB_SOURCES;
    expect(isExtendedJobSourcesEnabled()).toBe(false);
  });

  it('parses EXTENDED_JOB_SOURCES csv; all wave A+B are runnable', () => {
    process.env.EXTENDED_JOB_SOURCES = 'mts, wb ;sber,habr';
    expect(getExtendedSourceIds()).toEqual(['mts', 'wb', 'sber', 'habr']);
    expect(isRunnableSource('mts')).toBe(true);
    expect(isRunnableSource('habr')).toBe(true);
    expect(isRunnableSource('tg')).toBe(true);
  });

  it('EXTENDED_JOB_SOURCES=all expands to full default list', () => {
    process.env.EXTENDED_JOB_SOURCES = 'all';
    const ids = getExtendedSourceIds();
    expect(ids).toContain('yandex');
    expect(ids).toContain('habr');
    expect(ids).toContain('geekjob');
    expect(ids).toContain('tbank');
    expect(ids).not.toContain('ozon');
  });
});
