import {
  extractBundledVacancyBody,
  normalizeVacancyPrepInput,
  stripHtmlFromText,
  vacancyPrepDisplayLabel,
} from '../vacancyPrepText';

describe('vacancyPrepText', () => {
  it('strips HTML from vacancy descriptions', () => {
    const html = '<p><strong>Задачи</strong></p><ul><li>Пункт один</li><li>Пункт два</li></ul>';
    expect(stripHtmlFromText(html)).toContain('Задачи');
    expect(stripHtmlFromText(html)).toContain('• Пункт один');
    expect(stripHtmlFromText(html)).not.toContain('<p>');
  });

  it('extracts body after «разбор вакансии» prefix', () => {
    const input = 'разбор вакансии\n\n# PM\nКомпания: Acme\nОписание длиннее сорока символов для порога.';
    expect(extractBundledVacancyBody(input)).toMatch(/^# PM/);
  });

  it('normalizes Jack-style vacancy markdown', () => {
    const input = `# Product Manager
Компания: Единая Сервисная Платформа
## Описание
<p><strong>Задачи</strong></p>`;
    const normalized = normalizeVacancyPrepInput(input);
    expect(normalized).toContain('Компания:');
    expect(normalized).not.toContain('<p>');
  });

  it('builds display label for chat history', () => {
    expect(vacancyPrepDisplayLabel('PM', 'Acme')).toBe('Разбор вакансии: PM · Acme');
  });
});
