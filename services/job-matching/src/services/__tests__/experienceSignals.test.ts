import { Job } from '../../models/job';
import { CollectedData } from '../userService';
import {
  buildExperienceHighlights,
  findMissingSkillsMentionedInExperience,
  scoreExperienceOverlap,
} from '../experienceSignals';

function mkJob(partial: Partial<Job>): Job {
  const now = new Date();
  return {
    id: partial.id ?? 'job-1',
    title: partial.title ?? 'Product Owner',
    company: partial.company ?? 'X5',
    location: partial.location ?? ['Москва'],
    salary_min: null,
    salary_max: null,
    currency: null,
    description: partial.description ?? '',
    requirements: partial.requirements ?? '',
    skills: partial.skills ?? [],
    experience_level: partial.experience_level ?? null,
    work_mode: partial.work_mode ?? 'hybrid',
    source_meta: null,
    source: 'hh.ru',
    source_url: 'https://example.com',
    role_family: 'product',
    posted_at: now,
    created_at: now,
    updated_at: now,
  };
}

describe('experienceSignals', () => {
  it('scores overlap between PO experience and X5-like JD duties', () => {
    const job = mkJob({
      title: 'Владелец продукта / Product Owner',
      description: `
        Формирование видения и стратегии Продукта.
        Приоритизация бэклога продукта.
        Координация кросс-функциональных команд.
        KPI, A/B тесты, Agile/Scrum.
        Менторство и развитие членов команды.
      `,
      requirements: 'Опыт Product Owner от 3 лет, глубокое понимание Agile/Scrum',
      skills: ['Управление бэклогом', 'Продуктовые метрики', 'Управление командой'],
    });

    const profile: CollectedData = {
      desiredRole: 'Product Owner',
      careerSummary: 'PO в FinTech, метрики и discovery',
      skills: ['Управление бэклогом', 'Product vision', 'Agile Project Management'],
      position_1_role: 'Product Owner',
      position_1_company: 'Сбер',
      position_1_responsibilities:
        'Управление бэклогом, Agile/Scrum, координация кросс-функциональной команды, продуктовые метрики, стратегия',
      position_1_achievements: 'Увеличил MAU на 30%, внедрил приоритизацию и A/B',
    };

    const result = scoreExperienceOverlap(job, profile);
    expect(result.points).toBeGreaterThanOrEqual(4);
    expect(result.matchedLabels.length).toBeGreaterThanOrEqual(3);
    expect(result.reason).toMatch(/опыт пересекается с обязанностями/i);
  });

  it('returns zero when profile has no duty signals', () => {
    const job = mkJob({
      description: 'Нужен Python-разработчик FastAPI PostgreSQL',
      skills: ['Python', 'FastAPI'],
    });
    const profile: CollectedData = {
      desiredRole: 'Бухгалтер',
      careerSummary: 'Отчётность и первичная документация',
    };
    expect(scoreExperienceOverlap(job, profile).points).toBe(0);
  });

  it('builds experience highlights from position fields', () => {
    const bullets = buildExperienceHighlights({
      position_1_role: 'Product Owner',
      position_1_company: 'Сбер',
      position_1_achievements: 'Запустил зарплатный путь, +415 млн ₽',
      position_2_role: 'Project Manager',
      position_2_responsibilities: 'Запустил 2 web-платформы',
    });
    expect(bullets.length).toBe(2);
    expect(bullets[0]).toContain('Product Owner');
    expect(bullets[0]).toContain('Сбер');
  });

  it('finds gap skills mentioned in experience but not listed in skills_*', () => {
    const profile: CollectedData = {
      skills_hard: 'SQL, Jira',
      position_1_role: 'Product Manager',
      position_1_responsibilities:
        'Вёл roadmap, проводил A/B тесты и custdev с пользователями',
      careerSummary: '5 лет в продукте, работал с Python для аналитики',
    };
    const found = findMissingSkillsMentionedInExperience(
      ['python', 'a/b тесты', 'roadmap', 'Kubernetes'],
      profile
    );
    expect(found.map((s) => s.toLowerCase())).toEqual(
      expect.arrayContaining(['python', 'a/b тесты', 'roadmap'])
    );
    expect(found.map((s) => s.toLowerCase())).not.toContain('kubernetes');
  });

  it('does not flag skills already listed in skills_hard', () => {
    const profile: CollectedData = {
      skills_hard: 'Python, SQL',
      position_1_achievements: 'Много Python и SQL в отчётах',
    };
    expect(findMissingSkillsMentionedInExperience(['Python', 'SQL'], profile)).toEqual([]);
  });
});
