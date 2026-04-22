import { Job } from '../../models/job';
import {
  matchJobs,
  MATCH_SCORE_THRESHOLD,
  WEAK_MATCH_SCORE_FLOOR,
} from '../matcher';
import { CollectedData } from '../userService';

/**
 * Эти тесты — защита от регресса основной боли: в каталог, забитый
 * dev-вакансиями (Python/React/Node/QA), нельзя рекомендовать Senior PM
 * ничего из этого выше порога «Рекомендуем». Смежные роли (аналитик)
 * допустимы в weak-ярусе, но тоже не должны лидировать.
 */

function mkJob(partial: Partial<Job>): Job {
  return {
    id: partial.id ?? `job-${Math.random().toString(36).slice(2, 9)}`,
    title: partial.title ?? 'Untitled',
    company: partial.company ?? 'ACME',
    location: partial.location ?? ['Москва'],
    salary_min: partial.salary_min ?? null,
    salary_max: partial.salary_max ?? null,
    currency: partial.currency ?? 'RUR',
    description: partial.description ?? '',
    requirements: partial.requirements ?? '',
    skills: partial.skills ?? [],
    experience_level: partial.experience_level ?? null,
    work_mode: partial.work_mode ?? null,
    source: partial.source ?? 'hh.ru',
    source_url: partial.source_url ?? 'https://example.com/job',
    posted_at: partial.posted_at ?? new Date(),
    created_at: partial.created_at ?? new Date(),
    updated_at: partial.updated_at ?? new Date(),
  };
}

const CATALOG_MIXED: Job[] = [
  // dev-шум
  mkJob({
    id: 'dev-python',
    title: 'Senior Python-разработчик',
    description: 'Backend на Python, FastAPI, PostgreSQL',
    requirements: 'Python 3+, SQL, опыт с REST API',
    skills: ['Python', 'SQL', 'FastAPI'],
    experience_level: 'senior',
    work_mode: 'remote',
  }),
  mkJob({
    id: 'dev-react',
    title: 'Frontend-разработчик (React, TypeScript)',
    description: 'Разработка UI на React',
    requirements: 'React, TypeScript, REST API',
    skills: ['React', 'TypeScript', 'JavaScript'],
    experience_level: 'middle',
    work_mode: 'remote',
  }),
  mkJob({
    id: 'dev-node',
    title: 'Node.js разработчик',
    description: 'Микросервисы на Node.js',
    requirements: 'Node.js, PostgreSQL',
    skills: ['Node.js', 'TypeScript'],
    experience_level: 'senior',
    work_mode: 'hybrid',
  }),
  mkJob({
    id: 'dev-qa',
    title: 'QA Engineer (API / Playwright / TypeScript)',
    description: 'Автотестирование API',
    requirements: 'Playwright, SQL, REST',
    skills: ['Playwright', 'SQL'],
    experience_level: 'middle',
    work_mode: 'remote',
  }),

  // product/adjacent
  mkJob({
    id: 'pm-head',
    title: 'Head of Product',
    description: 'Стратегия и развитие продукта',
    requirements: 'Опыт управления продуктовой командой от 5 лет, Amplitude, SQL',
    skills: ['Product Management', 'Amplitude', 'SQL'],
    experience_level: 'senior',
    work_mode: 'hybrid',
  }),
  mkJob({
    id: 'pm-senior',
    title: 'Senior Product Manager',
    description: 'Развитие B2B SaaS продукта',
    requirements: 'Опыт PM от 4 лет, SQL, A/B testing, discovery',
    skills: ['Product Management', 'SQL', 'A/B testing'],
    experience_level: 'senior',
    work_mode: 'hybrid',
  }),
  mkJob({
    id: 'pm-middle',
    title: 'Product Manager',
    description: 'Продуктовый менеджер в e-commerce',
    requirements: 'SQL, GA4, работа с аналитикой',
    skills: ['SQL', 'GA4'],
    experience_level: 'middle',
    work_mode: 'hybrid',
  }),
  mkJob({
    id: 'pa-middle',
    title: 'Продуктовый аналитик',
    description: 'Анализ продуктовых метрик',
    requirements: 'SQL, Python, Amplitude, A/B testing',
    skills: ['SQL', 'Python', 'Amplitude'],
    experience_level: 'middle',
    work_mode: 'remote',
  }),
  mkJob({
    id: 'ba-senior',
    title: 'Senior Business Analyst',
    description: 'Бизнес-анализ процессов',
    requirements: 'SQL, Jira, BPMN',
    skills: ['SQL', 'Jira'],
    experience_level: 'senior',
    work_mode: 'office',
  }),
];

const SENIOR_PM: CollectedData = {
  desired_role: 'Head of Product / Group Product Manager',
  desired_location: 'Москва, гибрид',
  totalExperience: 8,
  careerSummary:
    'Начинал бизнес-аналитиком, затем вырос до Senior Product Manager в B2B SaaS.',
  skills_hard: 'SQL, Python, Amplitude, GA4, Tableau, Jira, Figma, A/B testing',
  skills_soft: 'Приоритизация, stakeholder management, фасилитация, переговоры',
  position_1_role: 'Senior Product Manager',
  position_2_role: 'Product Manager',
  workMode: 'hybrid',
};

