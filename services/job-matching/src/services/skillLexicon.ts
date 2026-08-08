import { RoleFamily, classifyProfileRoles } from './roleFamily';

/** Базовые навыки — IT / продукт / аналитика (ядро каталога). */
const CORE_SKILLS = [
  'sql', 'python', 'java', 'javascript', 'typescript', 'go', 'golang', 'rust',
  'react', 'vue', 'angular', 'node.js', 'nodejs', 'docker', 'kubernetes', 'k8s',
  'aws', 'gcp', 'azure', 'postgresql', 'mysql', 'mongodb', 'redis', 'kafka',
  'tableau', 'power bi', 'powerbi', 'excel', 'pandas', 'figma', 'jira', 'confluence',
  'miro', 'notion', 'agile', 'scrum', 'kanban', 'bpmn', 'uml', 'api',
  'machine learning', 'ml', 'a/b', 'a/b-тестирование', 'product management',
  'product owner', 'project management', '1c', '1с', 'sap', 'crm', 'erp', 'bi',
  'amocrm', 'битрикс24', 'bitrix24', 'hubspot', 'salesforce',
] as const;

/**
 * Группы синонимов для матчинга навыков профиля ↔ тегов HH / текста вакансии.
 * Первый элемент — канонический ключ группы (для диагностики).
 */
const SKILL_ALIAS_GROUPS: readonly (readonly string[])[] = [
  [
    'product-backlog',
    'управление бэклогом',
    'бэклог',
    'backlog',
    'backlog management',
    'product backlog',
    'приоритизация бэклога',
  ],
  [
    'team-management',
    'управление командой',
    'team management',
    'лидировал кросс-функциональн',
    'кросс-функциональн',
    'ведение команды',
  ],
  [
    'product-metrics',
    'продуктовые метрики',
    'product metrics',
    'продуктовая аналитика',
    'метрики продукта',
    'управление метриками',
    'kpi',
    'mau',
    'retention',
    'nps',
    'конверсия',
  ],
  [
    'product-strategy',
    'продуктовая стратегия',
    'product strategy',
    'product vision',
    'видение продукта',
    'стратегия продукта',
    'формирование видения',
    'долгосрочной стратегии',
  ],
  [
    'strategic-mgmt',
    'стратегический менеджмент',
    'strategic management',
    'business strategy',
    'стратегия развития',
  ],
  [
    'change-mgmt',
    'управление изменениями',
    'change management',
  ],
  [
    'resource-mgmt',
    'управление ресурсами',
    'resource management',
    'ресурсного планирования',
  ],
  [
    'agile-scrum',
    'agile',
    'scrum',
    'agile project management',
    'agile/scrum',
  ],
  [
    'ab-testing',
    'a/b',
    'a/b-тестирование',
    'a/b тесты',
    'ab testing',
    'ab-тесты',
  ],
];

const SKILL_ALIAS_INDEX: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const group of SKILL_ALIAS_GROUPS) {
    const canonical = group[0];
    for (const alias of group) {
      map.set(alias.toLowerCase(), canonical);
    }
  }
  return map;
})();

/** Каноническая группа навыка, если есть в словаре синонимов. */
export function skillAliasCanonical(skill: string): string | null {
  const lower = skill.toLowerCase().trim();
  if (!lower) return null;
  const direct = SKILL_ALIAS_INDEX.get(lower);
  if (direct) return direct;
  // Подстрочный матч: «управление бэклогом продукта» → product-backlog
  for (const [alias, canonical] of SKILL_ALIAS_INDEX) {
    if (alias.length < 4) continue;
    if (lower.includes(alias) || alias.includes(lower)) return canonical;
  }
  return null;
}

/** Два навыка считаются совпавшими, если совпадают строки или синонимы. */
export function skillsMatchByAlias(a: string, b: string): boolean {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (!la || !lb) return false;
  if (la.includes(lb) || lb.includes(la)) return true;
  const ca = skillAliasCanonical(la);
  const cb = skillAliasCanonical(lb);
  return Boolean(ca && cb && ca === cb);
}

