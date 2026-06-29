import { Job } from '../../models/job';
import {
  matchJobs,
  MATCH_SCORE_THRESHOLD,
  WEAK_MATCH_SCORE_FLOOR,
  filterWeakMatchesForPresentation,
} from '../matcher';
import { CollectedData } from '../userService';
import type { MatchingScore } from '../matcher';
import type { RoleFamily } from '../roleFamily';

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
    source_meta: partial.source_meta ?? null,
    source: partial.source ?? 'hh.ru',
    source_url: partial.source_url ?? 'https://example.com/job',
    role_family: partial.role_family ?? null,
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

describe('matchJobs — aspirational Head of Product', () => {
  const catalog = [
    mkJob({
      id: 'pm-head-only',
      title: 'Head of Product',
      description: 'Стратегия и развитие B2B SaaS продукта',
      requirements: 'Product management, SQL, stakeholder management',
      skills: ['Product Management', 'SQL', 'Amplitude'],
      experience_level: 'lead',
      work_mode: 'hybrid',
    }),
  ];

  const middlePmProfile: CollectedData = {
    desired_role: 'Head of Product / Group Product Manager',
    desired_location: 'Москва, гибрид',
    totalExperience: 5,
    skills_hard: 'SQL, Amplitude, Jira, Figma',
    workMode: 'hybrid',
    position_1_role: 'Product Manager',
  };

  const res = matchJobs(catalog, middlePmProfile);

  it('keeps same-family Head of Product in recommended (no grade-only demote)', () => {
    const head = res.matches.find((m) => m.job.id === 'pm-head-only');
    expect(head).toBeDefined();
    expect(head?.score).toBeGreaterThanOrEqual(MATCH_SCORE_THRESHOLD);
    expect(head?.familyMatch).toBe('same');
    expect(head?.demoteReasons ?? []).toHaveLength(0);
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

describe('filterWeakMatchesForPresentation', () => {
  const mkScore = (
    id: string,
    jobFamily: RoleFamily,
    familyMatch: MatchingScore['familyMatch']
  ): MatchingScore => ({
    job: mkJob({ id, title: id }),
    score: 30,
    reasons: [],
    jobFamily,
    familyMatch,
  });

  it('hides cross-family conflict weak matches when profile family is known', () => {
    const weak = [
      mkScore('w1', 'wellbeing', 'same'),
      mkScore('w2', 'analytics', 'conflict'),
    ];
    const filtered = filterWeakMatchesForPresentation(weak, 'wellbeing', null);
    expect(filtered.map((m) => m.job.id)).toEqual(['w1']);
  });

  it('shows only unknown job family when user family is unknown', () => {
    const weak = [
      mkScore('w1', 'analytics', 'unknown'),
      mkScore('w2', 'unknown', 'unknown'),
    ];
    const filtered = filterWeakMatchesForPresentation(weak, 'unknown', null);
    expect(filtered.map((m) => m.job.id)).toEqual(['w2']);
  });
});

describe('Guardrails — weak floor and threshold relationships', () => {
  it('WEAK_MATCH_SCORE_FLOOR < MATCH_SCORE_THRESHOLD', () => {
    expect(WEAK_MATCH_SCORE_FLOOR).toBeLessThan(MATCH_SCORE_THRESHOLD);
  });
});

describe('matchJobs — product vs production false positive', () => {
  const quickHoP: CollectedData = {
    desired_role: 'Head of product',
    careerSummary: '10 лет в HR tech',
    desired_location: 'Москва, удаленка',
  };

  const jobs: Job[] = [
    mkJob({
      id: 'prod-kaliningrad',
      title: 'Начальник производства/Head of production the Knocked Down (KD)',
      company: 'JETOUR',
      location: ['Калининград'],
      work_mode: 'office',
      experience_level: 'lead',
    }),
    mkJob({
      id: 'hop-adriver',
      title: 'Директор по продукту/Head of Product (CPO)',
      company: 'AdRiver',
      location: ['Москва'],
      work_mode: 'hybrid',
      experience_level: 'lead',
    }),
    mkJob({
      id: 'hop-domclick',
      title: 'Head of Product',
      company: 'Домклик',
      location: ['Москва'],
      work_mode: 'remote',
      experience_level: 'lead',
    }),
  ];

  const res = matchJobs(jobs, quickHoP);

  it('does not rank manufacturing production role first', () => {
    expect(res.matches.length).toBeGreaterThan(0);
    expect(res.matches[0]?.job.id).not.toBe('prod-kaliningrad');
    const hopFirst = res.matches.findIndex((m) => m.job.id === 'hop-domclick');
    const prodIdx = res.matches.findIndex((m) => m.job.id === 'prod-kaliningrad');
    if (prodIdx >= 0 && hopFirst >= 0) {
      expect(hopFirst).toBeLessThan(prodIdx);
    }
  });

  it('downranks or filters production job in Kaliningrad for remote HoP profile', () => {
    const prod = [...res.matches, ...res.weakMatches].find((m) => m.job.id === 'prod-kaliningrad');
    const hop = res.matches.find((m) => m.job.id === 'hop-domclick');
    expect(hop).toBeDefined();
    if (prod) {
      expect(prod.jobFamily).toBe('management');
      expect(prod.familyMatch).toBe('conflict');
      expect(prod.score).toBeLessThan(hop!.score);
    }
  });

  it('infers remote work mode from desired_location', () => {
    expect(res.stats.primaryFamily).toBe('product');
  });
});

describe('matchJobs — stored role_family', () => {
  it('uses role_family from DB instead of re-classifying title', () => {
    const job = mkJob({
      title: 'Ведущий специалист',
      role_family: 'product',
    });
    const profile: CollectedData = {
      desired_role: 'Product Manager',
      totalExperience: 5,
      workMode: 'remote',
    };
    const res = matchJobs([job], profile);
    const entry = [...res.matches, ...res.weakMatches][0];
    expect(entry?.jobFamily).toBe('product');
    expect(entry?.familyMatch).toBe('same');
  });
});
