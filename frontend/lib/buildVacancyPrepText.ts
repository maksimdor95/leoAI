export type VacancyPrepJobInput = {
  title: string;
  company: string;
  source?: string;
  source_url?: string;
  location?: string[];
  description?: string;
  requirements?: string;
  skills?: string[];
  work_mode?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
};

function stripHtmlFromText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatSalary(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null;
  if (min && max) return `${min.toLocaleString('ru-RU')} – ${max.toLocaleString('ru-RU')} ₽`;
  if (min) return `от ${min.toLocaleString('ru-RU')} ₽`;
  return `до ${max!.toLocaleString('ru-RU')} ₽`;
}

export function vacancyPrepDisplayLabel(title: string, company: string): string {
  const t = title.trim();
  const c = company.trim();
  if (t && c) return `Разбор вакансии: ${t} · ${c}`;
  if (t) return `Разбор вакансии: ${t}`;
  return 'Разбор вакансии';
}

/** Текст вакансии для сценария interview-prep (разбор без ручного ввода). */
export function buildVacancyPrepText(job: VacancyPrepJobInput): string {
  const lines: string[] = [
    `# ${job.title}`,
    `Компания: ${job.company}`,
  ];

  if (job.location?.length) {
    lines.push(`Локация: ${job.location.join(', ')}`);
  }
  if (job.work_mode) {
    lines.push(`Формат: ${job.work_mode}`);
  }
  const salary = formatSalary(job.salary_min, job.salary_max);
  if (salary) {
    lines.push(`Зарплата: ${salary}`);
  }
  if (job.source_url) {
    lines.push(`Ссылка: ${job.source_url}`);
  }
  if (job.source) {
    lines.push(`Источник: ${job.source}`);
  }

  if (job.description?.trim()) {
    lines.push('', '## Описание', stripHtmlFromText(job.description));
  }
  if (job.requirements?.trim()) {
    lines.push('', '## Требования', stripHtmlFromText(job.requirements));
  }
  if (job.skills?.length) {
    lines.push('', '## Навыки', job.skills.join(', '));
  }

  return lines.join('\n');
}