/** Есть ли в тексте вакансии синоним навыка профиля. */
export function skillAppearsInText(skill: string, jobTextLower: string): boolean {
  const lower = skill.toLowerCase().trim();
  if (lower.length > 2 && jobTextLower.includes(lower)) return true;
  const canonical = skillAliasCanonical(lower);
  if (!canonical) return false;
  const group = SKILL_ALIAS_GROUPS.find((g) => g[0] === canonical);
  if (!group) return false;
  return group.some((alias) => alias.length > 3 && jobTextLower.includes(alias.toLowerCase()));
}

const SKILLS_BY_FAMILY: Partial<Record<RoleFamily, readonly string[]>> = {
  product: [
    'управление бэклогом', 'продуктовые метрики', 'продуктовая стратегия',
    'product vision', 'roadmap', 'discovery', 'delivery', 'jtbd', 'custdev',
    'user research', 'приоритизация', 'go-to-market', 'a/b-тестирование',
  ],
  sales: [
    'spin', 'bant', 'meddic', 'challenger sale', 'cold calling', 'outbound',
    'inbound', 'upsell', 'cross-sell', 'full cycle', 'b2b', 'b2c', 'saas',
    'account executive', 'sdr', 'bdr', 'ключевые клиенты', 'активные продажи',
    'холодные звонки', 'переговоры', 'дожим', 'воронка продаж', 'лидогенерация',
  ],
  marketing: [
    'performance marketing', 'growth', 'seo', 'sem', 'contextual', 'таргет',
    'facebook ads', 'google ads', 'яндекс директ', 'контент-маркетинг', 'smm',
    'brand', 'crm marketing', 'email marketing', 'retention', 'cac', 'ltv',
  ],
  hr: [
    'talent acquisition', 'onboarding', 'hrbp', 'people partner', 'рекрутинг',
    'assessment', 'compensation', 'c&b', 'l&d', 'performance review', 'eNPS',
    '1:1', 'кадровое делопроизводство', 'трудовое право',
  ],
  wellbeing: [
    'кпт', 'act', 'коучинг', 'фасилитация', 'медиация', 'eap', 'well-being',
    'wellbeing', 'mental health', 'психологическая поддержка', 'стресс-менеджмент',
    'mbti', 'hogan', 'gallup', 'опросы вовлеченности', 'employee experience',
  ],
  finance: [
    'ifrs', 'рсбу', 'бюджетирование', 'финмодель', 'cash flow', 'p&l', 'dcf',
    'финансовая отчетность', 'казначейство', 'аудит',
  ],
  design: [
    'figma', 'sketch', 'photoshop', 'illustrator', 'ux research', 'ui kit',
    'design system', 'прототипирование', 'usability',
  ],
  qa: [
    'playwright', 'selenium', 'postman', 'автотесты', 'регресс', 'test case',
    'api testing', 'нагрузочное тестирование',
  ],
};

export function skillsForFamilies(families: RoleFamily[]): string[] {
  const seen = new Set<string>();
  const add = (skill: string) => {
    const key = skill.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
    }
  };

  for (const skill of CORE_SKILLS) add(skill);
  for (const family of families) {
    const list = SKILLS_BY_FAMILY[family];
    if (list) {
      for (const skill of list) add(skill);
    }
  }

  return Array.from(seen.keys());
}

