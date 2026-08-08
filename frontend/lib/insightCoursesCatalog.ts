export type InsightCourse = {
  id: string;
  title: string;
  provider: string;
  url: string;
  level?: string;
  duration?: string;
  /** Aliases matched against missingSkillsTop (lowercase includes). */
  skillAliases: string[];
};

/**
 * Static curated catalog — match by real profile gaps, not profession pages.
 * Keep URLs official landing pages; expand via affiliate later.
 */
export const INSIGHT_COURSES_CATALOG: InsightCourse[] = [
  {
    id: 'yandex-ab',
    title: 'A/B-тестирование',
    provider: 'Яндекс Практикум',
    url: 'https://practicum.yandex.ru/ab-testing/',
    level: 'С нуля',
    duration: '2 месяца',
    skillAliases: ['a/b', 'ab тест', 'a/b тест', 'эксперимент', 'ab test', 'a/b test'],
  },
  {
    id: 'product-metrics',
    title: 'Продуктовая аналитика',
    provider: 'Нетология',
    url: 'https://netology.ru/programs/product-analytics',
    level: 'Средний',
    duration: '4 месяца',
    skillAliases: [
      'продуктов',
      'метрик',
      'product metrics',
      'unit.?econom',
      'юнит.?эконом',
      'north star',
    ],
  },
  {
    id: 'jtbd-research',
    title: 'Customer Development и JTBD',
    provider: 'ProductStar',
    url: 'https://productstar.ru/',
    level: 'Практический',
    duration: '6 недель',
    skillAliases: ['jtbd', 'custdev', 'customer development', 'user research', 'исследован'],
  },
  {
    id: 'sql-analytics',
    title: 'SQL для анализа данных',
    provider: 'Яндекс Практикум',
    url: 'https://practicum.yandex.ru/sql-data-analyst/',
    level: 'С нуля',
    duration: '3 месяца',
    skillAliases: ['sql', 'clickhouse', 'tableau', 'power bi'],
  },
  {
    id: 'product-management',
    title: 'Управление продуктом',
    provider: 'Нетология',
    url: 'https://netology.ru/programs/product-manager',
    level: 'С нуля',
    duration: '6 месяцев',
    skillAliases: [
      'roadmap',
      'бэклог',
      'backlog',
      'product vision',
      'видение продукт',
      'бизнес.?требован',
      'постановк',
      'product management',
      'управление продукт',
      'управление команд',
      'управлен.*команд',
      'team management',
      'team lead',
      'product owner',
      'product manager',
    ],
  },
  {
    id: 'python-data',
    title: 'Python для анализа данных',
    provider: 'Яндекс Практикум',
    url: 'https://practicum.yandex.ru/profile/data-analyst/',
    level: 'С нуля',
    duration: '6 месяцев',
    skillAliases: ['python', 'анализ данных', 'data analysis', 'pandas'],
  },
  {
    id: 'english-business',
    title: 'Английский для работы',
    provider: 'Skyeng',
    url: 'https://skyeng.ru/',
    level: 'B1+',
    duration: 'гибко',
    skillAliases: ['английск', 'english', 'деловая коммуникация', 'business communication'],
  },
  {
    id: 'scrum-master',
    title: 'Agile и Scrum',
    provider: 'ScrumTrek',
    url: 'https://scrumtrek.ru/',
    level: 'Базовый',
    duration: '2 дня',
    skillAliases: ['scrum', 'agile', 'kanban', 'jira'],
  },
];

function skillMatchesCourse(skill: string, course: InsightCourse): boolean {
  const lower = skill.toLowerCase();
  return course.skillAliases.some((alias) => {
    try {
      return new RegExp(alias, 'i').test(lower) || lower.includes(alias.toLowerCase());
    } catch {
      return lower.includes(alias.toLowerCase());
    }
  });
}

export function matchCoursesForGaps(
  gaps: string[],
  limit = 6
): Array<InsightCourse & { matchedGaps: string[] }> {
  const scored: Array<InsightCourse & { matchedGaps: string[]; score: number }> = [];
  for (const course of INSIGHT_COURSES_CATALOG) {
    const matchedGaps = gaps.filter((g) => skillMatchesCourse(g, course));
    if (matchedGaps.length === 0) continue;
    scored.push({ ...course, matchedGaps, score: matchedGaps.length });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _score, ...rest }) => rest);
}
