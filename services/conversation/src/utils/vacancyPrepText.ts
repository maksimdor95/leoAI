/** Убирает HTML из описаний вакансий (hh.ru и др.). */
export function stripHtmlFromText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractBundledVacancyBody(input: string): string | null {
  const trimmed = input.trim();
  // \b в JS не ставит границу слова для кириллицы — проверяем явно
  if (!/^разбор\s+вакансии(?:\s|$|[,:;—–-])/i.test(trimmed)) return null;
  const body = trimmed
    .replace(/^разбор\s+вакансии/i, '')
    .replace(/^[\s:—–-]+/, '')
    .trim();
  if (body.length < 40) return null;
  return body;
}

/** Текст вакансии из Jack или ручного ввода — для extractVacancyProfile. */
export function normalizeVacancyPrepInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const fromPrefix = extractBundledVacancyBody(trimmed);
  if (fromPrefix) return stripHtmlFromText(fromPrefix);

  if (/^#\s+\S/m.test(trimmed) && /компания:/i.test(trimmed)) {
    return stripHtmlFromText(trimmed);
  }

  return null;
}

export function vacancyPrepDisplayLabel(title: string, company: string): string {
  const t = title.trim();
  const c = company.trim();
  if (t && c) return `Разбор вакансии: ${t} · ${c}`;
  if (t) return `Разбор вакансии: ${t}`;
  return 'Разбор вакансии';
}