export function skillsForProfileText(params: {
  desiredRole?: string | null;
  careerSummary?: string | null;
  positionRoles?: string[];
}): string[] {
  const classification = classifyProfileRoles({
    desiredRole: params.desiredRole,
    careerSummary: params.careerSummary,
    positionRoles: params.positionRoles,
  });
  const families: RoleFamily[] = [
    classification.primary,
    ...classification.adjacent,
    ...classification.detected,
  ].filter((f) => f !== 'unknown');

  const hintText = [params.desiredRole, params.careerSummary, ...(params.positionRoles || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  for (const [family, skills] of Object.entries(SKILLS_BY_FAMILY) as [
    RoleFamily,
    readonly string[] | undefined,
  ][]) {
    if (!skills?.some((skill) => hintText.includes(skill.toLowerCase()))) continue;
    if (!families.includes(family)) families.push(family);
  }

  if (families.length === 0) {
    return skillsForFamilies(['product', 'analytics', 'sales', 'hr', 'wellbeing']);
  }
  return skillsForFamilies(families);
}

export function extractSkillsFromTextWithLexicon(
  text: string,
  lexicon: string[]
): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];

  for (const skill of lexicon) {
    if (skill.length <= 2) continue;
    if (lower.includes(skill.toLowerCase())) {
      found.push(skill);
    }
  }

  return [...new Set(found.map((s) => s.toLowerCase()))];
}

/**
 * HH-теги-«пустышки» / слишком общие формулировки — не показываем как gaps,
 * если профиль уже сильный по смыслу (overlap / много matched).
 */
const SOFT_GAP_LABELS = new Set([
  'управление инновациями',
  'управление изменениями',
  'управление ресурсами',
  'стратегический менеджмент',
  'коммуникабельность',
  'многозадачность',
  'стрессоустойчивость',
  'ответственность',
  'работа в команде',
  'грамотная речь',
  'user story mapping',
  'user stories',
  'story mapping',
  'user story',
  'написание user story',
  'ведение документации',
  'деловая переписка',
  'ms office',
  'microsoft office',
  'powerpoint',
  'excel',
]);

/** Методологические gaps, покрытые overlap duties (Agile/Scrum, roadmap…). */
const OVERLAP_COVERED_GAP_NEEDLES: { gap: RegExp; overlapNeedles: string[] }[] = [
  {
    gap: /user\s*stor|story\s*map|бэклог|backlog/i,
    overlapNeedles: ['бэклог', 'agile', 'scrum', 'приоритет'],
  },
  {
    gap: /roadmap|road\s*map|продуктов(ая|ый)\s+стратег/i,
    overlapNeedles: ['стратеги', 'видение', 'roadmap'],
  },
  {
    gap: /scrum|agile|kanban|спринт/i,
    overlapNeedles: ['agile', 'scrum'],
  },
];

/**
 * Gaps для UI/reasons: только реальные пробелы, не то что уже есть в опыте по алиасу.
 */
export function filterMeaningfulMissingSkills(
  missing: string[],
  userSkills: string[],
  profileTextLower: string,
  opts?: { strongFit?: boolean; max?: number; coveredByOverlap?: string[] }
): string[] {
  const max = opts?.max ?? 3;
  const strongFit = opts?.strongFit ?? false;
  const overlapBlob = (opts?.coveredByOverlap ?? []).join(' ').toLowerCase();
  const userLower = userSkills.map((s) => s.toLowerCase());

  const out: string[] = [];
  for (const raw of missing) {
    const skill = raw.toLowerCase().trim();
    if (!skill || skill.length < 3) continue;

    // Уже есть в профиле по алиасу / тексту опыта
    if (userLower.some((u) => skillsMatchByAlias(skill, u))) continue;
    if (skillAppearsInText(skill, profileTextLower)) continue;

    if (strongFit && SOFT_GAP_LABELS.has(skill)) continue;

    if (overlapBlob && isGapCoveredByOverlap(skill, overlapBlob)) continue;

    out.push(raw);
    if (out.length >= max) break;
  }
  return out;
}

function isGapCoveredByOverlap(skill: string, overlapBlob: string): boolean {
  for (const rule of OVERLAP_COVERED_GAP_NEEDLES) {
    if (!rule.gap.test(skill)) continue;
    if (rule.overlapNeedles.some((n) => overlapBlob.includes(n))) return true;
  }
  return false;
}