const MIDDLE_PM: CollectedData = {
  desired_role: 'Middle/Senior Product Manager',
  desired_location: 'Санкт-Петербург, удаленно или гибрид',
  totalExperience: 5,
  careerSummary: '5 лет в продукте: от project coordinator до Product Manager.',
  skills_hard: 'SQL, GA4, AppMetrica, Jira, Confluence, Figma',
  skills_soft: 'Коммуникация, управление приоритетами, презентации',
  position_1_role: 'Product Manager',
  position_2_role: 'Junior Product Manager',
  workMode: 'remote',
};

const JUNIOR_PM: CollectedData = {
  desired_role: 'Junior/Middle Product Manager',
  desired_location: 'Удаленно',
  totalExperience: 2,
  careerSummary: 'Около 2 лет в продукте, перешёл из аналитики.',
  skills_hard: 'SQL, Excel, Amplitude, Miro, Jira',
  skills_soft: 'Структурное мышление, коммуникация, обучаемость',
  position_1_role: 'Junior Product Manager',
  position_2_role: 'Product Analyst',
  workMode: 'remote',
};

describe('matchJobs — Senior PM', () => {
  const res = matchJobs(CATALOG_MIXED, SENIOR_PM);
  const titles = (list: { job: Job }[]) => list.map((m) => m.job.title);

  it('classifies user primary family as "product"', () => {
    expect(res.stats.primaryFamily).toBe('product');
  });

  it('recommends Head of Product / Senior PM as top matches', () => {
    const top3 = titles(res.matches.slice(0, 3));
    expect(top3).toEqual(expect.arrayContaining(['Head of Product', 'Senior Product Manager']));
  });

  it('never recommends React/Node/QA in primary tier', () => {
    const recTitles = titles(res.matches);
    expect(recTitles).not.toContain('Frontend-разработчик (React, TypeScript)');
    expect(recTitles).not.toContain('Node.js разработчик');
    expect(recTitles).not.toContain('QA Engineer (API / Playwright / TypeScript)');
    expect(recTitles).not.toContain('Senior Python-разработчик');
  });

  it('surface max score near top for the best PM role', () => {
    const topScore = res.matches[0]?.score ?? 0;
    expect(topScore).toBeGreaterThanOrEqual(MATCH_SCORE_THRESHOLD);
  });

  it('returns family distribution including dev families', () => {
    expect(res.stats.familyDistribution).toMatchObject({
      product: expect.any(Number),
      frontend: expect.any(Number),
    });
  });

  it('marks product jobs as same-family and dev jobs as conflict', () => {
    const head = res.matches.find((m) => m.job.id === 'pm-head');
    const react = [...res.matches, ...res.weakMatches].find((m) => m.job.id === 'dev-react');
    expect(head?.familyMatch).toBe('same');
    // react может не попасть ни в тот, ни в другой ярус — тогда это ок,
    // но если попал, обязан быть conflict и с низким скором.
    if (react) {
      expect(react.familyMatch).toBe('conflict');
      expect(react.score).toBeLessThan(MATCH_SCORE_THRESHOLD);
    }
  });
});

describe('matchJobs — Middle PM', () => {
  const res = matchJobs(CATALOG_MIXED, MIDDLE_PM);
  it('picks Product Manager / Senior Product Manager near top', () => {
    const top = res.matches.slice(0, 3).map((m) => m.job.title);
    expect(top).toEqual(expect.arrayContaining(['Product Manager']));
  });
  it('classifies primary as product', () => {
    expect(res.stats.primaryFamily).toBe('product');
  });
  it('does not recommend QA / React', () => {
    const recTitles = res.matches.map((m) => m.job.title);
    expect(recTitles).not.toContain('QA Engineer (API / Playwright / TypeScript)');
    expect(recTitles).not.toContain('Frontend-разработчик (React, TypeScript)');
  });
});

describe('matchJobs — Junior PM', () => {
  const res = matchJobs(CATALOG_MIXED, JUNIOR_PM);
  it('classifies primary as product', () => {
    expect(res.stats.primaryFamily).toBe('product');
  });
  it('surfaces Product Manager / Product Analyst in tiers', () => {
    const everyone = [...res.matches, ...res.weakMatches].map((m) => m.job.title);
    expect(everyone).toEqual(expect.arrayContaining(['Product Manager']));
    expect(everyone).toEqual(expect.arrayContaining(['Продуктовый аналитик']));
  });
  it('does not put Node.js разработчик above threshold', () => {
    const recTitles = res.matches.map((m) => m.job.title);
    expect(recTitles).not.toContain('Node.js разработчик');
    expect(recTitles).not.toContain('Senior Python-разработчик');
  });
});

describe('Guardrails — weak floor and threshold relationships', () => {
  it('WEAK_MATCH_SCORE_FLOOR < MATCH_SCORE_THRESHOLD', () => {
    expect(WEAK_MATCH_SCORE_FLOOR).toBeLessThan(MATCH_SCORE_THRESHOLD);
  });
});
